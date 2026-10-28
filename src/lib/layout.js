/** Integer layouts for the equal-tile strip and the collage grid. */

export const MAX_EDGE = 8192;
export const MAX_PIXELS = 24_000_000;
export const MIN_RESOLUTION = 256;
export const MAX_RESOLUTION = 8192;

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

export function buildCollageLayout({ presetId, rows, cols, cell, gap, margin }) {
  const preset = presetById(presetId);
  const useCols = Math.max(1, preset.id === "custom" ? cols : preset.cols);
  const useRows = Math.max(1, preset.id === "custom" ? rows : preset.rows);
  const cells = preset.cells ?? gridCells(useCols, useRows);
  const tiles = cells.map((cellDef, imageIndex) => ({
    imageIndex,
    x: margin + cellDef.col * (cell + gap),
    y: margin + cellDef.row * (cell + gap),
    w: cellDef.colSpan * cell + (cellDef.colSpan - 1) * gap,
    h: cellDef.rowSpan * cell + (cellDef.rowSpan - 1) * gap,
  }));
  return {
    width: margin * 2 + useCols * cell + (useCols - 1) * gap,
    height: margin * 2 + useRows * cell + (useRows - 1) * gap,
    tiles,
    cols: useCols,
    rows: useRows,
    cell,
  };
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
  const base = combineTileSize({
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
  const rows = intIn(settings.rows, 1, 4, 2);
  const cols = intIn(settings.cols, 1, 4, 2);
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
