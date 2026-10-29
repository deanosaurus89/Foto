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
      ctx.fillStyle = "rgba(20, 92, 255, 0.38)";
      traceRoundRect(ctx, tile.x, tile.y, tile.w, tile.h, radius);
      ctx.fill();
      const outer = Math.max(10, Math.round(Math.min(tile.w, tile.h) * 0.07));
      ctx.lineWidth = outer;
      ctx.strokeStyle = "#ffffff";
      traceRoundRect(ctx, tile.x + outer / 2, tile.y + outer / 2, tile.w - outer, tile.h - outer, Math.max(0, radius - outer / 2));
      ctx.stroke();
      ctx.lineWidth = Math.max(6, Math.round(outer * 0.62));
      ctx.strokeStyle = "#145cff";
      ctx.stroke();
      const badge = Math.max(22, Math.round(Math.min(tile.w, tile.h) * 0.18));
      const bx = tile.x + badge * 0.55;
      const by = tile.y + badge * 0.55;
      ctx.beginPath();
      ctx.fillStyle = "#145cff";
      ctx.arc(bx, by, badge * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(3, badge * 0.12);
      ctx.strokeStyle = "#ffffff";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(bx - badge * 0.18, by);
      ctx.lineTo(bx - badge * 0.04, by + badge * 0.16);
      ctx.lineTo(bx + badge * 0.2, by - badge * 0.16);
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
