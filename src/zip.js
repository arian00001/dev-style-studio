// Minimal, dependency-free ZIP reader that works on a File without loading it all
// into memory: the central directory is read first, and each entry is inflated
// on demand with DecompressionStream('deflate-raw').

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOC = 0x07064b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const SKIP = /(^|\/)(__MACOSX|\.git|node_modules)(\/|$)|(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/i;

async function slice(file, start, end) {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

function safePath(name) {
  const cleaned = name.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = [];
  for (const part of cleaned.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return null;
    parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

function stripCommonRoot(entries) {
  const tops = new Set(entries.map((e) => e.path.split("/")[0]));
  if (tops.size !== 1) return entries;
  if (!entries.every((e) => e.path.includes("/"))) return entries;
  const top = [...tops][0];
  const stripped = entries
    .map((e) => ({ ...e, path: e.path.slice(top.length + 1) }))
    .filter((e) => e.path);
  return stripped.length ? stripped : entries;
}

function readZip64Extra(cd, start, end, sizes) {
  let p = start;
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  while (p + 4 <= end) {
    const id = view.getUint16(p, true);
    const len = view.getUint16(p + 2, true);
    if (id === 0x0001) {
      let q = p + 4;
      if (sizes.uncompressed === 0xffffffff) {
        sizes.uncompressed = Number(view.getBigUint64(q, true));
        q += 8;
      }
      if (sizes.compressed === 0xffffffff) {
        sizes.compressed = Number(view.getBigUint64(q, true));
        q += 8;
      }
      if (sizes.offset === 0xffffffff) {
        sizes.offset = Number(view.getBigUint64(q, true));
        q += 8;
      }
      return sizes;
    }
    p += 4 + len;
  }
  return sizes;
}

export async function parseZip(file, onProgress) {
  if (!file || file.size < 22) throw new Error("That file is not a valid ZIP archive.");

  const tailLen = Math.min(file.size, 66000);
  const tail = await slice(file, file.size - tailLen, file.size);
  const tv = new DataView(tail.buffer);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("That file is not a valid ZIP archive.");

  let count = tv.getUint16(eocd + 10, true);
  let cdSize = tv.getUint32(eocd + 12, true);
  let cdOffset = tv.getUint32(eocd + 16, true);

  if (cdOffset === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (loc >= 0 && tv.getUint32(loc, true) === SIG_EOCD64_LOC) {
      const z64Offset = Number(tv.getBigUint64(loc + 8, true));
      const z64 = await slice(file, z64Offset, z64Offset + 56);
      const zv = new DataView(z64.buffer);
      if (zv.getUint32(0, true) === SIG_EOCD64) {
        count = Number(zv.getBigUint64(32, true));
        cdSize = Number(zv.getBigUint64(40, true));
        cdOffset = Number(zv.getBigUint64(48, true));
      }
    }
  }

  if (!count) throw new Error("This archive is empty.");
  if (cdOffset + cdSize > file.size) throw new Error("This archive looks truncated or corrupt.");

  const cd = await slice(file, cdOffset, cdOffset + cdSize);
  const cv = new DataView(cd.buffer);
  const decoder = new TextDecoder("utf-8");
  const entries = [];
  let p = 0;

  for (let i = 0; i < count && p + 46 <= cd.length; i += 1) {
    if (cv.getUint32(p, true) !== SIG_CD) break;
    const method = cv.getUint16(p + 10, true);
    const nameLen = cv.getUint16(p + 28, true);
    const extraLen = cv.getUint16(p + 30, true);
    const commentLen = cv.getUint16(p + 32, true);
    const sizes = {
      compressed: cv.getUint32(p + 20, true),
      uncompressed: cv.getUint32(p + 24, true),
      offset: cv.getUint32(p + 42, true),
    };
    const nameStart = p + 46;
    const rawName = decoder.decode(cd.subarray(nameStart, nameStart + nameLen));
    const isDir = rawName.endsWith("/") || rawName.endsWith("\\");

    if (sizes.offset === 0xffffffff || sizes.compressed === 0xffffffff || sizes.uncompressed === 0xffffffff) {
      readZip64Extra(cd, nameStart + nameLen, nameStart + nameLen + extraLen, sizes);
    }

    p += 46 + nameLen + extraLen + commentLen;

    if (isDir) continue;
    if (SKIP.test(rawName)) continue;
    const path = safePath(rawName);
    if (!path) continue;

    entries.push({
      path,
      method,
      compressedSize: sizes.compressed,
      uncompressedSize: sizes.uncompressed,
      localOffset: sizes.offset,
    });
  }

  if (!entries.length) throw new Error("No usable files were found in this archive.");

  const unique = stripCommonRoot(entries);

  async function readEntry(entry) {
    const head = await slice(file, entry.localOffset, entry.localOffset + 30);
    if (head.length < 30) throw new Error(`Corrupt entry: ${entry.path}`);
    const hv = new DataView(head.buffer);
    if (hv.getUint32(0, true) !== SIG_LOCAL) throw new Error(`Corrupt entry: ${entry.path}`);
    const nameLen = hv.getUint16(26, true);
    const extraLen = hv.getUint16(28, true);
    const start = entry.localOffset + 30 + nameLen + extraLen;
    const raw = await slice(file, start, start + entry.compressedSize);
    if (entry.method === 0) return raw;
    if (entry.method !== 8) throw new Error(`Unsupported compression for ${entry.path}`);
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  if (onProgress) onProgress(100);

  return { entries: unique, readEntry };
}