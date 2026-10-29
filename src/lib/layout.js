/** Integer layouts for the equal-tile strip and the collage grid. */

// Print ceiling: short side up to about 6000 px (for example 9000×6000 or 6000×6000).
// Drugstore paper sizes (Einpassen / Flächendeckend) are a separate step, not this cap.
export const MAX_EDGE = 12000;
export const MAX_PIXELS = 72_000_000;
export const MIN_RESOLUTION = 256;
export const MAX_RESOLUTION = 12000;
export const MAX_GRID = 10;

export const PRESETS = [
  { id: "2x2", name: "2×2", cols: 2, rows: 2 },
  { id: "3x2", name: "3×2", cols: 3, rows: 2 },
  { id: "2x3", name: "2×3", cols: 2, rows: 3 },
  { id: "3x3", name: "3×3", cols: 3, rows: 3 },
  {
    id: "1+2",
    name: "1 + 2",
    cols: 2,
    rows: 2,
    cells: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 2 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    ],
  },
  {
    id: "2+1",
    name: "2 + 1",
    cols: 2,
    rows: 2,
    cells: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 2 },
    ],
  },
  {
    id: "top1",
    name: "1 über 2",
    cols: 2,
    rows: 2,
    cells: [
      { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    ],
  },
  {
    id: "bot1",
    name: "2 über 1",
    cols: 2,
    rows: 2,
    cells: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 2, rowSpan: 1 },
    ],
  },
  { id: "custom", name: "Eigenes", cols: null, rows: null },
];

export function gridCells(cols, rows) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ col, row, colSpan: 1, rowSpan: 1 });
    }
  }
  return cells;
}

export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

function intIn(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function limitFactor(width, height) {
  let scale = 1;
  const edge = Math.max(width, height);
  if (edge > MAX_EDGE) scale = Math.min(scale, MAX_EDGE / edge);
  const pixels = width * height;
  if (pixels > MAX_PIXELS) scale = Math.min(scale, Math.sqrt(MAX_PIXELS / pixels));
  return scale;
}

/**
 * aspect is tile width / tile height.
 * resolutionMode:
 *   edge   — long side of each tile
 *   width  — width of the finished strip
 *   height — height of the finished strip
 */
export function combineTileSize({
  count,
  direction,
  gap,
  margin,
  resolutionMode,
  resolution,
  aspect,
}) {
  const n = Math.max(1, count);
  const a = aspect > 0 ? aspect : 1;
  const gaps = Math.max(0, n - 1) * gap;
  const margins = margin * 2;
  let tileW;
  let tileH;

  if (resolutionMode === "width") {
    tileW =
      direction === "vertical"
        ? Math.max(1, resolution - margins)
        : Math.max(1, Math.floor((resolution - margins - gaps) / n));
    tileH = Math.max(1, Math.round(tileW / a));
  } else if (resolutionMode === "height") {
    tileH =
      direction === "horizontal"
        ? Math.max(1, resolution - margins)
        : Math.max(1, Math.floor((resolution - margins - gaps) / n));
    tileW = Math.max(1, Math.round(tileH * a));
  } else if (a >= 1) {
    tileW = resolution;
    tileH = Math.max(1, Math.round(resolution / a));
  } else {
    tileH = resolution;
    tileW = Math.max(1, Math.round(resolution * a));
  }
  return { tileW, tileH };
}

export function buildCombineLayout({ count, direction, tileW, tileH, gap, margin }) {
  const horizontal = direction !== "vertical";
  const tiles = [];
  for (let i = 0; i < count; i += 1) {
    tiles.push({
      imageIndex: i,
      x: margin + (horizontal ? i * (tileW + gap) : 0),
      y: margin + (horizontal ? 0 : i * (tileH + gap)),
      w: tileW,
      h: tileH,
    });
  }
  const width = horizontal
    ? margin * 2 + count * tileW + Math.max(0, count - 1) * gap
    : margin * 2 + tileW;
  const height = horizontal
    ? margin * 2 + tileH
    : margin * 2 + count * tileH + Math.max(0, count - 1) * gap;
  return { width, height, tiles, tileW, tileH };
}

let cellSerial = 1;

export function createCell(partial = {}) {
  cellSerial += 1;
  const pack = partial.pack === "row" || partial.pack === "col" ? partial.pack : "grid";
  return {
    id: partial.id || `c${cellSerial}`,
    imageIndex: Object.prototype.hasOwnProperty.call(partial, "imageIndex") ? partial.imageIndex : 0,
    col: partial.col ?? 0,
    row: partial.row ?? 0,
    colSpan: Math.max(1, partial.colSpan ?? 1),
    rowSpan: Math.max(1, partial.rowSpan ?? 1),
    pack,
  };
}

export function cellsForPreset(presetId, rows, cols) {
  const preset = presetById(presetId);
  const useRows = Math.max(1, Math.min(MAX_GRID, preset.id === "custom" ? rows : preset.rows));
  const useCols = Math.max(1, Math.min(MAX_GRID, preset.id === "custom" ? cols : preset.cols));
  const defs = preset.cells ?? gridCells(useCols, useRows);
  return {
    rows: useRows,
    cols: useCols,
    cells: defs.map((def, imageIndex) =>
      createCell({
        col: def.col,
        row: def.row,
        colSpan: def.colSpan,
        rowSpan: def.rowSpan,
        imageIndex,
        pack: "grid",
      }),
    ),
  };
}

function footprint(cell, cols, rows) {
  if (cell.pack === "row") return { col: 0, row: cell.row, colSpan: cols, rowSpan: 1 };
  if (cell.pack === "col") return { col: cell.col, row: 0, colSpan: 1, rowSpan: rows };
  return {
    col: cell.col,
    row: cell.row,
    colSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
  };
}

function intersects(a, b) {
  return a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
}

function coversUnit(bounds, col, row) {
  return col >= bounds.col && row >= bounds.row && col < bounds.col + bounds.colSpan && row < bounds.row + bounds.rowSpan;
}

function overlapsOthers(cells, cell, rows, cols) {
  const area = footprint(cell, cols, rows);
  return cells.some((other) => other !== cell && intersects(area, footprint(other, cols, rows)));
}

function evenIntegerSpans(total, count) {
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

function materializePack(cells, cell, rows, cols) {
  if (cell.pack === "row") {
    const group = cells
      .filter((item) => item.pack === "row" && item.row === cell.row)
      .sort((a, b) => a.col - b.col || a.id.localeCompare(b.id));
    const spans = evenIntegerSpans(cols, group.length);
    let col = 0;
    group.forEach((item, index) => {
      item.pack = "grid";
      item.row = cell.row;
      item.col = col;
      item.colSpan = Math.max(1, spans[index]);
      item.rowSpan = 1;
      col += item.colSpan;
    });
    return;
  }
  if (cell.pack === "col") {
    const group = cells
      .filter((item) => item.pack === "col" && item.col === cell.col)
      .sort((a, b) => a.row - b.row || a.id.localeCompare(b.id));
    const spans = evenIntegerSpans(rows, group.length);
    let row = 0;
    group.forEach((item, index) => {
      item.pack = "grid";
      item.col = cell.col;
      item.row = row;
      item.rowSpan = Math.max(1, spans[index]);
      item.colSpan = 1;
      row += item.rowSpan;
    });
  }
}

function cloneCells(cells) {
  return cells.map((cell) => ({ ...cell }));
}

export function growCell(cells, id, axis, rows, cols) {
  const draft = cloneCells(cells);
  const cell = draft.find((item) => item.id === id);
  if (!cell) return { ok: false, reason: "missing" };
  materializePack(draft, cell, rows, cols);
  if (axis === "col") {
    if (cell.col + cell.colSpan >= cols) return { ok: false, reason: "edge" };
    cell.colSpan += 1;
  } else {
    if (cell.row + cell.rowSpan >= rows) return { ok: false, reason: "edge" };
    cell.rowSpan += 1;
  }
  if (overlapsOthers(draft, cell, rows, cols)) return { ok: false, reason: "overlap" };
  cells.splice(0, cells.length, ...draft);
  return { ok: true };
}

export function shrinkCell(cells, id, axis, rows, cols) {
  const draft = cloneCells(cells);
  const cell = draft.find((item) => item.id === id);
  if (!cell) return { ok: false, reason: "missing" };
  materializePack(draft, cell, rows, cols);
  if (axis === "col") {
    if (cell.colSpan <= 1) return { ok: false, reason: "min" };
    cell.colSpan -= 1;
  } else {
    if (cell.rowSpan <= 1) return { ok: false, reason: "min" };
    cell.rowSpan -= 1;
  }
  cells.splice(0, cells.length, ...draft);
  return { ok: true };
}

function rowIsPackable(cells, row, cols, rows) {
  const touching = cells.filter((cell) => intersects(footprint(cell, cols, rows), { col: 0, row, colSpan: cols, rowSpan: 1 }));
  const blocked = touching.some((cell) => cell.pack === "col" || cell.rowSpan > 1 || cell.row !== row);
  return { touching, blocked };
}

function colIsPackable(cells, col, cols, rows) {
  const touching = cells.filter((cell) => intersects(footprint(cell, cols, rows), { col, row: 0, colSpan: 1, rowSpan: rows }));
  const blocked = touching.some((cell) => cell.pack === "row" || cell.colSpan > 1 || cell.col !== col);
  return { touching, blocked };
}

export function evenPackRow(cells, row, cols, rows) {
  const { touching, blocked } = rowIsPackable(cells, row, cols, rows);
  if (!touching.length) return { ok: false, reason: "empty" };
  if (blocked) return { ok: false, reason: "blocked" };
  if (touching.length > cols) return { ok: false, reason: "crowded" };
  touching
    .sort((a, b) => a.col - b.col || a.id.localeCompare(b.id))
    .forEach((cell, index) => {
      cell.pack = "row";
      cell.row = row;
      cell.col = index;
      cell.colSpan = 1;
      cell.rowSpan = 1;
    });
  return { ok: true };
}

export function evenPackCol(cells, col, cols, rows) {
  const { touching, blocked } = colIsPackable(cells, col, cols, rows);
  if (!touching.length) return { ok: false, reason: "empty" };
  if (blocked) return { ok: false, reason: "blocked" };
  if (touching.length > rows) return { ok: false, reason: "crowded" };
  touching
    .sort((a, b) => a.row - b.row || a.id.localeCompare(b.id))
    .forEach((cell, index) => {
      cell.pack = "col";
      cell.col = col;
      cell.row = index;
      cell.colSpan = 1;
      cell.rowSpan = 1;
    });
  return { ok: true };
}

export function placeCell(cells, col, row, imageIndex, rows, cols) {
  const existing = cells.find((cell) => coversUnit(footprint(cell, cols, rows), col, row));
  if (existing) return { ok: true, id: existing.id, created: false };
  const cell = createCell({ col, row, imageIndex, pack: "grid", colSpan: 1, rowSpan: 1 });
  if (overlapsOthers(cells.concat(cell), cell, rows, cols)) return { ok: false, reason: "overlap" };
  cells.push(cell);
  return { ok: true, id: cell.id, created: true };
}

export function clearCell(cells, id) {
  const index = cells.findIndex((cell) => cell.id === id);
  if (index < 0) return false;
  cells.splice(index, 1);
  return true;
}

export function fitCellsToGrid(cells, rows, cols) {
  const next = [];
  for (const cell of cells) {
    if (cell.pack === "row") {
      if (cell.row < 0 || cell.row >= rows) continue;
      next.push({ ...cell, rowSpan: 1, colSpan: 1 });
      continue;
    }
    if (cell.pack === "col") {
      if (cell.col < 0 || cell.col >= cols) continue;
      next.push({ ...cell, rowSpan: 1, colSpan: 1 });
      continue;
    }
    if (cell.col >= cols || cell.row >= rows || cell.col < 0 || cell.row < 0) continue;
    next.push({
      ...cell,
      colSpan: Math.max(1, Math.min(cell.colSpan, cols - cell.col)),
      rowSpan: Math.max(1, Math.min(cell.rowSpan, rows - cell.row)),
    });
  }
  const kept = [];
  for (const cell of next) {
    if (overlapsOthers(kept.concat(cell), cell, rows, cols)) continue;
    kept.push(cell);
  }
  return kept;
}

function gridRect(col, row, colSpan, rowSpan, cell, gap, margin) {
  return {
    x: margin + col * (cell + gap),
    y: margin + row * (cell + gap),
    w: colSpan * cell + Math.max(0, colSpan - 1) * gap,
    h: rowSpan * cell + Math.max(0, rowSpan - 1) * gap,
  };
}

function packLine(count, total, gap) {
  const inner = total - Math.max(0, count - 1) * gap;
  const base = Math.floor(inner / count);
  const extra = inner - base * count;
  const sizes = Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
  const positions = [];
  let cursor = 0;
  sizes.forEach((size) => {
    positions.push(cursor);
    cursor += size + gap;
  });
  return { sizes, positions };
}

function layoutTiles(source, rows, cols, cell, gap, margin) {
  const contentW = cols * cell + Math.max(0, cols - 1) * gap;
  const contentH = rows * cell + Math.max(0, rows - 1) * gap;
  const rowGroups = new Map();
  const colGroups = new Map();
  source.forEach((item) => {
    if (item.pack === "row") {
      const list = rowGroups.get(item.row) || [];
      list.push(item);
      rowGroups.set(item.row, list);
    } else if (item.pack === "col") {
      const list = colGroups.get(item.col) || [];
      list.push(item);
      colGroups.set(item.col, list);
    }
  });
  const tiles = [];
  for (const item of source) {
    if (item.pack === "row") {
      const group = rowGroups.get(item.row).slice().sort((a, b) => a.col - b.col || a.id.localeCompare(b.id));
      const index = group.findIndex((entry) => entry.id === item.id);
      const packed = packLine(group.length, contentW, gap);
      tiles.push({
        id: item.id,
        imageIndex: item.imageIndex,
        pack: "row",
        ...{
          x: margin + packed.positions[index],
          y: margin + item.row * (cell + gap),
          w: packed.sizes[index],
          h: cell,
        },
      });
      continue;
    }
    if (item.pack === "col") {
      const group = colGroups.get(item.col).slice().sort((a, b) => a.row - b.row || a.id.localeCompare(b.id));
      const index = group.findIndex((entry) => entry.id === item.id);
      const packed = packLine(group.length, contentH, gap);
      tiles.push({
        id: item.id,
        imageIndex: item.imageIndex,
        pack: "col",
        x: margin + item.col * (cell + gap),
        y: margin + packed.positions[index],
        w: cell,
        h: packed.sizes[index],
      });
      continue;
    }
    tiles.push({
      id: item.id,
      imageIndex: item.imageIndex,
      pack: "grid",
      col: item.col,
      row: item.row,
      colSpan: item.colSpan,
      rowSpan: item.rowSpan,
      ...gridRect(item.col, item.row, item.colSpan, item.rowSpan, cell, gap, margin),
    });
  }
  return tiles;
}

export function buildCollageLayout({ presetId, rows, cols, cell, gap, margin, cells }) {
  const preset = presetById(presetId || "custom");
  const explicit = Array.isArray(cells);
  const useCols = Math.max(1, Math.min(MAX_GRID, explicit ? cols : preset.id === "custom" ? cols : preset.cols));
  const useRows = Math.max(1, Math.min(MAX_GRID, explicit ? rows : preset.id === "custom" ? rows : preset.rows));
  const source = explicit
    ? cells
    : (preset.cells ?? gridCells(useCols, useRows)).map((def, imageIndex) => ({
        id: `p${imageIndex}`,
        imageIndex,
        col: def.col,
        row: def.row,
        colSpan: def.colSpan,
        rowSpan: def.rowSpan,
        pack: "grid",
      }));
  return {
    width: margin * 2 + useCols * cell + Math.max(0, useCols - 1) * gap,
    height: margin * 2 + useRows * cell + Math.max(0, useRows - 1) * gap,
    tiles: layoutTiles(source, useRows, useCols, cell, gap, margin),
    cols: useCols,
    rows: useRows,
    cell,
    gap,
    margin,
  };
}

function tilesForLongSide({ count, direction, gap, margin, resolution, aspect }) {
  let lo = 1;
  let hi = Math.max(1, resolution);
  let best = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const sized = combineTileSize({
      count,
      direction,
      gap,
      margin,
      resolutionMode: "edge",
      resolution: mid,
      aspect,
    });
    const layout = buildCombineLayout({
      count,
      direction,
      tileW: sized.tileW,
      tileH: sized.tileH,
      gap,
      margin,
    });
    if (Math.max(layout.width, layout.height) <= resolution) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return combineTileSize({
    count,
    direction,
    gap,
    margin,
    resolutionMode: "edge",
    resolution: best,
    aspect,
  });
}

function applyLimit(make) {
  let factor = 1;
  let layout = make(1);
  for (let pass = 0; pass < 4; pass += 1) {
    const next = limitFactor(layout.width, layout.height);
    if (next >= 0.999) {
      layout.limited = factor < 0.999;
      return layout;
    }
    factor *= next * 0.995;
    layout = make(factor);
    layout.limited = true;
  }
  layout.limited = true;
  return layout;
}

export function resolveCombineLayout(settings, count) {
  const safeCount = Math.max(0, count | 0);
  const gap = intIn(settings.gap, 0, 400, 0);
  const margin = settings.symmetric ? gap : intIn(settings.margin, 0, 400, gap);
  const resolution = intIn(settings.resolution, MIN_RESOLUTION, MAX_RESOLUTION, 1600);
  const aspect = Number(settings.aspect) > 0 ? Number(settings.aspect) : 1;
  const direction = settings.direction === "vertical" ? "vertical" : "horizontal";
  const resolutionMode = settings.resolutionMode || "edge";
  if (safeCount === 0) {
    return { width: 1, height: 1, tiles: [], tileW: 1, tileH: 1, limited: false };
  }
  const base =
    resolutionMode === "long"
      ? tilesForLongSide({
          count: safeCount,
          direction,
          gap,
          margin,
          resolution,
          aspect,
        })
      : combineTileSize({
          count: safeCount,
          direction,
          gap,
          margin,
          resolutionMode,
          resolution,
          aspect,
        });
  return applyLimit((factor) =>
    buildCombineLayout({
      count: safeCount,
      direction,
      tileW: Math.max(1, Math.round(base.tileW * factor)),
      tileH: Math.max(1, Math.round(base.tileH * factor)),
      gap: Math.max(0, Math.round(gap * factor)),
      margin: Math.max(0, Math.round(margin * factor)),
    }),
  );
}

function collageCellForLongSide(settings, target) {
  const gap = intIn(settings.gap, 0, 400, 0);
  const margin = settings.symmetric ? gap : intIn(settings.margin, 0, 400, gap);
  let lo = 1;
  let hi = Math.max(1, target);
  let best = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const layout = buildCollageLayout({
      presetId: settings.preset,
      rows: settings.rows,
      cols: settings.cols,
      cells: settings.cells,
      cell: mid,
      gap,
      margin,
    });
    if (Math.max(layout.width, layout.height) <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function resolveCollageLayout(settings) {
  const gap = intIn(settings.gap, 0, 400, 0);
  const margin = settings.symmetric ? gap : intIn(settings.margin, 0, 400, gap);
  const rows = intIn(settings.rows, 1, MAX_GRID, 2);
  const cols = intIn(settings.cols, 1, MAX_GRID, 2);
  let cell;
  if (settings.resolutionMode === "long") {
    cell = collageCellForLongSide(
      { ...settings, rows, cols, gap, margin, symmetric: false },
      intIn(settings.longSide, MIN_RESOLUTION, MAX_RESOLUTION, 2400),
    );
  } else {
    cell = intIn(settings.cell, MIN_RESOLUTION, MAX_RESOLUTION, 1200);
  }
  return applyLimit((factor) =>
    buildCollageLayout({
      presetId: settings.preset,
      rows,
      cols,
      cells: settings.cells,
      cell: Math.max(1, Math.round(cell * factor)),
      gap: Math.max(0, Math.round(gap * factor)),
      margin: Math.max(0, Math.round(margin * factor)),
    }),
  );
}

export function hitTest(layout, x, y) {
  for (let i = layout.tiles.length - 1; i >= 0; i -= 1) {
    const tile = layout.tiles[i];
    if (x >= tile.x && y >= tile.y && x < tile.x + tile.w && y < tile.y + tile.h) {
      return tile;
    }
  }
  return null;
}

export function randomFill(cells, photoCount, random = Math.random) {
  const slots = cells.slice();
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  for (const cell of cells) cell.imageIndex = null;
  const photos = [];
  for (let i = 0; i < photoCount; i += 1) photos.push(i);
  for (let i = photos.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  const count = Math.min(photos.length, slots.length);
  for (let i = 0; i < count; i += 1) slots[i].imageIndex = photos[i];
}

function unitsOf(rect) {
  const units = [];
  for (let row = rect.row; row < rect.row + rect.rowSpan; row += 1) {
    for (let col = rect.col; col < rect.col + rect.colSpan; col += 1) units.push({ col, row });
  }
  return units;
}

function sameUnit(a, b) {
  return a.col === b.col && a.row === b.row;
}

function rectContains(outer, inner) {
  return (
    inner.col >= outer.col &&
    inner.row >= outer.row &&
    inner.col + inner.colSpan <= outer.col + outer.colSpan &&
    inner.row + inner.rowSpan <= outer.row + outer.rowSpan
  );
}

export function relocateBlock(cells, id, col, row, rows, cols) {
  const draft = cloneCells(cells);
  const cell = draft.find((item) => item.id === id);
  if (!cell) return { ok: false, reason: "missing" };
  if (col < 0 || row < 0 || col + cell.colSpan > cols || row + cell.rowSpan > rows) {
    return { ok: false, reason: "edge" };
  }
  if (cell.col === col && cell.row === row) return { ok: true, kind: "same" };

  const dest = { col, row, colSpan: cell.colSpan, rowSpan: cell.rowSpan };
  const source = { col: cell.col, row: cell.row, colSpan: cell.colSpan, rowSpan: cell.rowSpan };
  const hits = draft.filter((other) => other.id !== cell.id && intersects(dest, footprint(other, cols, rows)));
  if (hits.length === 0) {
    cell.col = col;
    cell.row = row;
    cells.splice(0, cells.length, ...draft);
    return { ok: true, kind: "move" };
  }
  if (
    hits.length === 1 &&
    hits[0].col === col &&
    hits[0].row === row &&
    hits[0].colSpan === cell.colSpan &&
    hits[0].rowSpan === cell.rowSpan
  ) {
    hits[0].col = source.col;
    hits[0].row = source.row;
    cell.col = col;
    cell.row = row;
    cells.splice(0, cells.length, ...draft);
    return { ok: true, kind: "swap" };
  }
  if (!hits.every((hit) => rectContains(dest, footprint(hit, cols, rows)))) {
    return { ok: false, reason: "blocked" };
  }
  const destUnits = unitsOf(dest);
  const sourceUnits = unitsOf(source);
  for (const unit of destUnits) {
    const insideSource = sourceUnits.some((item) => sameUnit(item, unit));
    const cover = hits.filter((hit) => coversUnit(footprint(hit, cols, rows), unit.col, unit.row));
    if (insideSource && cover.length !== 0) return { ok: false, reason: "blocked" };
    if (!insideSource && cover.length !== 1) return { ok: false, reason: "blocked" };
  }
  const vacated = sourceUnits.filter((unit) => !destUnits.some((item) => sameUnit(item, unit)));
  const hitArea = hits.reduce((sum, hit) => sum + hit.colSpan * hit.rowSpan, 0);
  if (hitArea !== vacated.length || hits.some((hit) => hit.colSpan !== 1 || hit.rowSpan !== 1)) {
    return { ok: false, reason: "blocked" };
  }
  vacated.sort((a, b) => a.row - b.row || a.col - b.col);
  hits
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .forEach((hit, index) => {
      hit.col = vacated[index].col;
      hit.row = vacated[index].row;
    });
  cell.col = col;
  cell.row = row;
  cells.splice(0, cells.length, ...draft);
  return { ok: true, kind: "move" };
}

export function swapImages(cells, sourceId, targetId) {
  const source = cells.find((cell) => cell.id === sourceId);
  const target = cells.find((cell) => cell.id === targetId);
  if (!source || !target || source === target) return { ok: false, reason: "missing" };
  const image = source.imageIndex;
  source.imageIndex = target.imageIndex;
  target.imageIndex = image;
  return { ok: true, kind: "swap-image", id: sourceId };
}

export function placePhoto(cells, photoIndex, col, row, cols, rows) {
  const target = cells.find((cell) => coversUnit(footprint(cell, cols, rows), col, row));
  if (!target) return { ok: false, reason: "missing" };
  if (target.imageIndex === photoIndex) return { ok: true, kind: "same" };
  const previous = cells.find((cell) => cell !== target && cell.imageIndex === photoIndex);
  const displaced = target.imageIndex;
  target.imageIndex = photoIndex;
  if (previous) previous.imageIndex = displaced;
  return { ok: true, kind: previous || Number.isInteger(displaced) ? "swap" : "place" };
}

export function mergeCells(cells, ids) {
  const chosen = cells.filter((cell) => ids.includes(cell.id));
  if (chosen.length < 2) return { ok: false, reason: "few" };
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = 0;
  let maxRow = 0;
  let area = 0;
  for (const cell of chosen) {
    minCol = Math.min(minCol, cell.col);
    minRow = Math.min(minRow, cell.row);
    maxCol = Math.max(maxCol, cell.col + cell.colSpan);
    maxRow = Math.max(maxRow, cell.row + cell.rowSpan);
    area += cell.colSpan * cell.rowSpan;
  }
  const width = maxCol - minCol;
  const height = maxRow - minRow;
  if (area !== width * height) return { ok: false, reason: "shape" };
  for (let row = minRow; row < maxRow; row += 1) {
    for (let col = minCol; col < maxCol; col += 1) {
      const covers = chosen.filter((cell) =>
        coversUnit({ col: cell.col, row: cell.row, colSpan: cell.colSpan, rowSpan: cell.rowSpan }, col, row),
      );
      if (covers.length !== 1) return { ok: false, reason: "shape" };
    }
  }
  const imageIndex = chosen.find((cell) => Number.isInteger(cell.imageIndex))?.imageIndex ?? null;
  const merged = createCell({
    col: minCol,
    row: minRow,
    colSpan: width,
    rowSpan: height,
    imageIndex,
    pack: "grid",
  });
  const rest = cells.filter((cell) => !ids.includes(cell.id));
  rest.push(merged);
  cells.splice(0, cells.length, ...rest);
  return { ok: true, id: merged.id };
}

export function splitCell(cells, id) {
  const index = cells.findIndex((cell) => cell.id === id);
  if (index < 0) return { ok: false, reason: "missing" };
  const cell = cells[index];
  if (cell.colSpan === 1 && cell.rowSpan === 1) return { ok: false, reason: "min" };
  const pieces = [];
  for (let row = 0; row < cell.rowSpan; row += 1) {
    for (let col = 0; col < cell.colSpan; col += 1) {
      const piece = createCell({
        col: cell.col + col,
        row: cell.row + row,
        imageIndex: row === 0 && col === 0 ? cell.imageIndex : null,
        pack: "grid",
      });
      if (row === 0 && col === 0) piece.id = cell.id;
      pieces.push(piece);
    }
  }
  cells.splice(index, 1, ...pieces);
  return { ok: true, id: cell.id };
}

export function addGridLine(cells, rows, cols, axis) {
  if (axis === "row") {
    const row = rows - 1;
    for (let col = 0; col < cols; col += 1) {
      const covered = cells.some((cell) => coversUnit(footprint(cell, cols, rows), col, row));
      if (!covered) cells.push(createCell({ col, row, imageIndex: null, pack: "grid" }));
    }
    return;
  }
  const col = cols - 1;
  for (let row = 0; row < rows; row += 1) {
    const covered = cells.some((cell) => coversUnit(footprint(cell, cols, rows), col, row));
    if (!covered) cells.push(createCell({ col, row, imageIndex: null, pack: "grid" }));
  }
}

export function hitUnit(layout, x, y) {
  const { cell, gap, margin, cols, rows } = layout;
  if (!(cell > 0)) return null;
  const col = Math.floor((x - margin) / (cell + gap));
  const row = Math.floor((y - margin) / (cell + gap));
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  const localX = x - margin - col * (cell + gap);
  const localY = y - margin - row * (cell + gap);
  if (localX < 0 || localY < 0 || localX > cell || localY > cell) return null;
  return { col, row };
}

export function nearestUnit(layout, x, y) {
  const exact = hitUnit(layout, x, y);
  if (exact) return exact;
  const { cell, gap, margin, cols, rows, width, height } = layout;
  if (!(cell > 0) || x < margin || y < margin || x > width - margin || y > height - margin) return null;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x - margin) / (cell + gap))));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y - margin) / (cell + gap))));
  return { col, row };
}
