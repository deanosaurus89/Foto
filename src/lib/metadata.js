/** Date and GPS choices for the exported JPEG. Pure, no DOM. */

const GPS_DECIMALS = 4;

function finiteDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function midpointDate(dates) {
  const times = dates.map(finiteDate).filter(Boolean).map((date) => date.getTime());
  if (!times.length) return null;
  const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
  return new Date(avg);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/** EXIF DateTime, local clock of this device (cameras store local time). */
export function formatExifDate(date) {
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toDatetimeLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDisplayDate(date) {
  if (!date) return "kein Datum";
  return date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function formatGps(gps) {
  if (!gps || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) return null;
  const ns = gps.lat >= 0 ? "N" : "S";
  const ew = gps.lng >= 0 ? "O" : "W";
  return `${Math.abs(gps.lat).toFixed(5)}° ${ns}, ${Math.abs(gps.lng).toFixed(5)}° ${ew}`;
}

function locatedPhotos(photos) {
  return photos
    .map((photo, index) => ({ index, gps: photo.gps }))
    .filter(
      (item) =>
        item.gps && Number.isFinite(item.gps.lat) && Number.isFinite(item.gps.lng),
    );
}

/**
 * Location when the sources disagree.
 * - first: first selected photo that has GPS (default)
 * - common: most frequent position, rounded to ~11 m (4 decimal degrees).
 *   Ties keep the earliest bucket.
 * - pick: a chosen photo; if it has no GPS, fall back to the first that does
 * - none: write no GPS IFD
 */
export function chooseGps(photos, mode, index = 0) {
  const located = locatedPhotos(photos);
  if (mode === "none" || located.length === 0) {
    return {
      gps: null,
      count: 0,
      total: located.length,
      reason: located.length === 0 ? "missing" : "none",
    };
  }
  if (mode === "pick") {
    const chosen = photos[index];
    if (chosen?.gps && Number.isFinite(chosen.gps.lat) && Number.isFinite(chosen.gps.lng)) {
      return { gps: chosen.gps, count: 1, total: located.length, reason: "pick", index };
    }
    const fallback = located[0];
    return {
      gps: fallback.gps,
      count: 1,
      total: located.length,
      reason: "pick-fallback",
      index: fallback.index,
    };
  }
  if (mode === "common") {
    const buckets = new Map();
    for (const item of located) {
      const key = `${item.gps.lat.toFixed(GPS_DECIMALS)},${item.gps.lng.toFixed(GPS_DECIMALS)}`;
      const bucket = buckets.get(key) ?? { count: 0, gps: item.gps, index: item.index };
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    let best = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) best = bucket;
    }
    return {
      gps: best.gps,
      count: best.count,
      total: located.length,
      reason: "common",
      index: best.index,
    };
  }
  const first = located[0];
  return { gps: first.gps, count: 1, total: located.length, reason: "first", index: first.index };
}

export function resolveDate(photos, settings, now = new Date()) {
  const dates = photos.map((photo) => finiteDate(photo.date)).filter(Boolean);
  const custom = finiteDate(settings.customDate);
  if (settings.dateMode === "pick") {
    const picked = finiteDate(photos[settings.dateIndex]?.date);
    if (picked) return { date: picked, source: "pick" };
  }
  if (settings.dateMode === "custom" && custom) {
    return { date: custom, source: "custom" };
  }
  if (settings.dateMode === "mid" || settings.dateMode === "pick") {
    const mid = midpointDate(dates);
    if (mid) return { date: mid, source: settings.dateMode === "mid" ? "mid" : "mid-fallback" };
  }
  if (custom) return { date: custom, source: "custom" };
  return { date: now, source: "now" };
}

export function resolveMetadata(photos, settings, now = new Date()) {
  const date = resolveDate(photos, settings, now);
  const gps = chooseGps(photos, settings.gpsMode, settings.gpsIndex);
  return { ...date, gps };
}

export function exportFilename(mode, date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const kind = mode === "collage" ? "collage" : "streifen";
  return `foto-${kind}-${stamp}.jpg`;
}
