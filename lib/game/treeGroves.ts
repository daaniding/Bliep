/**
 * Tree grove clustering algorithm.
 *
 * Instead of scattering trees randomly per-cell, this generates
 * natural-looking groves: clusters of trees with varying density,
 * type, and size. Creates a forest-like feel at the island edges
 * and orchards near the center.
 */

export type GroveType = 'dense' | 'light' | 'orchard' | 'cherry';

export interface TreePlacement {
  gx: number;
  gy: number;
  /** Sub-tile offset for natural look (-0.3 to 0.3). */
  offsetX: number;
  offsetY: number;
  type: 'basic' | 'large' | 'cherry' | 'fruit' | 'pine';
  /** Index into the corresponding terrain array. */
  sheetIndex: number;
  /** Scale multiplier. */
  scale: number;
}

interface GroveCenter {
  gx: number;
  gy: number;
  radius: number;
  type: GroveType;
  treeCount: number;
}

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Generate tree placements using grove-based clustering.
 *
 * @param elevation The processed elevation grid (0-4 values)
 * @param mapCols Grid width
 * @param mapRows Grid height
 * @param centerGx World-grid X of island center
 * @param centerGy World-grid Y of island center
 * @param offsetGx Map-to-world X offset
 * @param offsetGy Map-to-world Y offset
 * @param seed Random seed
 */
export function generateGroves(
  elevation: number[][],
  mapCols: number,
  mapRows: number,
  centerGx: number,
  centerGy: number,
  offsetGx: number,
  offsetGy: number,
  seed: number,
): TreePlacement[] {
  const rand = seededRng(seed * 7919 + 31337);

  // Collect grass cells (elevation 3) for grove placement
  const grassCells: Array<{ gx: number; gy: number; rx: number; ry: number }> = [];
  for (let ry = 0; ry < mapRows; ry++) {
    for (let rx = 0; rx < mapCols; rx++) {
      if (elevation[ry][rx] === 3) {
        grassCells.push({ gx: offsetGx + rx, gy: offsetGy + ry, rx, ry });
      }
    }
  }

  // Distance from island center
  const centerDist = (gx: number, gy: number) =>
    Math.hypot(gx - centerGx, gy - centerGy);

  // Distance from any non-grass cell (coast/sand proximity)
  const distFromEdge = (rx: number, ry: number): number => {
    for (let d = 1; d <= 5; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) === d || Math.abs(dy) === d) {
            const v = elevation[ry + dy]?.[rx + dx] ?? 0;
            if (v !== 3) return d;
          }
        }
      }
    }
    return 6;
  };

  // ---- Step 1: Pick grove centers using Poisson-disk-like sampling ----
  const groves: GroveCenter[] = [];
  const minSpacing = 7;
  const maxGroves = 16;
  const attempts = 200;

  for (let i = 0; i < attempts && groves.length < maxGroves; i++) {
    const idx = Math.floor(rand() * grassCells.length);
    const cell = grassCells[idx];
    const cd = centerDist(cell.gx, cell.gy);
    const ed = distFromEdge(cell.rx, cell.ry);

    // Must be far enough from center (keep build area clear)
    if (cd < 10) continue;
    // Must be at least 3 tiles from edge (not on beach)
    if (ed < 3) continue;

    // Check spacing from existing groves
    const tooClose = groves.some(g =>
      Math.hypot(g.gx - cell.gx, g.gy - cell.gy) < minSpacing
    );
    if (tooClose) continue;

    // Determine grove type based on position
    let type: GroveType;
    if (cd > 28) {
      type = 'dense'; // outer ring = dense forest
    } else if (cd > 20) {
      type = rand() < 0.3 ? 'cherry' : 'light'; // mid ring = light woodland or cherry
    } else {
      type = rand() < 0.5 ? 'orchard' : 'light'; // inner ring = orchard or light
    }

    const radius = type === 'dense' ? 4 + rand() * 3
                 : type === 'cherry' ? 3 + rand() * 2
                 : type === 'orchard' ? 4 + rand() * 2
                 : 3 + rand() * 3;

    const treeCount = type === 'dense' ? 12 + Math.floor(rand() * 10)
                    : type === 'cherry' ? 3 + Math.floor(rand() * 3)
                    : type === 'orchard' ? 6 + Math.floor(rand() * 5)
                    : 5 + Math.floor(rand() * 6);

    groves.push({ gx: cell.gx, gy: cell.gy, radius, type, treeCount });
  }

  // ---- Step 2: Place trees within each grove ----
  const placements: TreePlacement[] = [];
  const usedCells = new Set<string>();

  for (const grove of groves) {
    for (let t = 0; t < grove.treeCount; t++) {
      // Gaussian-ish distribution around grove center
      const angle = rand() * Math.PI * 2;
      const dist = rand() * rand() * grove.radius; // squared for center-heavy distribution
      const gx = Math.round(grove.gx + Math.cos(angle) * dist);
      const gy = Math.round(grove.gy + Math.sin(angle) * dist);

      const key = `${gx},${gy}`;
      if (usedCells.has(key)) continue;

      // Verify this is a grass cell
      const rx = gx - offsetGx;
      const ry = gy - offsetGy;
      if (rx < 0 || rx >= mapCols || ry < 0 || ry >= mapRows) continue;
      if (elevation[ry][rx] !== 3) continue;

      usedCells.add(key);

      // Determine tree type based on grove type
      let type: TreePlacement['type'];
      let scale: number;

      switch (grove.type) {
        case 'dense':
          if (rand() < 0.15) { type = 'large'; scale = 2.5 + rand() * 0.8; }
          else if (rand() < 0.2) { type = 'pine'; scale = 2.0 + rand() * 0.6; }
          else { type = 'basic'; scale = 2.0 + rand() * 1.0; }
          break;
        case 'cherry':
          type = 'cherry';
          scale = 2.8 + rand() * 0.5;
          break;
        case 'orchard':
          type = 'fruit';
          scale = 2.2 + rand() * 0.5;
          break;
        case 'light':
        default:
          if (rand() < 0.3) { type = 'pine'; scale = 1.8 + rand() * 0.5; }
          else { type = 'basic'; scale = 2.0 + rand() * 0.8; }
          break;
      }

      placements.push({
        gx, gy,
        offsetX: (rand() - 0.5) * 0.3,
        offsetY: (rand() - 0.5) * 0.3,
        type,
        sheetIndex: Math.floor(rand() * 100), // will be modulo'd by array length
        scale,
      });
    }
  }

  // ---- Step 3: Add sparse individual trees outside groves ----
  // A few lone trees scattered around for natural feel
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 12) continue; // keep center clear
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 3) continue; // not near coast
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.008) continue; // very sparse (~0.8%)

    placements.push({
      gx: cell.gx, gy: cell.gy,
      offsetX: (rand() - 0.5) * 0.2,
      offsetY: (rand() - 0.5) * 0.2,
      type: rand() < 0.2 ? 'pine' : 'basic',
      sheetIndex: Math.floor(rand() * 100),
      scale: 1.8 + rand() * 0.8,
    });
  }

  return placements;
}
