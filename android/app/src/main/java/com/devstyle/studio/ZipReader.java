package com.devstyle.studio;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Turns a picked .zip into GitHub-ready file entries. */
public class ZipReader {

  public static class Entry {
    public String path;
    public String text;
    public String base64;

    public boolean binary() {
      return base64 != null;
    }
  }

  public static class Result {
    public String name = "project";
    public final List<Entry> files = new ArrayList<>();
    public int skipped = 0;
  }

  private static final int MAX_FILES = 400;
  private static final long MAX_BYTES = 6L * 1024L * 1024L;

  public static Result read(Context context, Uri uri) throws Exception {
    List<String> names = new ArrayList<>();
    List<byte[]> blobs = new ArrayList<>();
    Result result = new Result();

    InputStream raw = context.getContentResolver().openInputStream(uri);
    if (raw == null) throw new Exception("Could not open that zip file.");
    ZipInputStream zip = new ZipInputStream(raw);
    byte[] chunk = new byte[8192];
    ZipEntry entry;
    while ((entry = zip.getNextEntry()) != null) {
      String name = entry.getName() == null ? "" : entry.getName().replace('\\', '/');
      if (entry.isDirectory() || skip(name)) continue;
      if (names.size() >= MAX_FILES) {
        result.skipped++;
        continue;
      }
      ByteArrayOutputStream buffer = new ByteArrayOutputStream();
      long total = 0;
      int read;
      while ((read = zip.read(chunk)) > 0) {
        total += read;
        if (total > MAX_BYTES) break;
        buffer.write(chunk, 0, read);
      }
      names.add(name);
      blobs.add(buffer.toByteArray());
    }
    zip.close();
    if (names.isEmpty()) throw new Exception("That zip has no files inside.");

    String root = sharedRoot(names);
    if (root.length() > 0) result.name = sanitize(root);

    for (int i = 0; i < names.size(); i++) {
      String path = names.get(i);
      if (root.length() > 0 && path.startsWith(root + "/")) {
        path = path.substring(root.length() + 1);
      }
      if (path.length() == 0) continue;
      byte[] bytes = blobs.get(i);
      Entry file = new Entry();
      file.path = path;
      String text = asText(bytes);
      if (text != null) {
        file.text = text;
      } else {
        file.base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
      }
      result.files.add(file);
    }
    if (result.files.isEmpty()) throw new Exception("That zip has no files inside.");
    return result;
  }

  public static String sanitize(String value) {
    if (value == null) return "project";
    String cleaned = value.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("-{2,}", "-");
    cleaned = cleaned.replaceAll("^[-.]+", "");
    cleaned = cleaned.replaceAll("[-.]+$", "");
    return cleaned.length() == 0 ? "project" : cleaned;
  }

  private static boolean skip(String name) {
    String lower = name.toLowerCase();
    return name.length() == 0
        || lower.startsWith("__macosx/")
        || lower.endsWith(".ds_store")
        || lower.startsWith(".git/")
        || lower.startsWith("node_modules/")
        || lower.startsWith(".gradle/")
        || lower.startsWith("build/")
        || lower.startsWith(".idea/");
  }

  private static String sharedRoot(List<String> names) {
    String root = null;
    for (String name : names) {
      int slash = name.indexOf('/');
      String head = slash < 0 ? "" : name.substring(0, slash);
      if (head.length() == 0) return "";
      if (root == null) {
        root = head;
      } else if (!root.equals(head)) {
        return "";
      }
    }
    return root == null ? "" : root;
  }

  private static String asText(byte[] bytes) {
    if (bytes.length == 0) return "";
    for (byte b : bytes) {
      if (b == 0) return null;
    }
    String text = new String(bytes, StandardCharsets.UTF_8);
    return text.indexOf('\uFFFD') >= 0 ? null : text;
  }
}