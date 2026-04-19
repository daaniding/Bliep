/**
 * Tree grove clustering algorithm.
 *
 * Dense forest at island edges, only center open for building.
 * Creates natural-looking groves with varying density, type, and size.
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
 * Dense at edges, center open for building.
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

  // Distance from any non-grass cell (coast/water proximity)
  const distFromEdge = (rx: number, ry: number): number => {
    for (let d = 1; d <= 8; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) === d || Math.abs(dy) === d) {
            const v = elevation[ry + dy]?.[rx + dx] ?? 0;
            if (v !== 3) return d;
          }
        }
      }
    }
    return 9;
  };

  // ---- Step 1: Pick grove centers ----
  const groves: GroveCenter[] = [];
  const minSpacing = 3;
  const maxGroves = 45; // more groves for denser edges
  const attempts = 900;

  for (let i = 0; i < attempts && groves.length < maxGroves; i++) {
    const idx = Math.floor(rand() * grassCells.length);
    const cell = grassCells[idx];
    const cd = centerDist(cell.gx, cell.gy);
    const ed = distFromEdge(cell.rx, cell.ry);

    // Plaza clear zone only — trees hug the plaza edge
    if (cd < 5) continue;
    // Must be at least 2 tiles from water edge
    if (ed < 2) continue;

    // Check spacing from existing groves
    const tooClose = groves.some(g =>
      Math.hypot(g.gx - cell.gx, g.gy - cell.gy) < minSpacing
    );
    if (tooClose) continue;

    // Grove type based on distance from center
    let type: GroveType;
    if (cd > 28) {
      type = rand() < 0.8 ? 'dense' : 'mixed'; // outer = thick forest
    } else if (cd > 22) {
      const r = rand();
      if (r < 0.4) type = 'dense';
      else if (r < 0.6) type = 'mixed';
      else if (r < 0.8) type = 'cherry';
      else type = 'light';
    } else if (cd > 16) {
      const r = rand();
      if (r < 0.3) type = 'mixed';
      else if (r < 0.5) type = 'cherry';
      else if (r < 0.7) type = 'orchard';
      else type = 'light';
    } else {
      type = rand() < 0.5 ? 'orchard' : 'light'; // near center = sparse
    }

    const radius = type === 'dense' ? 5 + rand() * 6
                 : type === 'mixed' ? 4 + rand() * 5
                 : type === 'cherry' ? 3 + rand() * 3
                 : type === 'orchard' ? 3 + rand() * 3
                 : 3 + rand() * 4;

    const treeCount = type === 'dense' ? 16 + Math.floor(rand() * 14)
                    : type === 'mixed' ? 12 + Math.floor(rand() * 10)
                    : type === 'cherry' ? 5 + Math.floor(rand() * 5)
                    : type === 'orchard' ? 5 + Math.floor(rand() * 5)
                    : 5 + Math.floor(rand() * 6);

    groves.push({ gx: cell.gx, gy: cell.gy, radius, type, treeCount });
  }

  // ---- Step 2: Place trees within each grove ----
  const placements: TreePlacement[] = [];
  const usedCells = new Set<string>();

  for (const grove of groves) {
    for (let t = 0; t < grove.treeCount; t++) {
      const angle = rand() * Math.PI * 2;
      const dist = rand() * rand() * grove.radius;
      const gx = Math.round(grove.gx + Math.cos(angle) * dist);
      const gy = Math.round(grove.gy + Math.sin(angle) * dist);

      const key = `${gx},${gy}`;
      if (usedCells.has(key)) continue;

      const rx = gx - offsetGx;
      const ry = gy - offsetGy;
      if (rx < 0 || rx >= mapCols || ry < 0 || ry >= mapRows) continue;
      if (elevation[ry][rx] !== 3) continue;

      // Don't place inside plaza clear zone
      if (centerDist(gx, gy) < 5) continue;

      usedCells.add(key);

      let type: TreePlacement['type'];
      let scale: number;

      switch (grove.type) {
        case 'dense':
          {
            const r = rand();
            if (r < 0.12) { type = 'large'; scale = 3.0 + rand() * 1.2; }
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

  // ---- Step 3: Dense outer ring fill — every grass cell far from center ----
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 18) continue;
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 2) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.65) continue; // 65% fill rate — dense outer forest

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

  // ---- Step 4: Edge bushes — thick bush border near coast ----
  for (const cell of grassCells) {
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 2 || ed > 6) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.18) continue; // 18% of edge cells get bushes

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

  // ---- Step 5: Mid-ring fill — moderate coverage ----
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 8 || cd > 18) continue;
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 3) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    if (rand() > 0.50) continue; // 50% fill rate for mid ring — dense around plaza

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

  // ---- Step 6: Sparse individuals outside groves ----
  for (const cell of grassCells) {
    const cd = centerDist(cell.gx, cell.gy);
    if (cd < 5) continue;
    const ed = distFromEdge(cell.rx, cell.ry);
    if (ed < 2) continue;
    if (usedCells.has(`${cell.gx},${cell.gy}`)) continue;
    // Boost density near plaza (cd 5-10) so trees hug the plaza edge
    const closeBonus = cd < 10 ? 0.25 : 0;
    if (rand() > 0.35 + closeBonus) continue;

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

  return placements;
}
