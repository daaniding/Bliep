import { Container, Graphics } from 'pixi.js';
import { gridToScreen, inBounds, GRID_SIZE } from './iso';
import { PALETTE } from './palette';

export interface NPC {
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  progress: number;
  speed: number;
  container: Container;
}

export function createNPC(hatColor: number, shirtColor: number): NPC {
  const c = new Container();

  // Shadow (iso diamond, faint)
  const shadow = new Graphics();
  shadow.ellipse(0, 2, 10, 4);
  shadow.fill({ color: 0x000000, alpha: 0.25 });
  c.addChild(shadow);

  // Body
  const body = new Graphics();
  body.rect(-5, -14, 10, 12);
  body.fill({ color: shirtColor });
  c.addChild(body);

  // Legs
  const legs = new Graphics();
  legs.rect(-4, -2, 3, 4);
  legs.rect(1, -2, 3, 4);
  legs.fill({ color: PALETTE.woodDark });
  c.addChild(legs);

  // Head
  const head = new Graphics();
  head.circle(0, -19, 4);
  head.fill({ color: 0xf4d8b8 });
  c.addChild(head);

  // Hat
  const hat = new Graphics();
  hat.ellipse(0, -22, 6, 2);
  hat.fill({ color: hatColor });
  hat.rect(-3, -25, 6, 3);
  hat.fill({ color: hatColor });
  c.addChild(hat);

  return {
    gx: 0,
    gy: 0,
    targetGx: 0,
    targetGy: 0,
    progress: 1,
    speed: 0.012, // fraction of a tile per frame-ish
    container: c,
  };
}

function pickNewTarget(npc: NPC) {
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (let i = 0; i < 6; i++) {
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
    const nx = npc.gx + dx;
    const ny = npc.gy + dy;
    if (inBounds(nx, ny)) {
      npc.targetGx = nx;
      npc.targetGy = ny;
      npc.progress = 0;
      return;
    }
  }
}

export function tickNPC(npc: NPC, dt: number, originX: number, originY: number, blocked: (gx: number, gy: number) => boolean) {
  if (npc.progress >= 1) {
    // arrived at target
    npc.gx = npc.targetGx;
    npc.gy = npc.targetGy;
    // pick a new valid target (avoid blocked tiles)
    for (let attempt = 0; attempt < 8; attempt++) {
      pickNewTarget(npc);
      if (!blocked(npc.targetGx, npc.targetGy)) break;
    }
    npc.progress = 0;
  }
  npc.progress = Math.min(1, npc.progress + npc.speed * dt);
  const t = npc.progress;
  const interpGx = npc.gx + (npc.targetGx - npc.gx) * t;
  const interpGy = npc.gy + (npc.targetGy - npc.gy) * t;
  const { sx, sy } = gridToScreen(interpGx, interpGy, originX, originY);
  // Small bob
  const bob = Math.sin(t * Math.PI * 4) * 0.8;
  npc.container.position.set(sx, sy + bob);
  npc.container.zIndex = Math.floor(interpGx + interpGy) + 0.5;
}

export function randomStartTile(): { gx: number; gy: number } {
  return { gx: Math.floor(Math.random() * GRID_SIZE), gy: Math.floor(Math.random() * GRID_SIZE) };
}
