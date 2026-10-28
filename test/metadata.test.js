import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseGps,
  exportFilename,
  formatExifDate,
  formatGps,
  midpointDate,
  resolveMetadata,
} from "../src/lib/metadata.js";

test("midpoint date is the average capture time", () => {
  const mid = midpointDate([new Date("2024-01-01T00:00:00Z"), new Date("2024-01-03T00:00:00Z")]);
  assert.equal(mid.toISOString(), "2024-01-02T00:00:00.000Z");
  assert.equal(midpointDate([]), null);
});

test("EXIF date uses the local clock", () => {
  const date = new Date(2024, 5, 15, 14, 30, 7);
  assert.equal(formatExifDate(date), "2024:06:15 14:30:07");
});

test("GPS formatting uses German east marker", () => {
  assert.equal(formatGps({ lat: 52.52, lng: 13.405 }), "52.52000° N, 13.40500° O");
  assert.equal(formatGps({ lat: -33.8, lng: -70.6 }).includes("S"), true);
  assert.equal(formatGps({ lat: -33.8, lng: -70.6 }).includes("W"), true);
});

test("default location is the first photo with GPS", () => {
  const photos = [
    { gps: null },
    { gps: { lat: 1, lng: 2 } },
    { gps: { lat: 9, lng: 9 } },
  ];
  const choice = chooseGps(photos, "first");
  assert.equal(choice.reason, "first");
  assert.deepEqual(choice.gps, { lat: 1, lng: 2 });
  assert.equal(choice.index, 1);
});

test("most common location clusters nearby points and keeps earlier ties", () => {
  const photos = [
    { gps: { lat: 52.52001, lng: 13.40501 } },
    { gps: { lat: 48.1, lng: 11.5 } },
    { gps: { lat: 52.52004, lng: 13.40504 } },
  ];
  const choice = chooseGps(photos, "common");
  assert.equal(choice.reason, "common");
  assert.equal(choice.count, 2);
  assert.equal(choice.gps.lat, 52.52001);
});

test("a tie between locations keeps the earlier cluster", () => {
  const photos = [
    { gps: { lat: 1.00001, lng: 1 } },
    { gps: { lat: 2.00001, lng: 2 } },
    { gps: { lat: 1.00002, lng: 1 } },
    { gps: { lat: 2.00002, lng: 2 } },
  ];
  const choice = chooseGps(photos, "common");
  assert.equal(choice.count, 2);
  assert.equal(choice.gps.lat, 1.00001);
});

test("user can drop GPS or pick one source", () => {
  const photos = [
    { gps: { lat: 1, lng: 1 } },
    { gps: null },
    { gps: { lat: 3, lng: 4 } },
  ];
  assert.equal(chooseGps(photos, "none").gps, null);
  assert.deepEqual(chooseGps(photos, "pick", 2).gps, { lat: 3, lng: 4 });
  assert.equal(chooseGps(photos, "pick", 1).reason, "pick-fallback");
  assert.equal(chooseGps([{ gps: null }], "first").reason, "missing");
});

test("date resolution prefers the midpoint, a chosen photo, or a custom time", () => {
  const photos = [
    { date: new Date("2020-01-01T00:00:00Z"), gps: { lat: 1, lng: 2 } },
    { date: new Date("2020-01-03T00:00:00Z"), gps: null },
  ];
  const mid = resolveMetadata(photos, { dateMode: "mid", gpsMode: "first" });
  assert.equal(mid.source, "mid");
  assert.equal(mid.date.toISOString(), "2020-01-02T00:00:00.000Z");
  assert.equal(mid.gps.gps.lat, 1);

  const picked = resolveMetadata(photos, { dateMode: "pick", dateIndex: 1, gpsMode: "none" });
  assert.equal(picked.source, "pick");
  assert.equal(picked.date.toISOString(), "2020-01-03T00:00:00.000Z");
  assert.equal(picked.gps.gps, null);

  const custom = resolveMetadata(photos, {
    dateMode: "custom",
    customDate: "2021-05-05T08:30",
    gpsMode: "none",
  });
  assert.equal(custom.source, "custom");
  assert.equal(custom.date.getFullYear(), 2021);

  const none = resolveMetadata([{ date: null, gps: null }], {
    dateMode: "mid",
    gpsMode: "first",
    customDate: "",
  }, new Date("2022-02-02T00:00:00Z"));
  assert.equal(none.source, "now");
  assert.equal(none.date.toISOString(), "2022-02-02T00:00:00.000Z");
});

test("export filename follows the mode and local time", () => {
  const name = exportFilename("collage", new Date(2024, 0, 2, 3, 4));
  assert.equal(name, "foto-collage-20240102-0304.jpg");
  assert.equal(exportFilename("combine", new Date(2024, 0, 2, 3, 4)), "foto-streifen-20240102-0304.jpg");
});
