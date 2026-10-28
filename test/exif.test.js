import assert from "node:assert/strict";
import test from "node:test";
import exifr from "exifr";
import jpeg from "jpeg-js";
import { embedExif } from "../src/lib/exif.js";

function tinyJpegDataUrl() {
  const width = 8;
  const height = 6;
  const data = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 40;
    data[i + 1] = 90;
    data[i + 2] = 160;
  }
  const encoded = jpeg.encode({ data, width, height }, 90);
  return `data:image/jpeg;base64,${Buffer.from(encoded.data).toString("base64")}`;
}

function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

test("exported JPEG keeps the chosen date and GPS", async () => {
  const date = new Date(2024, 5, 15, 14, 30, 0);
  const inserted = embedExif(tinyJpegDataUrl(), { date, gps: { lat: 52.52, lng: 13.405 } });
  const buffer = dataUrlToBuffer(inserted);
  const raw = await exifr.parse(buffer, { gps: true, reviveValues: false });
  assert.equal(raw.DateTimeOriginal, "2024:06:15 14:30:00");
  assert.equal(raw.CreateDate || raw.DateTimeDigitized, "2024:06:15 14:30:00");
  const gps = await exifr.gps(buffer);
  assert.ok(Math.abs(gps.latitude - 52.52) < 1e-4);
  assert.ok(Math.abs(gps.longitude - 13.405) < 1e-4);
});

test("JPEG without a location has no GPS fix", async () => {
  const inserted = embedExif(tinyJpegDataUrl(), { date: new Date(2020, 0, 1, 0, 0, 0), gps: null });
  const gps = await exifr.gps(dataUrlToBuffer(inserted));
  assert.equal(gps, undefined);
});
