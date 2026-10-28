import assert from "node:assert/strict";
import test from "node:test";
import { coverRect, defaultCrop, panCrop, setCropScale } from "../src/lib/crop.js";

test("cover crop centers a wide photo in a square tile", () => {
  const rect = coverRect(200, 100, 100, 100, defaultCrop());
  assert.equal(rect.sw, 100);
  assert.equal(rect.sh, 100);
  assert.equal(rect.sx, 50);
  assert.equal(rect.sy, 0);
});

test("zoom keeps the window centered until it hits an edge", () => {
  const rect = coverRect(200, 100, 100, 100, { scale: 2, focusX: 0.5, focusY: 0.5 });
  assert.equal(rect.sw, 50);
  assert.equal(rect.sh, 50);
  assert.equal(rect.sx, 75);
  assert.equal(rect.sy, 25);
});

test("panning right reveals the left side of the photo", () => {
  const crop = panCrop(defaultCrop(), 10, 0, 200, 100, 100, 100);
  assert.ok(crop.focusX < 0.5);
  const rect = coverRect(200, 100, 100, 100, crop);
  assert.ok(rect.sx < 50);
  assert.ok(rect.sx >= 0);
});

test("pan and zoom stay inside the photo", () => {
  let crop = setCropScale(defaultCrop(), 8, 200, 100, 100, 100);
  assert.equal(crop.scale, 3);
  crop = panCrop(crop, 5000, -5000, 200, 100, 100, 100);
  const rect = coverRect(200, 100, 100, 100, crop);
  assert.ok(rect.sx >= 0);
  assert.ok(rect.sy >= 0);
  assert.ok(rect.sx + rect.sw <= 200 + 1e-6);
  assert.ok(rect.sy + rect.sh <= 100 + 1e-6);
});
