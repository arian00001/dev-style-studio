package com.devstyle.studio;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Uploads template artwork to ImgBB and reads it back for the preview. */
public class ImgBb {

  public interface Upload {
    void onSuccess(String url);

    void onError(String message);
  }

  public interface BitmapListener {
    void onBitmap(Bitmap bitmap);
  }

  private static final ExecutorService POOL = Executors.newFixedThreadPool(2);
  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  public static void upload(final String key, final byte[] bytes, final Upload callback) {
    if (key == null || key.trim().length() == 0) {
      callback.onError("Add your ImgBB API key first.");
      return;
    }
    if (bytes == null || bytes.length == 0) {
      callback.onError("That image could not be read.");
      return;
    }
    POOL.execute(() -> {
      HttpURLConnection conn = null;
      try {
        String encoded = URLEncoder.encode(Base64.encodeToString(bytes, Base64.NO_WRAP), "UTF-8");
        URL url = new URL("https://api.imgbb.com/1/upload?key=" + key.trim());
        conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        OutputStream out = conn.getOutputStream();
        out.write(("image=" + encoded).getBytes("UTF-8"));
        out.close();

        int code = conn.getResponseCode();
        InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        String text = read(stream);
        if (code < 200 || code >= 300) {
          final String message = "ImgBB returned " + code;
          MAIN.post(() -> callback.onError(message));
          return;
        }
        JSONObject body = new JSONObject(text);
        JSONObject data = body.optJSONObject("data");
        String link = data == null ? "" : data.optString("url", "");
        if (link.trim().length() == 0) {
          MAIN.post(() -> callback.onError("ImgBB did not return an image link."));
          return;
        }
        final String finalLink = link;
        MAIN.post(() -> callback.onSuccess(finalLink));
      } catch (Exception e) {
        final String message = e.getMessage() == null ? e.toString() : e.getMessage();
        MAIN.post(() -> callback.onError(message));
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  /** Small async image fetch so the preview screen can show the uploaded artwork. */
  public static void loadBitmap(final String url, final BitmapListener listener) {
    if (url == null || url.trim().length() == 0) return;
    POOL.execute(() -> {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(url.trim()).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setInstanceFollowRedirects(true);
        // ImgBB sits behind Cloudflare, which rejects the default "Java/…" user agent.
        conn.setRequestProperty("User-Agent",
            "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 "
                + "(KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36");
        conn.setRequestProperty("Accept", "image/*,*/*;q=0.8");
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        InputStream in = conn.getInputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = in.read(chunk)) > 0) buffer.write(chunk, 0, read);
        in.close();
        byte[] bytes = buffer.toByteArray();
        Bitmap bitmap = bytes.length == 0 ? null : BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap != null) {
          final Bitmap loaded = bitmap;
          MAIN.post(() -> listener.onBitmap(loaded));
        }
      } catch (Exception ignored) {
        // preview simply stays without the image
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  private static String read(InputStream in) throws Exception {
    if (in == null) return "";
    BufferedReader reader = new BufferedReader(new InputStreamReader(in, "UTF-8"));
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) sb.append(line).append('\n');
    reader.close();
    return sb.toString();
  }
}