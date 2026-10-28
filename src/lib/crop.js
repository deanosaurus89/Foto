/** Normalized cover-crop: scale 1 fills the tile, focus is the crop center (0–1). */

export const MIN_SCALE = 1;
export const MAX_SCALE = 3;

export function defaultCrop() {
  return { scale: 1, focusX: 0.5, focusY: 0.5 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Source rectangle for drawImage, in source pixels.
 * Destination size is the tile; the source always covers it.
 */
export function coverRect(iw, ih, dw, dh, crop = defaultCrop()) {
  const scale = clamp(crop.scale || 1, MIN_SCALE, MAX_SCALE);
  const focusX = crop.focusX ?? 0.5;
  const focusY = crop.focusY ?? 0.5;
  if (!(iw > 0) || !(ih > 0) || !(dw > 0) || !(dh > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(iw, 0), sh: Math.max(ih, 0) };
  }
  const base = Math.max(dw / iw, dh / ih);
  const s = base * scale;
  let sw = dw / s;
  let sh = dh / s;
  if (sw > iw) sw = iw;
  if (sh > ih) sh = ih;
  const sx = clamp(focusX * iw - sw / 2, 0, Math.max(0, iw - sw));
  const sy = clamp(focusY * ih - sh / 2, 0, Math.max(0, ih - sh));
  return { sx, sy, sw, sh };
}

/** Snap focus so a later coverRect call matches the clamped window. */
export function clampCrop(crop, iw, ih, dw, dh) {
  const scale = clamp(crop?.scale || 1, MIN_SCALE, MAX_SCALE);
  const rect = coverRect(iw, ih, dw, dh, {
    scale,
    focusX: crop?.focusX ?? 0.5,
    focusY: crop?.focusY ?? 0.5,
  });
  return {
    scale,
    focusX: iw > 0 ? (rect.sx + rect.sw / 2) / iw : 0.5,
    focusY: ih > 0 ? (rect.sy + rect.sh / 2) / ih : 0.5,
  };
}

/** Finger move in destination pixels. Positive dx moves the image right. */
export function panCrop(crop, dx, dy, iw, ih, dw, dh) {
  const base = Math.max(dw / iw, dh / ih);
  const s = base * clamp(crop?.scale || 1, MIN_SCALE, MAX_SCALE);
  return clampCrop(
    {
      scale: crop?.scale || 1,
      focusX: (crop?.focusX ?? 0.5) - dx / s / iw,
      focusY: (crop?.focusY ?? 0.5) - dy / s / ih,
    },
    iw,
    ih,
    dw,
    dh,
  );
}

export function setCropScale(crop, scale, iw, ih, dw, dh) {
  return clampCrop({ ...crop, scale }, iw, ih, dw, dh);
}
