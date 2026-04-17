/**
 * Tree grove clustering algorithm.
 *
 * Instead of scattering trees randomly per-cell, this generates
 * natural-looking groves: clusters of trees with varying density,
 * type, and size. Creates a forest-like feel at the island edges
 * and orchards near the center.
 */

export type GroveType = 'dense' | 'light' | 'orchard' | 'cherry' | 'mixed';

export interface TreePlacement {
  gx: number;
  gy: number;
  /** Sub-tile offset for natural look (-0.3 to 0.3). */
  offsetX: number;
  offsetY: number;
  type: 'basic' | 'large' | 'cherry' | 'fruit' | 'pine' | 'bush';
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
  const minSpacing = 4;
  const maxGroves = 28;
  const attempts = 600;

  for (let i = 0; i < attempts && groves.length < maxGroves; i++) {
    const idx = Math.floor(rand() * grassCells.length);
    const cell = grassCells[idx];
    const cd = centerDist(cell.gx, cell.gy);
    const ed = distFromEdge(cell.rx, cell.ry);

    // Keep core build area clear but trees close around it
    if (cd < 8) continue;
    // Must be at least 2 tiles from edge (not on beach)
    if (ed < 2) continue;

    // Check spacing from existing groves
    const tooClose = groves.some(g =>
      Math.hypot(g.gx - cell.gx, g.gy - cell.gy) < minSpacing
    );
    if (tooClose) continue;

    // Determine grove type based on position — lush everywhere
    let type: GroveType;
    if (cd > 25) {
      type = rand() < 0.7 ? 'dense' : 'mixed'; // outer ring = thick forest
    } else if (cd > 18) {
      const r = rand();
      if (r < 0.25) type = 'cherry';
      else if (r < 0.5) type = 'dense';
      else if (r < 0.75) type = 'mixed';
      else type = 'light';
    } else if (cd > 12) {
      const r = rand();
      if (r < 0.35) type = 'orchard';
      else if (r < 0.55) type = 'cherry';
      else type = 'light';
    } else {
      type = rand() < 0.6 ? 'orchard' : 'light'; // near center = orchard
    }

    const radius = type === 'dense' ? 5 + rand() * 5
                 : type === 'mixed' ? 4 + rand() * 4
                 : type === 'cherry' ? 3 + rand() * 3
                 : type === 'orchard' ? 4 + rand() * 3
                 : 3 + rand() * 4;

    const treeCount = type === 'dense' ? 14 + Math.floor(rand() * 10)
                    : type === 'mixed' ? 10 + Math.floor(rand() * 8)
                    : type === 'cherry' ? 4 + Math.floor(rand() * 4)
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
          {
            const r = rand();
            if (r < 0.12) { type = 'large'; scale = 3.0 + rand() * 1.0; }
            else if (r < 0.25) { type = 'pine'; scale = 2.2 + rand() * 0.8; }
            else if (r < 0.35) { type = 'bush'; scale = 1.2 + rand() * 0.6; }
            else { type = 'basic'; scale = 2.2 + rand() * 1.2; }
          }
          break;
        case 'mixed':
          {
            const r = rand();
            if (r < 0.15) { type = 'large'; scale = 2.8 + rand() * 0.8; }
            else if (r < 0.25) { type = 'cherry'; scale = 3.0 + rand() * 0.6; }
            else if (r < 0.35) { type = 'fruit'; scale = 2.4 + rand() * 0.5; }
            else if (r < 0.45) { type = 'pine'; scale = 2.0 + rand() * 0.6; }
            else if (r < 0.55) { type = 'bush'; scale = 1.0 + rand() * 0.5; }
            else { type = 'basic'; scale = 2.0 + rand() * 1.0; }
          }
          break;
        case 'cherry':
          if (rand() < 0.15) { type = 'bush'; scale = 1.0 + rand() * 0.4; }
          else { type = 'cherry'; scale = 3.2 + rand() * 0.8; }
          break;
        case 'orchard':
          if (rand() < 0.1) { type = 'bush'; scale = 1.0 + rand() * 0.4; }
          else { type = 'fruit'; scale = 2.5 + rand() * 0.6; }
          break;
        case 'light':
        default:
          {
            const r = rand();
            if (r < 0.2) { type = 'pine'; scale = 2.0 + rand() * 0.6; }
            else if (r < 0.35) { type = 'bush'; scale = 1.0 + rand() * 0.5; }
            else { type = 'basic'; scale = 2.2 + rand() * 1.0; }
          }
          break;
      }

      placements.push({
        gx, gy,
        offsetX: (rand() - 0.5) * 0.45,
        offsetY: (rand() - 0.5) * 0.45,
        type,
        sheetIndex: Math.floor(rand() * 100),
        scale,
      });
    }
  }

  // ---- Step 3: Add sparse individual trees outside groves ----
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 8) continue; // keep core build area clear
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 2) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.05) continue; // ~5% of remaining cells

    const r = rand();
    placements.push({
      gx: cell.gx, gy: cell.gy,
      offsetX: (rand() - 0.5) * 0.3,
      offsetY: (rand() - 0.5) * 0.3,
      type: r < 0.15 ? 'pine' : r < 0.3 ? 'fruit' : r < 0.4 ? 'cherry' : 'basic',
      sheetIndex: Math.floor(rand() * 100),
      scale: 2.0 + rand() * 1.0,
    });
    usedCells.add(`${cell.gx},${cell.gy}`);
  }

  // ---- Step 4: Fill outer ring — dense forest border ----
  // Any grass cell far from center that's not occupied gets a tree
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 20) continue; // only outer ring
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 3) continue; // not too close to coast
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.18) continue; // ~18% fill rate for border (was 35% — too dense)

    const r = rand();
    placements.push({
      gx: cell.gx, gy: cell.gy,
      offsetX: (rand() - 0.5) * 0.4,
      offsetY: (rand() - 0.5) * 0.4,
      type: r < 0.1 ? 'large' : r < 0.2 ? 'cherry' : r < 0.3 ? 'fruit' : r < 0.4 ? 'pine' : 'basic',
      sheetIndex: Math.floor(rand() * 100),
      scale: 2.0 + rand() * 1.2,
    });
    usedCells.add(`${cell.gx},${cell.gy}`);
  }

  // ---- Step 5: Edge bushes — line of bushes near the coast ----
  for (const cell of grassCells) {
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 2 || ed > 5) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.12) continue; // ~12% of edge cells get bushes (was 22%)

    placements.push({
      gx: cell.gx, gy: cell.gy,
      offsetX: (rand() - 0.5) * 0.4,
      offsetY: (rand() - 0.5) * 0.4,
      type: 'bush',
      sheetIndex: Math.floor(rand() * 100),
      scale: 1.0 + rand() * 0.6,
    });
    usedCells.add(`${cell.gx},${cell.gy}`);
  }

  // ---- Step 6: Mid-ring fill — lighter tree coverage ----
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 12 || cd > 20) continue; // mid ring only
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 3) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.06) continue; // ~6% fill rate (was 12% — too much)

    const r = rand();
    placements.push({
      gx: cell.gx, gy: cell.gy,
      offsetX: (rand() - 0.5) * 0.3,
      offsetY: (rand() - 0.5) * 0.3,
      type: r < 0.2 ? 'fruit' : r < 0.35 ? 'cherry' : r < 0.5 ? 'bush' : 'basic',
      sheetIndex: Math.floor(rand() * 100),
      scale: r < 0.5 ? 1.0 + rand() * 0.5 : 2.0 + rand() * 0.8,
    });
    usedCells.add(`${cell.gx},${cell.gy}`);
  }

  return placements;
}
