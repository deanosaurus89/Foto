import exifr from "exifr";
import { defaultCrop } from "./crop.js";

export const MAX_SOURCE_EDGE = 3072;
export const MAX_PHOTOS = 16;

export const HEIC_ERROR =
  "Dieses HEIC/HEIF-Foto konnte der Browser nicht lesen. In der Fotos-App das Bild als JPEG sichern (Teilen → Optionen, oder in Dateien mit Format JPEG exportieren) und die JPEG-Datei hier erneut auswählen.";

export const GENERIC_DECODE_ERROR =
  "Dieses Foto konnte nicht gelesen werden. Bitte in der Fotos-App als JPEG sichern und erneut auswählen.";

export const UNSUPPORTED_ERROR =
  "Dieses Format wird nicht unterstützt. Bitte ein JPEG- oder HEIC-Foto wählen.";

export function isHeic(file) {
  const name = file?.name || "";
  const type = (file?.type || "").toLowerCase();
  return /hei[cf]$/i.test(name) || type === "image/heic" || type === "image/heif" || type === "image/heic-sequence";
}

export function decodeErrorMessage(file, code) {
  if (code === "unsupported") return UNSUPPORTED_ERROR;
  if (code === "heic" || isHeic(file)) return HEIC_ERROR;
  return GENERIC_DECODE_ERROR;
}

function coerceDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export async function readMeta(file) {
  try {
    const parsed = await exifr.parse(file, { gps: true, reviveValues: true });
    if (!parsed) return { date: null, gps: null };
    const date = coerceDate(parsed.DateTimeOriginal || parsed.CreateDate || parsed.ModifyDate);
    const gps =
      Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)
        ? { lat: parsed.latitude, lng: parsed.longitude }
        : null;
    return { date, gps };
  } catch {
    return { date: null, gps: null };
  }
}

function loadHtmlImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > 0) resolve(img);
      else reject(new Error("empty"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img"));
    };
    img.src = url;
  });
}

async function downscale(source) {
  const edge = Math.max(source.width, source.height);
  if (edge <= MAX_SOURCE_EDGE) return source;
  const scale = MAX_SOURCE_EDGE / edge;
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, w, h);
  source.close?.();
  return canvas;
}

async function decodeNative(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* HEIC on browsers without a decoder lands here. */
    }
  }
  return loadHtmlImage(file);
}

async function decodeHeicFallback(file) {
  const mod = await import("heic2any");
  const heic2any = mod.default || mod;
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return createImageBitmap(blob);
}

export async function decodeFile(file) {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(file.name || "")) {
    const error = new Error("unsupported");
    error.code = "unsupported";
    throw error;
  }
  try {
    const native = await decodeNative(file);
    return downscale(native);
  } catch (nativeError) {
    if (!isHeic(file)) {
      const error = new Error("decode");
      error.code = "decode";
      throw error;
    }
    try {
      const bitmap = await decodeHeicFallback(file);
      return downscale(bitmap);
    } catch {
      const error = new Error("heic");
      error.code = "heic";
      error.cause = nativeError;
      throw error;
    }
  }
}

export async function loadPhoto(file) {
  const name = file.name || "Foto";
  const metaPromise = readMeta(file);
  try {
    const image = await decodeFile(file);
    const meta = await metaPromise;
    return {
      id: crypto.randomUUID(),
      name,
      image,
      width: image.width,
      height: image.height,
      date: meta.date,
      gps: meta.gps,
      crop: defaultCrop(),
    };
  } catch (err) {
    await metaPromise.catch(() => {});
    const error = new Error(decodeErrorMessage(file, err?.code));
    error.code = err?.code || "decode";
    error.fileName = name;
    throw error;
  }
}
