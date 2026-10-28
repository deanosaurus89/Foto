import assert from "node:assert/strict";
import test from "node:test";
import { HEIC_ERROR, decodeErrorMessage, isHeic } from "../src/lib/images.js";

test("HEIC failures explain the JPEG fallback in German", () => {
  const file = { name: "IMG_2043.HEIC", type: "image/heic" };
  assert.equal(isHeic(file), true);
  assert.equal(isHeic({ name: "bild.jpg", type: "image/jpeg" }), false);
  const message = decodeErrorMessage(file, "heic");
  assert.equal(message, HEIC_ERROR);
  assert.match(message, /HEIC/);
  assert.match(message, /JPEG/);
  assert.match(decodeErrorMessage({ name: "clip.mov", type: "video/quicktime" }, "unsupported"), /nicht unterstützt/);
});
