import { defaultCrop, panCrop, setCropScale } from "./lib/crop.js";
import { drawImageCover, renderComposition, renderToCanvas } from "./lib/draw.js";
import { canvasToJpegBlob } from "./lib/exif.js";
import { MAX_PHOTOS, loadPhoto } from "./lib/images.js";
import {
  MAX_GRID,
  cellsForPreset,
  clearCell,
  evenPackCol,
  evenPackRow,
  fitCellsToGrid,
  growCell,
  hitTest,
  hitUnit,
  placeCell,
  resolveCollageLayout,
  resolveCombineLayout,
  shrinkCell,
} from "./lib/layout.js";
import {
  exportFilename,
  midpointDate,
  resolveMetadata,
  toDatetimeLocalValue,
} from "./lib/metadata.js";
import { registerServiceWorker } from "./pwa.js";
import {
  editorHTML,
  homeHTML,
  IOS_SAVE_HINT,
  isIosDevice,
  layoutWarning,
  messagesHTML,
  metaOptionsHTML,
  metadataSummary,
  pickHTML,
  resultHTML,
  thumbHTML,
} from "./ui.js";

const ASPECTS = [1, 4 / 5, 3 / 2, 16 / 9];

function createState() {
  return {
    screen: "home",
    mode: "combine",
    photos: [],
    messages: [],
    status: "",
    loading: false,
    selected: 0,
    combine: {
      direction: "horizontal",
      resolutionMode: "edge",
      resolution: 1600,
      aspect: 1,
      gap: 24,
      margin: 24,
      symmetric: true,
      bg: "#ffffff",
    },
    collage: {
      preset: "2x2",
      rows: 2,
      cols: 2,
      cells: null,
      activeId: null,
      resolutionMode: "cell",
      cell: 1200,
      longSide: 2400,
      gap: 24,
      margin: 24,
      symmetric: true,
      bg: "#ffffff",
    },
    meta: {
      dateMode: "mid",
      dateIndex: 0,
      customDate: "",
      gpsMode: "first",
      gpsIndex: 0,
      quality: "0.92",
    },
    exporting: false,
    lastExport: null,
  };
}

const state = createState();

function settings() {
  return state.mode === "collage" ? state.collage : state.combine;
}

function cssColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
}

function ensureCollageModel() {
  const collage = state.collage;
  if (Array.isArray(collage.cells)) return;
  const made = cellsForPreset(collage.preset, collage.rows, collage.cols);
  collage.rows = made.rows;
  collage.cols = made.cols;
  collage.cells = made.cells;
  collage.activeId = made.cells[0]?.id ?? null;
}

function currentLayout() {
  if (state.mode === "collage") {
    ensureCollageModel();
    return resolveCollageLayout(state.collage);
  }
  return resolveCombineLayout(state.combine, state.photos.length);
}

function activeCollageCell() {
  ensureCollageModel();
  return state.collage.cells.find((cell) => cell.id === state.collage.activeId) || null;
}

function frameFor(index, layout) {
  if (state.mode === "collage" && state.collage.activeId) {
    const active = layout.tiles.find((item) => item.id === state.collage.activeId);
    if (active?.w > 0 && active?.h > 0) return { w: active.w, h: active.h };
  }
  const tile = layout.tiles.find((item) => item.imageIndex === index);
  if (tile) return { w: tile.w, h: tile.h };
  if (layout.tileW && layout.tileH) return { w: layout.tileW, h: layout.tileH };
  const cell = layout.cell || 1000;
  return { w: cell, h: cell };
}

function exportBlocked() {
  const count = state.photos.length;
  if (state.loading || state.exporting) return true;
  if (count < 2) return true;
  if (state.mode === "combine" && count > 10) return true;
  return false;
}

function markDirty() {
  if (state.lastExport?.url) URL.revokeObjectURL(state.lastExport.url);
  state.lastExport = null;
  const host = document.getElementById("result");
  if (host) {
    host.hidden = true;
    host.replaceChildren();
  }
}

function render() {
  const app = document.getElementById("app");
  if (state.screen === "home") app.innerHTML = homeHTML();
  else if (state.screen === "pick") app.innerHTML = pickHTML(state);
  else app.innerHTML = editorHTML(state);
  if (state.screen === "pick") paintMessages();
  if (state.screen === "edit") {
    wireEditor();
    drawAll();
  }
}

function paintMessages() {
  const host = document.getElementById("messages");
  if (!host) return;
  host.innerHTML = messagesHTML(state.messages);
  host.hidden = state.messages.length === 0;
}

function setStatus(text) {
  state.status = text;
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

function nearestAspect(value) {
  return ASPECTS.reduce((best, item) =>
    Math.abs(item - value) < Math.abs(best - value) ? item : best,
  );
}

function press(action, value, compare) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((el) => {
    const on = compare ? compare(el) : el.dataset.value === String(value);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function syncFrameLabels() {
  const current = settings();
  const gapName = document.getElementById("gap-name");
  if (gapName) gapName.textContent = current.symmetric ? "Rahmenbreite" : "Abstand";
  const gapValue = document.getElementById("gap-value");
  if (gapValue) gapValue.textContent = `${current.gap} px`;
  const marginValue = document.getElementById("margin-value");
  if (marginValue) marginValue.textContent = `${current.margin} px`;
  const marginWrap = document.getElementById("margin-wrap");
  if (marginWrap) marginWrap.hidden = current.symmetric;
  const resLabel = document.getElementById("res-label");
  if (resLabel) resLabel.textContent = resolutionLabel();
}

function resolutionLabel() {
  const current = settings();
  if (state.mode === "collage") {
    return current.resolutionMode === "long" ? "Lange Seite" : "Kachelkante";
  }
  if (current.resolutionMode === "width") return "Breite des Ergebnisses";
  if (current.resolutionMode === "height") return "Höhe des Ergebnisses";
  return "Kantenlänge der Kachel";
}

function syncMetaOptions() {
  const { date, gps } = metaOptionsHTML(state.photos);
  const dateSel = document.getElementById("date-index");
  const gpsSel = document.getElementById("gps-index");
  if (dateSel) {
    dateSel.innerHTML = date;
    if (!state.photos[state.meta.dateIndex]?.date) {
      const first = state.photos.findIndex((photo) => photo.date);
      if (first >= 0) state.meta.dateIndex = first;
    }
    if (dateSel.options.length) dateSel.value = String(state.meta.dateIndex);
  }
  if (gpsSel) {
    gpsSel.innerHTML = gps;
    if (!state.photos[state.meta.gpsIndex]?.gps) {
      const first = state.photos.findIndex((photo) => photo.gps);
      if (first >= 0) state.meta.gpsIndex = first;
    }
    if (gpsSel.options.length) gpsSel.value = String(state.meta.gpsIndex);
  }
  syncMetaVisibility();
  updateMetaSummary();
}

function syncMetaVisibility() {
  const datePick = document.getElementById("date-pick-wrap");
  const custom = document.getElementById("custom-date-wrap");
  const gpsPick = document.getElementById("gps-pick-wrap");
  if (datePick) datePick.hidden = state.meta.dateMode !== "pick";
  if (custom) custom.hidden = state.meta.dateMode !== "custom";
  if (gpsPick) gpsPick.hidden = state.meta.gpsMode !== "pick";
}

function updateMetaSummary() {
  const el = document.getElementById("meta-summary");
  if (!el || !state.photos.length) return;
  el.textContent = metadataSummary(resolveMetadata(state.photos, state.meta));
}

function updateExportEnabled() {
  const blocked = exportBlocked();
  for (const id of ["export", "share"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = blocked;
  }
}

function scaleLayout(layout, scale) {
  const round = (n) => Math.max(0, Math.round(n * scale));
  return {
    width: Math.max(1, Math.round(layout.width * scale)),
    height: Math.max(1, Math.round(layout.height * scale)),
    tiles: layout.tiles.map((tile) => ({
      ...tile,
      x: round(tile.x),
      y: round(tile.y),
      w: Math.max(1, Math.round(tile.w * scale)),
      h: Math.max(1, Math.round(tile.h * scale)),
    })),
  };
}

function drawPreview() {
  const canvas = document.getElementById("preview");
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (wrap.clientWidth < 2) {
    requestAnimationFrame(drawPreview);
    return;
  }
  const layout = currentLayout();
  const scale = wrap.clientWidth / layout.width;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(1, Math.round(layout.width * scale));
  const cssH = Math.max(1, Math.round(layout.height * scale));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = canvas.getContext("2d", { alpha: false });
  const mark = state.mode === "collage" ? state.collage.activeId : state.selected;
  renderComposition(ctx, scaleLayout(layout, scale * dpr), state.photos, cssColor(settings().bg), mark);
  const label = document.getElementById("size-label");
  if (label) {
    const limited = layout.limited ? " · für Safari begrenzt" : "";
    label.textContent =
      state.mode === "combine"
        ? `Kachel ${layout.tileW} × ${layout.tileH} px · Ausgabe ${layout.width} × ${layout.height} px${limited}`
        : `${layout.tiles.length} Felder · Ausgabe ${layout.width} × ${layout.height} px${limited}`;
  }
  const warning = document.getElementById("layout-warning");
  if (warning) {
    const text = layoutWarning(layout, state.photos.length, state.mode);
    warning.hidden = !text;
    warning.textContent = text;
  }
  updateExportEnabled();
  updateMetaSummary();
  syncFrameLabels();
}

function sizeCropper(canvas, aspect) {
  const maxW = canvas.parentElement?.clientWidth || 320;
  const maxH = 380;
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const nextW = Math.max(1, Math.round(width * dpr));
  const nextH = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${Math.round(width)}px`;
  canvas.style.height = `${Math.round(height)}px`;
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }
}

function drawCropper() {
  const canvas = document.getElementById("cropper");
  const photo = state.photos[state.selected];
  if (!canvas) return;
  const frame = frameFor(state.selected, currentLayout());
  sizeCropper(canvas, frame.w / frame.h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1f1a17";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (photo?.image) {
    drawImageCover(ctx, photo.image, 0, 0, canvas.width, canvas.height, photo.crop);
  }
}

function paintThumbs() {
  const layout = currentLayout();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  document.querySelectorAll("canvas.thumb-canvas").forEach((canvas) => {
    const index = Number(canvas.dataset.index);
    const photo = state.photos[index];
    const frame = frameFor(index, layout);
    const aspect = frame.w / Math.max(1, frame.h);
    const maxW = 148;
    const maxH = 156;
    let cssW = maxW;
    let cssH = cssW / aspect;
    if (cssH > maxH) {
      cssH = maxH;
      cssW = maxH * aspect;
    }
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = `${Math.round(cssW)}px`;
    canvas.style.height = `${Math.round(cssH)}px`;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e7e1d8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (photo?.image) drawImageCover(ctx, photo.image, 0, 0, canvas.width, canvas.height, photo.crop);
  });
}

function refreshThumbs() {
  const host = document.getElementById("thumbs");
  if (!host) return;
  const layout = currentLayout();
  const used = new Set(
    layout.tiles
      .map((tile) => tile.imageIndex)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < state.photos.length),
  );
  host.innerHTML = state.photos
    .map((photo, index) =>
      thumbHTML(photo, index, {
        selected: index === state.selected,
        unused: state.mode === "collage" ? !used.has(index) : state.photos.length > layout.tiles.length && !used.has(index),
      }),
    )
    .join("");
  paintThumbs();
  syncSelection();
}

function syncSelection() {
  document.querySelectorAll(".thumb").forEach((el) => {
    const button = el.querySelector("[data-action='select']");
    const index = Number(button?.dataset.index);
    const on = index === state.selected;
    el.classList.toggle("selected", on);
    button?.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const photo = state.photos[state.selected];
  const label = document.getElementById("crop-label");
  if (label) {
    label.textContent = photo ? `Foto ${state.selected + 1} von ${state.photos.length}` : "Kein Foto";
  }
  const slider = document.getElementById("zoom");
  const zoomValue = document.getElementById("zoom-value");
  if (photo && slider) slider.value = String(photo.crop.scale);
  if (zoomValue) zoomValue.textContent = `${(photo?.crop.scale ?? 1).toFixed(2)}×`;
}

function syncCellTools() {
  const el = document.getElementById("cell-label");
  if (!el || state.mode !== "collage") return;
  const cell = state.collage.cells?.find((item) => item.id === state.collage.activeId);
  if (!cell) {
    el.textContent = "Tippe ein Feld in der Vorschau an.";
    return;
  }
  const photo = Number.isInteger(cell.imageIndex) ? state.photos[cell.imageIndex] : null;
  const shape =
    cell.pack === "row"
      ? "ganze Zeile, gleichmäßig"
      : cell.pack === "col"
        ? "ganze Spalte, gleichmäßig"
        : `${cell.colSpan}×${cell.rowSpan} im Raster`;
  el.textContent = photo ? `${shape} · Foto ${cell.imageIndex + 1}` : `${shape} · kein Foto`;
}

function drawAll() {
  if (state.screen !== "edit") return;
  drawPreview();
  drawCropper();
  paintThumbs();
  syncSelection();
  syncCellTools();
}

function releasePhotos(photos) {
  for (const photo of photos) photo.image?.close?.();
}

function remapCellsAfterRemove(index) {
  if (!state.collage.cells) return;
  for (const cell of state.collage.cells) {
    if (cell.imageIndex === index) cell.imageIndex = null;
    else if (Number.isInteger(cell.imageIndex) && cell.imageIndex > index) cell.imageIndex -= 1;
  }
}

function remapCellsAfterMove(from, to) {
  if (!state.collage.cells) return;
  for (const cell of state.collage.cells) {
    if (cell.imageIndex === from) cell.imageIndex = to;
    else if (cell.imageIndex === to) cell.imageIndex = from;
  }
}

function removePhoto(index) {
  const [removed] = state.photos.splice(index, 1);
  removed?.image?.close?.();
  remapCellsAfterRemove(index);
  if (state.selected >= state.photos.length) state.selected = Math.max(0, state.photos.length - 1);
  markDirty();
  if (state.screen === "pick") render();
  else {
    refreshThumbs();
    syncMetaOptions();
    drawAll();
  }
}

function movePhoto(index, dir) {
  const next = index + dir;
  if (next < 0 || next >= state.photos.length) return;
  const [item] = state.photos.splice(index, 1);
  state.photos.splice(next, 0, item);
  remapCellsAfterMove(index, next);
  if (state.selected === index) state.selected = next;
  else if (state.selected === next) state.selected = index;
  markDirty();
  refreshThumbs();
  syncMetaOptions();
  drawAll();
}

async function addFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length || state.loading) return;
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) {
    state.messages.push(`Höchstens ${MAX_PHOTOS} Fotos. Entferne bitte zuerst welche.`);
    paintMessages();
    return;
  }
  const slice = files.slice(0, room);
  if (files.length > room) {
    state.messages.push(`Es werden höchstens ${MAX_PHOTOS} Fotos geladen. ${files.length - room} wurden ausgelassen.`);
  }
  state.loading = true;
  updateExportEnabled();
  for (let i = 0; i < slice.length; i += 1) {
    setStatus(`Lese Foto ${i + 1} von ${slice.length} …`);
    try {
      state.photos.push(await loadPhoto(slice[i]));
    } catch (err) {
      state.messages.push(`${slice[i].name || "Foto"}: ${err.message || "Konnte nicht gelesen werden."}`);
    }
  }
  state.loading = false;
  setStatus("");
  markDirty();
  if (state.screen === "edit") {
    paintMessages();
    refreshThumbs();
    syncMetaOptions();
    drawAll();
  } else {
    render();
  }
}

function applyResolution(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return;
  const clamped = Math.min(8192, Math.max(256, n));
  const current = settings();
  if (state.mode === "collage") {
    if (current.resolutionMode === "long") current.longSide = clamped;
    else current.cell = clamped;
  } else {
    current.resolution = clamped;
  }
  const input = document.getElementById("resolution");
  if (input && Number(input.value) !== clamped) input.value = String(clamped);
  markDirty();
  drawAll();
}

function bindCropper(canvas) {
  const pointers = new Map();
  let gesture = null;

  const end = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) gesture = null;
    else if (pointers.size === 1) {
      const photo = state.photos[state.selected];
      gesture = photo ? { mode: "pan", crop: { ...photo.crop } } : null;
    }
  };

  canvas.addEventListener("pointerdown", (event) => {
    const photo = state.photos[state.selected];
    if (!photo?.image) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      gesture = {
        mode: "pinch",
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: photo.crop.scale,
        crop: { ...photo.crop },
      };
    } else {
      gesture = { mode: "pan", crop: { ...photo.crop } };
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    const prev = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const photo = state.photos[state.selected];
    if (!photo?.image) return;
    const frame = frameFor(state.selected, currentLayout());
    if (gesture.mode === "pan" && pointers.size === 1) {
      const rect = canvas.getBoundingClientRect();
      const dx = (event.clientX - prev.x) * (canvas.width / rect.width);
      const dy = (event.clientY - prev.y) * (canvas.height / rect.height);
      photo.crop = panCrop(
        photo.crop,
        dx,
        dy,
        photo.image.width,
        photo.image.height,
        canvas.width,
        canvas.height,
      );
    } else if (gesture.mode === "pinch" && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      photo.crop = setCropScale(
        gesture.crop,
        gesture.scale * (dist / gesture.dist),
        photo.image.width,
        photo.image.height,
        frame.w,
        frame.h,
      );
    } else {
      return;
    }
    markDirty();
    drawAll();
  });
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

function focusCollageTile(tile) {
  state.collage.activeId = tile.id;
  if (state.photos[tile.imageIndex]) state.selected = tile.imageIndex;
  syncSelection();
  drawPreview();
  drawCropper();
  syncCellTools();
}

function onPreviewPick(event) {
  const canvas = event.currentTarget;
  const layout = currentLayout();
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * layout.width;
  const y = ((event.clientY - rect.top) / rect.height) * layout.height;
  const tile = hitTest(layout, x, y);
  if (state.mode === "collage") {
    if (tile) {
      focusCollageTile(tile);
      return;
    }
    const unit = hitUnit(layout, x, y);
    if (!unit) return;
    const placed = placeCell(
      state.collage.cells,
      unit.col,
      unit.row,
      state.photos[state.selected] ? state.selected : 0,
      state.collage.rows,
      state.collage.cols,
    );
    if (!placed.ok) {
      syncCellTools();
      return;
    }
    const created = state.collage.cells.find((cell) => cell.id === placed.id);
    if (created) focusCollageTile({ id: created.id, imageIndex: created.imageIndex });
    markDirty();
    return;
  }
  if (!tile || !state.photos[tile.imageIndex]) return;
  state.selected = tile.imageIndex;
  syncSelection();
  drawPreview();
  drawCropper();
}

function wireEditor() {
  const cropper = document.getElementById("cropper");
  if (cropper) bindCropper(cropper);
  const preview = document.getElementById("preview");
  if (preview) preview.addEventListener("pointerdown", onPreviewPick);
  const hint = document.getElementById("save-hint");
  if (hint && isIosDevice()) {
    hint.hidden = false;
    hint.textContent = IOS_SAVE_HINT;
  }
  const shareButton = document.getElementById("share");
  if (shareButton && !isIosDevice()) shareButton.textContent = "Teilen";
  if (state.mode === "collage") {
    ensureCollageModel();
    const rowsLabel = document.getElementById("rows-value");
    const colsLabel = document.getElementById("cols-value");
    if (rowsLabel) rowsLabel.textContent = String(state.collage.rows);
    if (colsLabel) colsLabel.textContent = String(state.collage.cols);
  }
  syncMetaOptions();
  paintMessages();
  refreshThumbs();
}

function triggerDownload(file) {
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function showResult(file, { shared = false } = {}) {
  const host = document.getElementById("result");
  if (!host) return;
  host.hidden = false;
  host.innerHTML = resultHTML({
    name: file.name,
    exifError: file.exifError,
    ios: isIosDevice(),
    shared,
  });
  const img = document.getElementById("result-img");
  if (img) img.src = file.url;
  host.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function sharePayload(file) {
  return new File([file.blob], file.name, { type: "image/jpeg" });
}

function canShareFile(payload) {
  if (!navigator.share) return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare({ files: [payload] });
  } catch {
    return false;
  }
}

async function sharePrepared(file) {
  const payload = sharePayload(file);
  if (!canShareFile(payload)) return "unavailable";
  try {
    await navigator.share({ files: [payload], title: "Foto" });
    return "shared";
  } catch (err) {
    if (err?.name === "AbortError") return "abort";
    return "unavailable";
  }
}

async function composeExport() {
  if (exportBlocked()) throw new Error("blocked");
  state.exporting = true;
  updateExportEnabled();
  setStatus("Export läuft …");
  await new Promise((resolve) => setTimeout(resolve, 40));
  try {
    const layout = currentLayout();
    let canvas;
    try {
      canvas = renderToCanvas(layout, state.photos, cssColor(settings().bg));
    } catch {
      throw new Error("toBlob");
    }
    const resolved = resolveMetadata(state.photos, state.meta);
    const quality = Number(state.meta.quality) || 0.92;
    let packed;
    try {
      packed = await canvasToJpegBlob(canvas, { date: resolved.date, gps: resolved.gps.gps }, quality);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
    if (state.lastExport?.url) URL.revokeObjectURL(state.lastExport.url);
    const url = URL.createObjectURL(packed.blob);
    state.lastExport = {
      blob: packed.blob,
      name: exportFilename(state.mode, resolved.date),
      url,
      exifError: packed.exifError,
      resolved,
    };
    return state.lastExport;
  } finally {
    state.exporting = false;
    setStatus("");
    updateExportEnabled();
  }
}

function exportFailed(err) {
  state.messages.push(
    err?.message === "toBlob"
      ? "Das Bild ist zu groß für diesen Browser. Bitte die Auflösung verringern."
      : "Export ist fehlgeschlagen. Bitte die Auflösung verringern und es erneut versuchen.",
  );
  paintMessages();
}

async function onSave() {
  try {
    const file = await composeExport();
    if (isIosDevice()) {
      const outcome = await sharePrepared(file);
      showResult(file, { shared: outcome === "shared" });
      if (outcome === "unavailable") triggerDownload(file);
      return;
    }
    triggerDownload(file);
    showResult(file, { shared: false });
  } catch (err) {
    exportFailed(err);
  }
}

async function onShare() {
  try {
    const file = state.lastExport ?? (await composeExport());
    const outcome = await sharePrepared(file);
    showResult(file, { shared: outcome === "shared" });
    if (outcome === "unavailable") {
      state.messages.push("Teilen ist in diesem Browser nicht verfügbar. Die Datei wird geladen.");
      paintMessages();
      triggerDownload(file);
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
    state.messages.push("Teilen ist fehlgeschlagen.");
    paintMessages();
  }
}

async function onDownload() {
  try {
    const file = state.lastExport ?? (await composeExport());
    showResult(file, { shared: false });
    triggerDownload(file);
  } catch (err) {
    exportFailed(err);
  }
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !document.getElementById("app").contains(button)) return;
  const action = button.dataset.action;
  if (action === "mode-combine" || action === "mode-collage") {
    state.mode = action === "mode-collage" ? "collage" : "combine";
    state.screen = state.photos.length >= 2 ? "edit" : "pick";
    state.selected = Math.min(state.selected, Math.max(0, state.photos.length - 1));
    render();
    return;
  }
  if (action === "home") {
    state.screen = "home";
    render();
    return;
  }
  if (action === "continue" && state.photos.length >= 2) {
    state.screen = "edit";
    state.selected = Math.min(state.selected, state.photos.length - 1);
    render();
    return;
  }
  if (action === "clear-messages") {
    state.messages = [];
    paintMessages();
    return;
  }
  if (action === "clear-photos") {
    releasePhotos(state.photos);
    state.photos = [];
    state.selected = 0;
    markDirty();
    state.screen = state.screen === "home" ? "home" : "pick";
    render();
    return;
  }
  if (action === "remove") {
    removePhoto(Number(button.dataset.index));
    return;
  }
  if (action === "move") {
    movePhoto(Number(button.dataset.index), Number(button.dataset.dir));
    return;
  }
  if (action === "select") {
    state.selected = Number(button.dataset.index);
    if (state.mode === "collage") {
      const cell = activeCollageCell();
      if (cell) cell.imageIndex = state.selected;
      markDirty();
      drawAll();
      return;
    }
    syncSelection();
    drawPreview();
    drawCropper();
    return;
  }
  if (action === "direction") {
    state.combine.direction = button.dataset.value === "vertical" ? "vertical" : "horizontal";
    press("direction", state.combine.direction);
    markDirty();
    drawAll();
    return;
  }
  if (action === "aspect") {
    state.combine.aspect = nearestAspect(Number(button.dataset.value));
    press("aspect", state.combine.aspect, (el) => Math.abs(Number(el.dataset.value) - state.combine.aspect) < 0.02);
    markDirty();
    drawAll();
    return;
  }
  if (action === "resmode") {
    settings().resolutionMode = button.dataset.value;
    press("resmode", settings().resolutionMode);
    const input = document.getElementById("resolution");
    if (input) {
      const current = settings();
      input.value = String(
        state.mode === "collage"
          ? current.resolutionMode === "long"
            ? current.longSide
            : current.cell
          : current.resolution,
      );
    }
    markDirty();
    drawAll();
    return;
  }
  if (action === "res-chip") {
    applyResolution(button.dataset.value);
    return;
  }
  if (action === "preset") {
    const made = cellsForPreset(button.dataset.value, state.collage.rows, state.collage.cols);
    state.collage.preset = button.dataset.value;
    state.collage.rows = made.rows;
    state.collage.cols = made.cols;
    state.collage.cells = made.cells;
    state.collage.activeId = made.cells[0]?.id ?? null;
    if (state.photos[made.cells[0]?.imageIndex]) state.selected = made.cells[0].imageIndex;
    const rowsLabel = document.getElementById("rows-value");
    const colsLabel = document.getElementById("cols-value");
    if (rowsLabel) rowsLabel.textContent = String(made.rows);
    if (colsLabel) colsLabel.textContent = String(made.cols);
    press("preset", state.collage.preset);
    markDirty();
    refreshThumbs();
    drawAll();
    return;
  }
  if (action === "rows-inc" || action === "rows-dec" || action === "cols-inc" || action === "cols-dec") {
    ensureCollageModel();
    const key = action.startsWith("rows") ? "rows" : "cols";
    const delta = action.endsWith("inc") ? 1 : -1;
    state.collage[key] = Math.min(MAX_GRID, Math.max(1, state.collage[key] + delta));
    state.collage.preset = "custom";
    state.collage.cells = fitCellsToGrid(state.collage.cells, state.collage.rows, state.collage.cols);
    if (!state.collage.cells.some((cell) => cell.id === state.collage.activeId)) {
      state.collage.activeId = state.collage.cells[0]?.id ?? null;
    }
    const label = document.getElementById(key === "rows" ? "rows-value" : "cols-value");
    if (label) label.textContent = String(state.collage[key]);
    press("preset", "custom");
    markDirty();
    refreshThumbs();
    drawAll();
    return;
  }
  if (
    action === "span-wider" ||
    action === "span-narrower" ||
    action === "span-taller" ||
    action === "span-shorter" ||
    action === "even-row" ||
    action === "even-col" ||
    action === "clear-cell"
  ) {
    ensureCollageModel();
    const cell = activeCollageCell();
    if (!cell) {
      syncCellTools();
      return;
    }
    let result = { ok: true };
    if (action === "clear-cell") {
      clearCell(state.collage.cells, cell.id);
      state.collage.activeId = state.collage.cells[0]?.id ?? null;
    } else if (action === "even-row") {
      if (cell.pack === "col") result = { ok: false, reason: "blocked" };
      else result = evenPackRow(state.collage.cells, cell.row, state.collage.cols, state.collage.rows);
    } else if (action === "even-col") {
      if (cell.pack === "row") result = { ok: false, reason: "blocked" };
      else result = evenPackCol(state.collage.cells, cell.col, state.collage.cols, state.collage.rows);
    } else {
      const axis = action.includes("wide") || action.includes("narrow") ? "col" : "row";
      const change = action === "span-wider" || action === "span-taller" ? growCell : shrinkCell;
      result = change(state.collage.cells, cell.id, axis, state.collage.rows, state.collage.cols);
    }
    if (!result.ok) {
      const notes = {
        edge: "Das Feld liegt schon am Rand.",
        overlap: "Die Nachbarfelder sind belegt. Leere oder verkleinere sie zuerst.",
        blocked: "Hier kreuzt schon ein großes Feld die Zeile oder Spalte. Verkleinere es zuerst.",
        empty: "In dieser Zeile oder Spalte liegt kein Feld.",
        crowded: "Mehr Felder als Rasterplätze.",
        min: "Kleiner geht das Feld nicht.",
      };
      const label = document.getElementById("cell-label");
      if (label) label.textContent = notes[result.reason] || "Das geht an dieser Stelle nicht.";
      return;
    }
    markDirty();
    drawAll();
    return;
  }
  if (action === "bg") {
    settings().bg = cssColor(button.dataset.value);
    const input = document.getElementById("bg");
    if (input) input.value = settings().bg;
    markDirty();
    drawAll();
    return;
  }
  if (action === "reset-crop") {
    const photo = state.photos[state.selected];
    if (photo) photo.crop = defaultCrop();
    markDirty();
    drawAll();
    return;
  }
  if (action === "export") {
    onSave();
    return;
  }
  if (action === "download") {
    onDownload();
    return;
  }
  if (action === "share") onShare();
}

function onInput(event) {
  const target = event.target;
  if (target.id === "zoom") {
    const photo = state.photos[state.selected];
    if (!photo?.image) return;
    const frame = frameFor(state.selected, currentLayout());
    photo.crop = setCropScale(
      photo.crop,
      Number(target.value),
      photo.image.width,
      photo.image.height,
      frame.w,
      frame.h,
    );
    markDirty();
    drawAll();
    return;
  }
  if (target.id === "gap" || target.id === "margin") {
    const current = settings();
    current[target.id] = Number(target.value);
    if (target.id === "gap" && current.symmetric) current.margin = current.gap;
    markDirty();
    drawAll();
    return;
  }
  if (target.id === "resolution") {
    const n = Number(target.value);
    if (target.value === "" || !Number.isFinite(n) || n < 256 || n > 8192) return;
    applyResolution(n);
    return;
  }
  if (target.id === "bg") {
    settings().bg = cssColor(target.value);
    markDirty();
    drawAll();
    return;
  }
  if (target.id === "custom-date") {
    state.meta.customDate = target.value;
    state.meta.dateMode = "custom";
    const radio = document.querySelector('input[name="dateMode"][value="custom"]');
    if (radio) radio.checked = true;
    syncMetaVisibility();
    markDirty();
    updateMetaSummary();
  }
}

function onChange(event) {
  const target = event.target;
  if (target.id === "file") {
    addFiles(target.files);
    target.value = "";
    return;
  }
  if (target.name === "dateMode") {
    state.meta.dateMode = target.value;
    if (state.meta.dateMode === "custom" && !state.meta.customDate) {
      const mid = midpointDate(state.photos.map((photo) => photo.date)) || new Date();
      state.meta.customDate = toDatetimeLocalValue(mid);
      const input = document.getElementById("custom-date");
      if (input) input.value = state.meta.customDate;
    }
    syncMetaVisibility();
    markDirty();
    updateMetaSummary();
    return;
  }
  if (target.name === "gpsMode") {
    state.meta.gpsMode = target.value;
    syncMetaVisibility();
    markDirty();
    updateMetaSummary();
    return;
  }
  if (target.id === "date-index" || target.id === "gps-index") {
    const key = target.id === "date-index" ? "dateIndex" : "gpsIndex";
    state.meta[key] = Number(target.value);
    markDirty();
    updateMetaSummary();
    return;
  }
  if (target.id === "quality") {
    state.meta.quality = target.value;
    markDirty();
    return;
  }
  if (target.id === "symmetric") {
    const current = settings();
    current.symmetric = target.checked;
    if (current.symmetric) current.margin = current.gap;
    markDirty();
    drawAll();
    return;
  }
  if (target.id === "resolution") applyResolution(target.value);
}

export function boot() {
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  app.addEventListener("change", onChange);
  window.addEventListener("resize", () => {
    if (state.screen === "edit") drawAll();
  });
  registerServiceWorker();
  render();
}
