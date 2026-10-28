import piexif from "piexifjs";
import { formatExifDate } from "./metadata.js";

function gpsRational(value) {
  return piexif.GPSHelper.degToDmsRational(Math.abs(value));
}

export function buildExif({ date, gps }) {
  const zeroth = {};
  const exif = {};
  zeroth[piexif.ImageIFD.Software] = "Foto";
  zeroth[piexif.ImageIFD.Orientation] = 1;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const stamp = formatExifDate(date);
    zeroth[piexif.ImageIFD.DateTime] = stamp;
    exif[piexif.ExifIFD.DateTimeOriginal] = stamp;
    exif[piexif.ExifIFD.DateTimeDigitized] = stamp;
  }
  const payload = { "0th": zeroth, Exif: exif };
  if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)) {
    const gpsIfd = {};
    gpsIfd[piexif.GPSIFD.GPSLatitudeRef] = gps.lat >= 0 ? "N" : "S";
    gpsIfd[piexif.GPSIFD.GPSLatitude] = gpsRational(gps.lat);
    gpsIfd[piexif.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? "E" : "W";
    gpsIfd[piexif.GPSIFD.GPSLongitude] = gpsRational(gps.lng);
    payload.GPS = gpsIfd;
  }
  return payload;
}

/** Insert EXIF into a JPEG data URL. Returns a JPEG data URL. */
export function embedExif(jpegDataUrl, meta) {
  const dumped = piexif.dump(buildExif(meta));
  return piexif.insert(dumped, jpegDataUrl);
}

export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:(.*?);/.exec(head)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function canvasToJpegBlob(canvas, meta, quality = 0.92) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("toBlob"))),
      "image/jpeg",
      quality,
    );
  });
  const dataUrl = await blobToDataUrl(blob);
  try {
    return { blob: dataUrlToBlob(embedExif(dataUrl, meta)), exifError: false };
  } catch {
    return { blob, exifError: true };
  }
}
