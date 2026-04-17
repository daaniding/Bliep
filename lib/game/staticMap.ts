/**
 * Island generation — Stardew Valley inspired shape.
 *
 * Natural, cozy farm island with a protected harbor bay,
 * winding coastline, and distinct areas for different zones.
 *
 * Grid values:
 *   0 = deep water
 *   1 = shallow water (near coast)
 *   3 = grass (land)
 */

export const MAP_COLS = 120;
export const MAP_ROWS = 90;

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function makeNoise2D(seed: number) {
  const rng = seededRng(seed);
  const grid = new Map<string, number>();
  const lattice = (ix: number, iy: number): number => {
    const key = `${ix},${iy}`;
    let v = grid.get(key);
    if (v === undefined) { v = rng(); grid.set(key, v); }
    return v;
  };
  return (x: number, y: number): number => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = lattice(ix, iy), n10 = lattice(ix + 1, iy);
    const n01 = lattice(ix, iy + 1), n11 = lattice(ix + 1, iy + 1);
    return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy)
         + n01 * (1 - sx) * sy + n11 * sx * sy;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let value = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / total;
}

function ellipseDist(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise1 = makeNoise2D(55);
  const noise2 = makeNoise2D(201);
  const noise3 = makeNoise2D(3344);

  const cx = MAP_COLS / 2;
  const cy = MAP_ROWS / 2;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // ============================================================
      // NEDERLAND-ACHTIGE VORM
      // Langwerpig van noord naar zuid, breder aan de bovenkant,
      // smaller aan de onderkant, met een inham (Zuiderzee/IJsselmeer)
      // ============================================================

      // --- Brede bovenkant (Noord-Holland/Friesland/Groningen) ---
      const topDist = ellipseDist(c, r, cx, cy - 12, 30, 16);

      // --- Middensectie (Utrecht/Gelderland) smaller ---
      const midDist = ellipseDist(c, r, cx + 2, cy + 2, 22, 14);

      // --- Zuiden (Brabant/Limburg) — smal, loopt naar rechtsonder ---
      const southDist = ellipseDist(c, r, cx + 6, cy + 16, 18, 12);

      // --- Limburg-staart (smal stukje naar beneden) ---
      const limburgDist = ellipseDist(c, r, cx + 14, cy + 26, 8, 10);

      // --- Zeeland/Zuid-Holland bump links onderaan ---
      const zeelandDist = ellipseDist(c, r, cx - 16, cy + 12, 12, 10);

      // --- Noord-Holland neus (uitstekend naar boven) ---
      const nhDist = ellipseDist(c, r, cx - 8, cy - 26, 10, 8);

      // Union
      const minLand = Math.min(topDist, midDist, southDist, limburgDist, zeelandDist, nhDist);

      // --- Zuiderzee/IJsselmeer inham (carves into the top section) ---
      const bayDist = ellipseDist(c, r, cx + 6, cy - 8, 10, 8);

      // --- Westerschelde (small cut between Zeeland and mainland) ---
      const scheldeDist = ellipseDist(c, r, cx - 8, cy + 14, 6, 4);

      // Geen north cove nodig
      const northCoveDist = 999;

      // Organic noise
      const n1 = fbm(noise1, c * 0.028, r * 0.028, 4) * 0.22;
      const n2 = fbm(noise2, c * 0.07, r * 0.07, 3) * 0.12;
      const n3 = fbm(noise3, c * 0.14, r * 0.14, 2) * 0.06;

      const landValue = minLand + n1 + n2 + n3;
      const threshold = 0.95;

      if (landValue < threshold) {
        // Subtract water bodies
        const inBay = bayDist < 0.80 && landValue > threshold * 0.5;
        const inSchelde = scheldeDist < 0.70 && landValue > threshold * 0.6;

        if (!inBay && !inSchelde) {
          grid[r][c] = 3;
        }
      }
    }
  }

  // Remove tiny islands (< 12 cells)
  const visited = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 3 || visited[r][c]) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visited[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        comp.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
          if (grid[nr][nc] !== 3 || visited[nr][nc]) continue;
          visited[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (comp.length < 12) comp.forEach(([cr, cc]) => { grid[cr][cc] = 0; });
    }
  }

  // Fill tiny water holes (< 8 cells)
  const visitedW = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(false));
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (grid[r][c] !== 0 || visitedW[r][c]) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      visitedW[r][c] = true;
      let touchesEdge = false;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        comp.push([cr, cc]);
        if (cr === 0 || cr === MAP_ROWS - 1 || cc === 0 || cc === MAP_COLS - 1) touchesEdge = true;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) { touchesEdge = true; continue; }
          if (grid[nr][nc] !== 0 || visitedW[nr][nc]) continue;
          visitedW[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      if (!touchesEdge && comp.length < 8) comp.forEach(([cr, cc]) => { grid[cr][cc] = 3; });
    }
  }

  return grid;
}

export function processElevation(raw: number[][]): number[][] {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const grid: number[][] = raw.map(r => [...r]);

  // Shallow water
  const distToLand: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(999));
  const queue: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 3) { distToLand[r][c] = 0; queue.push([r, c]); }
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    const d = distToLand[r][c];
    if (d >= 4) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (distToLand[nr][nc] <= d + 1) continue;
      distToLand[nr][nc] = d + 1;
      queue.push([nr, nc]);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0 && distToLand[r][c] <= 3) grid[r][c] = 1;
    }
  }

  return grid;
}
