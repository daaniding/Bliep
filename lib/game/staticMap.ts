/**
 * Island generation — distance-field based.
 *
 * Instead of ASCII art, the island shape is generated from a smooth
 * distance function + multi-octave noise. This produces naturally
 * organic coastlines without staircase artifacts.
 *
 * Grid values:
 *   0 = deep water
 *   1 = shallow water (near coast)
 *   3 = grass (buildable land)
 *   4 = lake water
 */

export const MAP_COLS = 120;
export const MAP_ROWS = 90;

// ---- Seeded noise helpers ----

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Simple 2D value noise with smooth interpolation. */
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
    // Smoothstep
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = lattice(ix, iy), n10 = lattice(ix + 1, iy);
    const n01 = lattice(ix, iy + 1), n11 = lattice(ix + 1, iy + 1);
    return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy)
         + n01 * (1 - sx) * sy + n11 * sx * sy;
  };
}

/** Multi-octave fractal noise (fBm). */
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

// ================================================================
// ISLAND GENERATION
// ================================================================

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise = makeNoise2D(42);
  const centerX = MAP_COLS / 2;
  const centerY = MAP_ROWS / 2;
  // Ellipse radii — wider than tall for natural island shape
  const radiusX = MAP_COLS * 0.38;
  const radiusY = MAP_ROWS * 0.38;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // Normalized distance from center (0 = center, 1 = edge of ellipse)
      const dx = (c - centerX) / radiusX;
      const dy = (r - centerY) / radiusY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Noise perturbation for organic edge (3 octaves)
      const n = fbm(noise, c * 0.04, r * 0.04, 3) * 0.35;

      // Land if distance + noise < threshold
      if (dist + n < 0.85) {
        grid[r][c] = 3; // grass
      }
    }
  }

  return grid;
}

// ================================================================
// POST-PROCESSING
// ================================================================

export function processElevation(raw: number[][]): number[][] {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const grid: number[][] = raw.map(r => [...r]);

  // ---- Shallow water: ocean cells within 3 tiles of land ----
  const distToLand: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(999)
  );
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
      if (grid[r][c] === 0 && distToLand[r][c] <= 3) {
        grid[r][c] = 1; // shallow water
      }
    }
  }

  // ---- Lake — smooth blob in the northeast ----
  const lakeNoise = makeNoise2D(1337);
  const lakeCX = 70, lakeCY = 24;
  const lakeRX = 7, lakeRY = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 3) continue;
      const dx = (c - lakeCX) / lakeRX;
      const dy = (r - lakeCY) / lakeRY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(lakeNoise, c * 0.08, r * 0.08, 2) * 0.3;
      if (dist + n < 0.9) {
        grid[r][c] = 4; // lake
      }
    }
  }

  return grid;
}
