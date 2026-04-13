import { Graphics, Container } from 'pixi.js';
import { TILE_W, TILE_H } from './iso';
import { PALETTE } from './palette';
import type { BuildingType } from './buildings';

// Simple placeholder buildings. Each one is a box + roof that scales with level.
// These are intentionally crude - pixel art / sprites will replace them later.
export function buildBuildingGraphics(type: BuildingType, level: number): Container {
  const c = new Container();

  const scale = 0.9 + (level - 1) * 0.15;
  const baseW = TILE_W * 0.7 * scale;
  const baseH = TILE_H * 0.7 * scale;
  const bodyH = TILE_H * (0.9 + level * 0.2);

  // Fundament (iso diamond shadow) sits on tile
  const shadow = new Graphics();
  shadow.moveTo(0, -baseH / 2)
    .lineTo(baseW / 2, 0)
    .lineTo(0, baseH / 2)
    .lineTo(-baseW / 2, 0)
    .closePath();
  shadow.fill({ color: 0x000000, alpha: 0.18 });
  c.addChild(shadow);

  const bodyTop = -bodyH;
  const half = baseW / 2;

  if (type === 'house') {
    // Wooden body
    const body = new Graphics();
    body.poly([-half, 0, -half, bodyTop + baseH / 2, 0, bodyTop + baseH / 2 - baseH / 2, 0, 0]);
    // Simpler: back-left wall
    body.clear();
    // Left wall
    body.moveTo(-half, 0)
      .lineTo(0, -baseH / 2)
      .lineTo(0, bodyTop)
      .lineTo(-half, bodyTop + baseH / 2)
      .closePath();
    body.fill({ color: PALETTE.wood });
    body.stroke({ color: PALETTE.woodDark, width: 1, alpha: 0.6 });
    // Right wall
    body.moveTo(0, -baseH / 2)
      .lineTo(half, 0)
      .lineTo(half, bodyTop + baseH / 2)
      .lineTo(0, bodyTop)
      .closePath();
    body.fill({ color: PALETTE.woodDark });
    body.stroke({ color: PALETTE.woodDark, width: 1, alpha: 0.6 });
    c.addChild(body);

    // Straw roof (iso diamond above body)
    const roofOverhang = baseW * 0.12;
    const roofH = baseH + roofOverhang;
    const roofW = baseW + roofOverhang * 2;
    const roof = new Graphics();
    const peakY = bodyTop - bodyH * 0.25 - level * 4;
    roof.moveTo(-roofW / 2, bodyTop)
      .lineTo(0, bodyTop - roofH / 2)
      .lineTo(0, peakY)
      .lineTo(-roofW / 2, bodyTop + roofH / 2 - roofH / 2)
      .closePath();
    roof.fill({ color: PALETTE.strawRoof });
    roof.moveTo(0, bodyTop - roofH / 2)
      .lineTo(roofW / 2, bodyTop)
      .lineTo(0, peakY)
      .closePath();
    roof.fill({ color: PALETTE.strawRoofShadow });
    c.addChild(roof);

    // Door (simple dark rect on front-right face)
    if (level >= 1) {
      const door = new Graphics();
      door.rect(half * 0.15, -bodyH * 0.45, half * 0.25, bodyH * 0.45);
      door.fill({ color: PALETTE.woodDark });
      c.addChild(door);
    }
  } else if (type === 'farm') {
    // Farm: small hut + fenced area hinted as a green square next to it
    const body = new Graphics();
    body.moveTo(-half, 0)
      .lineTo(0, -baseH / 2)
      .lineTo(0, bodyTop * 0.8)
      .lineTo(-half, bodyTop * 0.8 + baseH / 2)
      .closePath();
    body.fill({ color: PALETTE.wood });
    body.moveTo(0, -baseH / 2)
      .lineTo(half, 0)
      .lineTo(half, bodyTop * 0.8 + baseH / 2)
      .lineTo(0, bodyTop * 0.8)
      .closePath();
    body.fill({ color: PALETTE.woodDark });
    c.addChild(body);

    const roof = new Graphics();
    roof.moveTo(-half * 1.1, bodyTop * 0.8)
      .lineTo(0, bodyTop * 0.8 - bodyH * 0.35)
      .lineTo(half * 1.1, bodyTop * 0.8)
      .lineTo(0, bodyTop * 0.8 + baseH * 0.1)
      .closePath();
    roof.fill({ color: PALETTE.strawRoof });
    roof.stroke({ color: PALETTE.strawRoofShadow, width: 1, alpha: 0.6 });
    c.addChild(roof);

    if (level >= 2) {
      // Windmill blade hint
      const blade = new Graphics();
      blade.rect(-2, -bodyH * 1.2, 4, bodyH * 0.6);
      blade.fill({ color: PALETTE.woodDark });
      c.addChild(blade);
    }
  } else if (type === 'barracks') {
    // Stone block with slate roof
    const body = new Graphics();
    body.moveTo(-half, 0)
      .lineTo(0, -baseH / 2)
      .lineTo(0, bodyTop)
      .lineTo(-half, bodyTop + baseH / 2)
      .closePath();
    body.fill({ color: PALETTE.stone });
    body.moveTo(0, -baseH / 2)
      .lineTo(half, 0)
      .lineTo(half, bodyTop + baseH / 2)
      .lineTo(0, bodyTop)
      .closePath();
    body.fill({ color: PALETTE.stoneShadow });
    c.addChild(body);

    const roof = new Graphics();
    const roofTop = bodyTop - bodyH * 0.35;
    roof.moveTo(-half * 1.1, bodyTop)
      .lineTo(0, roofTop)
      .lineTo(half * 1.1, bodyTop)
      .lineTo(0, bodyTop + baseH * 0.1)
      .closePath();
    roof.fill({ color: PALETTE.slateRoof });
    c.addChild(roof);

    // Flag at level 2+
    if (level >= 2) {
      const pole = new Graphics();
      pole.rect(-1, roofTop - 16, 2, 16);
      pole.fill({ color: PALETTE.woodDark });
      c.addChild(pole);
      const flag = new Graphics();
      flag.poly([0, roofTop - 14, 10, roofTop - 10, 0, roofTop - 6]);
      flag.fill({ color: PALETTE.gold });
      c.addChild(flag);
    }
  } else if (type === 'wall') {
    const body = new Graphics();
    const wallH = bodyH * 0.55;
    body.moveTo(-half, 0)
      .lineTo(0, -baseH / 2)
      .lineTo(0, -wallH)
      .lineTo(-half, -wallH + baseH / 2)
      .closePath();
    body.fill({ color: PALETTE.stone });
    body.moveTo(0, -baseH / 2)
      .lineTo(half, 0)
      .lineTo(half, -wallH + baseH / 2)
      .lineTo(0, -wallH)
      .closePath();
    body.fill({ color: PALETTE.stoneShadow });
    c.addChild(body);
    // Crenellations at level 2+
    if (level >= 2) {
      for (let i = -2; i <= 2; i += 2) {
        const crenel = new Graphics();
        crenel.rect(i * 6 - 2, -wallH - 6, 4, 6);
        crenel.fill({ color: PALETTE.stone });
        c.addChild(crenel);
      }
    }
  }

  return c;
}
