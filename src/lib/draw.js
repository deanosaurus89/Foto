import { coverRect } from "./crop.js";

export function drawImageCover(ctx, image, dx, dy, dw, dh, crop) {
  const iw = image.width;
  const ih = image.height;
  if (!(iw > 0) || !(ih > 0) || !(dw > 0) || !(dh > 0)) return;
  const { sx, sy, sw, sh } = coverRect(iw, ih, dw, dh, crop);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function renderComposition(ctx, layout, photos, bg, selectedIndex = -1) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bg || "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  for (const tile of layout.tiles) {
    const photo = photos[tile.imageIndex];
    if (!photo?.image) {
      ctx.fillStyle = "rgba(31, 26, 23, 0.06)";
      ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    } else {
      drawImageCover(ctx, photo.image, tile.x, tile.y, tile.w, tile.h, photo.crop);
    }
    if (tile.imageIndex === selectedIndex && photo?.image) {
      ctx.save();
      ctx.strokeStyle = "#1f1a17";
      ctx.lineWidth = Math.max(2, Math.round(Math.min(tile.w, tile.h) * 0.012));
      const inset = ctx.lineWidth / 2;
      ctx.strokeRect(tile.x + inset, tile.y + inset, tile.w - ctx.lineWidth, tile.h - ctx.lineWidth);
      ctx.restore();
    }
  }
}

export function renderToCanvas(layout, photos, bg) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, layout.width);
  canvas.height = Math.max(1, layout.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  renderComposition(ctx, layout, photos, bg, -1);
  return canvas;
}
