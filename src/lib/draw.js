import { coverRect } from "./crop.js";

export function drawImageCover(ctx, image, dx, dy, dw, dh, crop) {
  const iw = image.width;
  const ih = image.height;
  if (!(iw > 0) || !(ih > 0) || !(dw > 0) || !(dh > 0)) return;
  const { sx, sy, sw, sh } = coverRect(iw, ih, dw, dh, crop);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

function tileSelected(tile, selected) {
  if (selected == null || selected === -1) return false;
  if (Array.isArray(selected)) return selected.includes(tile.id);
  if (typeof selected === "string") return tile.id === selected;
  return tile.imageIndex === selected;
}

function traceRoundRect(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.roundRect(x, y, w, h, r);
}

export function renderComposition(ctx, layout, photos, bg, selected = -1, radius = 0) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg || "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  for (const tile of layout.tiles) {
    const photo = photos[tile.imageIndex];
    ctx.save();
    traceRoundRect(ctx, tile.x, tile.y, tile.w, tile.h, radius);
    ctx.clip();
    if (!photo?.image) {
      ctx.fillStyle = "rgba(31, 26, 23, 0.06)";
      ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    } else {
      drawImageCover(ctx, photo.image, tile.x, tile.y, tile.w, tile.h, photo.crop);
    }
    ctx.restore();
    if (tileSelected(tile, selected)) {
      ctx.save();
      ctx.strokeStyle = "#1f1a17";
      ctx.lineWidth = Math.max(2, Math.round(Math.min(tile.w, tile.h) * 0.012));
      traceRoundRect(ctx, tile.x + 1, tile.y + 1, tile.w - 2, tile.h - 2, Math.max(0, radius - 1));
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function renderToCanvas(layout, photos, bg, radius = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, layout.width);
  canvas.height = Math.max(1, layout.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  renderComposition(ctx, layout, photos, bg, -1, radius);
  return canvas;
}
