import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const r = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Rounded rect distance
      const dx = Math.max(r - x, 0, x - (size - 1 - r));
      const dy = Math.max(r - y, 0, y - (size - 1 - r));
      const dist = Math.hypot(dx, dy);

      if (dist > r + 0.5) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }

      // Background gradient (#404E82 -> #27325B)
      const t = (x + y) / (2 * size);
      let cr = Math.round(64 * (1 - t) + 39 * t);
      let cg = Math.round(78 * (1 - t) + 50 * t);
      let cb = Math.round(130 * (1 - t) + 91 * t);

      const nx = x / size;
      const ny = y / size;

      // Inner white spreadsheet card
      const inCard = nx >= 0.2 && nx <= 0.72 && ny >= 0.18 && ny <= 0.82;
      if (inCard) {
        cr = 255;
        cg = 255;
        cb = 255;
        // Header bar inside card
        if (ny <= 0.32) {
          cr = 219;
          cg = 228;
          cb = 255;
        }
        // Grid lines
        const isRowLine = Math.abs(ny - 0.48) < 0.025 || Math.abs(ny - 0.65) < 0.025;
        const isColLine = Math.abs(nx - 0.44) < 0.025;
        if ((isRowLine || isColLine) && ny > 0.32) {
          cr = 180;
          cg = 194;
          cb = 228;
        }
      }

      // Emerald badge circle in bottom-right
      const cx = 0.72;
      const cy = 0.72;
      const badgeDist = Math.hypot(nx - cx, ny - cy);
      if (badgeDist <= 0.21) {
        cr = 16;
        cg = 185;
        cb = 129;
        // White check mark inside circle
        const d1 = Math.abs((nx - 0.65) * 0.9 - (ny - 0.73) * 0.9);
        const d2 = Math.abs((nx - 0.71) * 0.75 + (ny - 0.79) * 0.75);
        if (
          (nx >= 0.62 && nx <= 0.72 && ny >= 0.68 && ny <= 0.81 && d1 < 0.032) ||
          (nx >= 0.70 && nx <= 0.83 && ny >= 0.63 && ny <= 0.81 && d2 < 0.032)
        ) {
          cr = 255;
          cg = 255;
          cb = 255;
        }
      }

      rgba[idx] = cr;
      rgba[idx + 1] = cg;
      rgba[idx + 2] = cb;
      rgba[idx + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

export function generateIcons(targetDir) {
  const iconsDir = path.join(targetDir, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of [16, 48, 128]) {
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), renderIcon(size));
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  for (const dir of process.argv.slice(2)) {
    generateIcons(dir);
  }
}
