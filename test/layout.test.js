import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EDGE,
  MAX_PIXELS,
  buildCollageLayout,
  resolveCollageLayout,
  resolveCombineLayout,
} from "../src/lib/layout.js";

function tilesEqual(layout) {
  const [first] = layout.tiles;
  return layout.tiles.every((tile) => tile.w === first.w && tile.h === first.h);
}

function overlaps(layout) {
  const tiles = layout.tiles;
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const a = tiles[i];
      const b = tiles[j];
      const separated = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      if (!separated) return true;
    }
  }
  return false;
}

test("horizontal strip gives equal tiles", () => {
  const layout = resolveCombineLayout(
    { direction: "horizontal", resolutionMode: "edge", resolution: 400, aspect: 1, gap: 10, margin: 5, symmetric: false },
    3,
  );
  assert.equal(layout.tiles.length, 3);
  assert.equal(tilesEqual(layout), true);
  assert.equal(overlaps(layout), false);
  assert.equal(layout.tileW, 400);
  assert.equal(layout.tileH, 400);
  assert.equal(layout.width, 5 * 2 + 400 * 3 + 10 * 2);
  assert.equal(layout.tiles[1].x, 5 + 410);
  assert.equal(layout.limited, false);
});

test("vertical strip stacks equal tiles", () => {
  const layout = resolveCombineLayout(
    { direction: "vertical", resolutionMode: "height", resolution: 900, aspect: 1, gap: 0, margin: 0, symmetric: true },
    3,
  );
  assert.equal(tilesEqual(layout), true);
  assert.equal(layout.tileW, 300);
  assert.equal(layout.tileH, 300);
  assert.equal(layout.width, 300);
  assert.equal(layout.height, 900);
  assert.equal(layout.tiles[2].y, 600);
});

test("output width is shared equally across a horizontal strip", () => {
  const layout = resolveCombineLayout(
    { direction: "horizontal", resolutionMode: "width", resolution: 300, aspect: 1, gap: 0, margin: 0, symmetric: true },
    3,
  );
  assert.equal(layout.width, 300);
  assert.equal(layout.tileW, 100);
  assert.equal(layout.tileH, 100);
  assert.equal(tilesEqual(layout), true);
});

test("portrait tile aspect uses the long edge", () => {
  const layout = resolveCombineLayout(
    { direction: "horizontal", resolutionMode: "edge", resolution: 500, aspect: 4 / 5, gap: 0, margin: 0, symmetric: true },
    2,
  );
  assert.equal(layout.tileH, 500);
  assert.equal(layout.tileW, 400);
  assert.equal(tilesEqual(layout), true);
});

test("a very wide strip is limited for Safari", () => {
  const layout = resolveCombineLayout(
    { direction: "horizontal", resolutionMode: "edge", resolution: 2000, aspect: 1, gap: 0, margin: 0, symmetric: true },
    10,
  );
  assert.equal(layout.limited, true);
  assert.ok(layout.width <= MAX_EDGE);
  assert.ok(layout.width * layout.height <= MAX_PIXELS * 1.02);
  assert.equal(tilesEqual(layout), true);
  assert.equal(overlaps(layout), false);
});

test("collage presets and custom grid", () => {
  const grid = buildCollageLayout({ presetId: "3x2", cell: 100, gap: 8, margin: 8, rows: 9, cols: 9 });
  assert.equal(grid.tiles.length, 6);
  assert.equal(grid.cols, 3);
  assert.equal(grid.rows, 2);
  assert.equal(overlaps(grid), false);

  const split = buildCollageLayout({ presetId: "1+2", cell: 100, gap: 10, margin: 5, rows: 2, cols: 2 });
  assert.equal(split.tiles.length, 3);
  assert.equal(split.tiles[0].h, 210);
  assert.equal(split.tiles[0].w, 100);
  assert.equal(split.tiles[1].w, split.tiles[2].w);
  assert.equal(overlaps(split), false);

  const custom = resolveCollageLayout({
    preset: "custom",
    rows: 3,
    cols: 2,
    resolutionMode: "cell",
    cell: 400,
    gap: 0,
    margin: 0,
    symmetric: true,
  });
  assert.equal(custom.tiles.length, 6);
  assert.equal(custom.width, 800);
  assert.equal(custom.height, 1200);
});

test("long-side collage stays inside the requested edge", () => {
  const layout = resolveCollageLayout({
    preset: "2x2",
    rows: 2,
    cols: 2,
    resolutionMode: "long",
    longSide: 1000,
    cell: 50,
    gap: 20,
    margin: 20,
    symmetric: true,
  });
  assert.ok(Math.max(layout.width, layout.height) <= 1000);
  assert.equal(layout.tiles.length, 4);
  assert.equal(overlaps(layout), false);
});
