import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, px) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(px.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function surface(width, height) {
  const px = new Uint8Array(width * height * 4);
  return {
    px,
    fill(r, g, b) {
      for (let i = 0; i < px.length; i += 4) {
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    },
    pixel(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= width || y >= height || a <= 0) return;
      const i = (y * width + x) * 4;
      const aa = a / 255;
      px[i] = Math.round(r * aa + px[i] * (1 - aa));
      px[i + 1] = Math.round(g * aa + px[i + 1] * (1 - aa));
      px[i + 2] = Math.round(b * aa + px[i + 2] * (1 - aa));
      px[i + 3] = 255;
    },
  };
}

function fillRoundRect(s, x, y, rw, rh, rad, col) {
  const r = Math.min(rad, rw / 2, rh / 2);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + rw);
  const y1 = Math.ceil(y + rh);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const px = xx + 0.5;
      const py = yy + 0.5;
      if (px < x || py < y || px > x + rw || py > y + rh) continue;
      const cx = Math.min(Math.max(px, x + r), x + rw - r);
      const cy = Math.min(Math.max(py, y + r), y + rh - r);
      const dist = Math.hypot(px - cx, py - cy);
      const alpha = Math.min(1, Math.max(0, r - dist + 0.75));
      if (alpha <= 0) continue;
      s.pixel(xx, yy, col[0], col[1], col[2], Math.round(alpha * 255));
    }
  }
}

const INK = [31, 26, 23];
const CREAM = [243, 239, 230];
const PAPER = [243, 240, 234];
const ACCENT = [196, 91, 69];

function drawMark(s, ox, oy, size) {
  const gap = size * 0.045;
  const tile = (size - gap) / 2;
  const rad = size * 0.08;
  fillRoundRect(s, ox, oy, tile, tile, rad, CREAM);
  fillRoundRect(s, ox + tile + gap, oy, tile, tile, rad, CREAM);
  fillRoundRect(s, ox, oy + tile + gap, tile, tile, rad, CREAM);
  fillRoundRect(s, ox + tile + gap, oy + tile + gap, tile, tile, rad, ACCENT);
}

function appIcon(size, { maskable = false } = {}) {
  const s = surface(size, size);
  s.fill(...INK);
  const pad = maskable ? size * 0.22 : size * 0.16;
  drawMark(s, pad, pad, size - pad * 2);
  return encodePNG(size, size, s.px);
}

function splash(width, height) {
  const s = surface(width, height);
  s.fill(...PAPER);
  const box = Math.round(Math.min(width, height) * 0.22);
  const x = Math.round((width - box) / 2);
  const y = Math.round((height - box) / 2 - height * 0.04);
  fillRoundRect(s, x, y, box, box, box * 0.22, INK);
  const inset = box * 0.18;
  drawMark(s, x + inset, y + inset, box - inset * 2);
  return encodePNG(width, height, s.px);
}

fs.writeFileSync(path.join(outDir, "icon-192.png"), appIcon(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), appIcon(512));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), appIcon(512, { maskable: true }));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), appIcon(180));
fs.writeFileSync(path.join(outDir, "splash-1290x2796.png"), splash(1290, 2796));
console.log("icons written");
