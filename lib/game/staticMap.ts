/**
 * Island shape — simple, natural, no gimmicks.
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

export function parseElevation(): number[][] {
  const grid: number[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array(MAP_COLS).fill(0)
  );

  const noise = makeNoise2D(77);
  const noise2 = makeNoise2D(333);

  const cx = MAP_COLS / 2;
  const cy = MAP_ROWS / 2;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      // Cayo Perico — polygon outline nabouwen van de reference
      // Reference: breed boven met NW landingsbaan-schiereiland,
      // inham rechts-midden, smal taille, breed onderstuk met
      // SW schiereiland, puntig onderaan.

      // Cayo Perico silhouette — preciezer nagebouwd
      const poly: Array<[number, number]> = [
        // === TOP: breed plateau met NW airstrip ===
        [cx - 6,  cy - 38],  // top midden
        [cx + 8,  cy - 39],  // top rechts van midden
        [cx + 16, cy - 36],  // rechtsboven hoek
        [cx + 22, cy - 32],  // oost-bovenkant
        [cx + 24, cy - 26],  // rechts boven — buikt uit

        // === RECHTS BOVEN: inham/baai ===
        [cx + 20, cy - 20],  // begint naar binnen
        [cx + 14, cy - 16],  // diepste punt inham
        [cx + 16, cy - 12],  // terug naar buiten

        // === RECHTS MIDDEN: smalle taille ===
        [cx + 12, cy - 6],   // naar binnen
        [cx + 8,  cy - 1],   // smalste punt
        [cx + 10, cy + 4],   // begint breder

        // === RECHTS ONDER: breed onderstuk ===
        [cx + 18, cy + 10],  // uitbuiking
        [cx + 22, cy + 16],  // breedste punt rechts
        [cx + 24, cy + 22],  // oost-onderkant
        [cx + 20, cy + 28],  // begint te versmallen

        // === ONDERKANT: puntig naar zuiden ===
        [cx + 14, cy + 33],  // rechts-onder
        [cx + 6,  cy + 37],  // zuidpunt rechts
        [cx - 2,  cy + 40],  // zuidelijkste punt
        [cx - 10, cy + 38],  // zuidpunt links

        // === LINKS ONDER ===
        [cx - 16, cy + 34],  // ZW hoek
        [cx - 20, cy + 28],  // links-onderkant

        // === SW SCHIEREILAND ===
        [cx - 28, cy + 22],  // uitstekend naar westen
        [cx - 32, cy + 16],  // punt van schiereiland
        [cx - 28, cy + 10],  // terug naar boven

        // === LINKS MIDDEN ===
        [cx - 20, cy + 4],   // links taille
        [cx - 16, cy - 2],   // smalste punt links
        [cx - 18, cy - 8],   // naar boven

        // === LINKS BOVEN ===
        [cx - 16, cy - 14],  // links-boven
        [cx - 20, cy - 18],  // begint NW schiereiland

        // === NW SCHIEREILAND (airstrip) ===
        [cx - 28, cy - 22],  // naar NW
        [cx - 36, cy - 28],  // airstrip punt NW
        [cx - 38, cy - 32],  // noordelijkste punt airstrip
        [cx - 34, cy - 35],  // bocht naar oost
        [cx - 26, cy - 36],  // terug richting top
        [cx - 18, cy - 38],  // bijna terug
        [cx - 12, cy - 39],  // top-links
      ];

      // Point-in-polygon test (ray casting)
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (((yi > r) !== (yj > r)) && (c < (xj - xi) * (r - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }

      // Noise voor organische kustlijn (niet te veel — vorm moet herkenbaar blijven)
      if (inside) {
        // Check of we dicht bij de rand zijn — alleen daar noise toepassen
        let minEdgeDist = 999;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [x1, y1] = poly[i];
          const [x2, y2] = poly[j];
          const dx = x2 - x1, dy = y2 - y1;
          const len2 = dx * dx + dy * dy;
          let t = len2 > 0 ? ((c - x1) * dx + (r - y1) * dy) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          const px = x1 + t * dx, py = y1 + t * dy;
          const d = Math.hypot(c - px, r - py);
          if (d < minEdgeDist) minEdgeDist = d;
        }

        const n = fbm(noise, c * 0.06, r * 0.06, 4) * 4;
        // Alleen near de rand subtracteren voor organische kust
        if (minEdgeDist > 2 + n) {
          grid[r][c] = 3;
        }
      }
    }
  }

  // Kleine eilandjes weg
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
      if (comp.length < 15) comp.forEach(([cr, cc]) => { grid[cr][cc] = 0; });
    }
  }

  // Kleine gaatjes dicht
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
      if (!touchesEdge && comp.length < 10) comp.forEach(([cr, cc]) => { grid[cr][cc] = 3; });
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
