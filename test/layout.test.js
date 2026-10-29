import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EDGE,
  MAX_GRID,
  MAX_PIXELS,
  buildCollageLayout,
  cellsForPreset,
  addGridLine,
  clearCell,
  evenPackCol,
  evenPackRow,
  growCell,
  mergeCells,
  placePhoto,
  randomFill,
  relocateBlock,
  resolveCollageLayout,
  resolveCombineLayout,
  splitCell,
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

test("custom collage accepts a 10 by 10 grid", () => {
  const made = cellsForPreset("custom", 10, 10);
  assert.equal(made.rows, MAX_GRID);
  assert.equal(made.cols, MAX_GRID);
  assert.equal(made.cells.length, 100);
  const layout = resolveCollageLayout({
    preset: "custom",
    rows: 10,
    cols: 10,
    cells: made.cells,
    resolutionMode: "cell",
    cell: 1200,
    gap: 0,
    margin: 0,
    symmetric: true,
  });
  assert.equal(layout.cols, 10);
  assert.equal(layout.rows, 10);
  assert.equal(layout.tiles.length, 100);
  assert.equal(layout.limited, true);
  assert.ok(layout.width <= MAX_EDGE);
  assert.ok(layout.width * layout.height <= MAX_PIXELS * 1.02);
});

test("a 2 by 2 block on a 3 by 3 grid keeps even gutters", () => {
  const made = cellsForPreset("custom", 3, 3);
  const block = made.cells.find((cell) => cell.col === 0 && cell.row === 0);
  for (const cell of made.cells.filter((cell) => cell.col < 2 && cell.row < 2 && cell !== block)) {
    clearCell(made.cells, cell.id);
  }
  assert.equal(growCell(made.cells, block.id, "col", 3, 3).ok, true);
  assert.equal(growCell(made.cells, block.id, "row", 3, 3).ok, true);
  const layout = buildCollageLayout({
    rows: 3,
    cols: 3,
    cells: made.cells,
    cell: 100,
    gap: 10,
    margin: 10,
  });
  const span = layout.tiles.find((tile) => tile.id === block.id);
  assert.equal(span.w, 210);
  assert.equal(span.h, 210);
  const right = layout.tiles.filter((tile) => tile.x === 230).sort((a, b) => a.y - b.y);
  const bottom = layout.tiles.filter((tile) => tile.y === 230).sort((a, b) => a.x - b.x);
  assert.equal(right.length, 3);
  assert.equal(bottom.length, 3);
  assert.equal(right[0].x - (span.x + span.w), 10);
  assert.equal(bottom[0].y - (span.y + span.h), 10);
  assert.equal(overlaps(layout), false);
});

test("fewer images in a row share the width and the gutter", () => {
  const made = cellsForPreset("custom", 1, 3);
  clearCell(made.cells, made.cells[2].id);
  assert.equal(evenPackRow(made.cells, 0, 3, 1).ok, true);
  const layout = buildCollageLayout({
    rows: 1,
    cols: 3,
    cells: made.cells,
    cell: 100,
    gap: 10,
    margin: 10,
  });
  const tiles = layout.tiles.slice().sort((a, b) => a.x - b.x);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].w, tiles[1].w);
  assert.equal(tiles[1].x - (tiles[0].x + tiles[0].w), 10);
  assert.equal(tiles[0].x, 10);
  assert.equal(tiles[1].x + tiles[1].w, layout.width - 10);
});

test("fewer images in a column share the height", () => {
  const made = cellsForPreset("custom", 3, 1);
  clearCell(made.cells, made.cells[2].id);
  assert.equal(evenPackCol(made.cells, 0, 1, 3).ok, true);
  const layout = buildCollageLayout({
    rows: 3,
    cols: 1,
    cells: made.cells,
    cell: 100,
    gap: 10,
    margin: 10,
  });
  const tiles = layout.tiles.slice().sort((a, b) => a.y - b.y);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].h, tiles[1].h);
  assert.equal(tiles[1].y - (tiles[0].y + tiles[0].h), 10);
  assert.equal(tiles[0].y, 10);
  assert.equal(tiles[1].y + tiles[1].h, layout.height - 10);
});

test("even packing refuses a row that a tall cell already crosses", () => {
  const made = cellsForPreset("custom", 3, 3);
  const block = made.cells.find((cell) => cell.col === 0 && cell.row === 0);
  clearCell(
    made.cells,
    made.cells.find((cell) => cell.col === 1 && cell.row === 0).id,
  );
  clearCell(
    made.cells,
    made.cells.find((cell) => cell.col === 0 && cell.row === 1).id,
  );
  clearCell(
    made.cells,
    made.cells.find((cell) => cell.col === 1 && cell.row === 1).id,
  );
  growCell(made.cells, block.id, "col", 3, 3);
  growCell(made.cells, block.id, "row", 3, 3);
  assert.equal(evenPackRow(made.cells, 0, 3, 3).ok, false);
  assert.equal(evenPackCol(made.cells, 0, 3, 3).ok, false);
});

test("random fill uses each photo at most once", () => {
  const made = cellsForPreset("custom", 2, 2);
  randomFill(made.cells, 3, () => 0);
  const placed = made.cells.map((cell) => cell.imageIndex).filter((index) => index != null);
  assert.equal(placed.length, 3);
  assert.equal(new Set(placed).size, 3);
  assert.ok(placed.every((index) => index >= 0 && index < 3));
});

test("blocks move onto empty cells and swap with the same size", () => {
  const made = cellsForPreset("custom", 1, 3);
  const moving = made.cells[0];
  const image = moving.imageIndex;
  clearCell(made.cells, made.cells[2].id);
  assert.equal(relocateBlock(made.cells, moving.id, 2, 0, 1, 3).kind, "move");
  assert.equal(made.cells.find((cell) => cell.id === moving.id).col, 2);
  assert.equal(made.cells.find((cell) => cell.id === moving.id).imageIndex, image);

  const row = cellsForPreset("custom", 1, 2);
  const left = row.cells[0];
  const right = row.cells[1];
  const leftImage = left.imageIndex;
  const rightImage = right.imageIndex;
  assert.equal(relocateBlock(row.cells, left.id, right.col, right.row, 1, 2).kind, "swap");
  const movedLeft = row.cells.find((cell) => cell.id === left.id);
  const movedRight = row.cells.find((cell) => cell.id === right.id);
  assert.equal(movedLeft.col, 1);
  assert.equal(movedRight.col, 0);
  assert.equal(movedLeft.imageIndex, leftImage);
  assert.equal(movedRight.imageIndex, rightImage);
});

test("merging a rectangle keeps one photo and even grid geometry", () => {
  const made = cellsForPreset("custom", 2, 2);
  const ids = made.cells.filter((cell) => cell.row === 0).map((cell) => cell.id);
  const merged = mergeCells(made.cells, ids);
  assert.equal(merged.ok, true);
  assert.equal(made.cells.length, 3);
  const block = made.cells.find((cell) => cell.id === merged.id);
  assert.equal(block.colSpan, 2);
  assert.equal(block.rowSpan, 1);
  const layout = buildCollageLayout({
    rows: 2,
    cols: 2,
    cells: made.cells,
    cell: 100,
    gap: 8,
    margin: 8,
  });
  const tile = layout.tiles.find((item) => item.id === block.id);
  assert.equal(tile.w, 208);
  assert.equal(overlaps(layout), false);
  const lShape = cellsForPreset("custom", 2, 2);
  const bad = mergeCells(
    lShape.cells,
    lShape.cells.filter((cell) => !(cell.col === 1 && cell.row === 1)).map((cell) => cell.id),
  );
  assert.equal(bad.ok, false);
});

test("a merged block splits back into single cells and a new row stays empty", () => {
  const made = cellsForPreset("custom", 2, 2);
  const ids = made.cells.map((cell) => cell.id);
  const merged = mergeCells(made.cells, ids);
  const split = splitCell(made.cells, merged.id);
  assert.equal(split.ok, true);
  assert.equal(made.cells.length, 4);
  assert.ok(made.cells.every((cell) => cell.colSpan === 1 && cell.rowSpan === 1));
  addGridLine(made.cells, 3, 2, "row");
  const added = made.cells.filter((cell) => cell.row === 2);
  assert.equal(added.length, 2);
  assert.ok(added.every((cell) => cell.imageIndex == null));
});

test("dropping a photo swaps with the cell it lands on", () => {
  const made = cellsForPreset("custom", 1, 2);
  const result = placePhoto(made.cells, 0, 1, 0, 2, 1);
  assert.equal(result.kind, "swap");
  assert.equal(made.cells[1].imageIndex, 0);
  assert.equal(made.cells[0].imageIndex, 1);
});
