'use client';

import { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  FederatedPointerEvent,
  Point,
} from 'pixi.js';
import {
  TILE_W,
  TILE_H,
  GRID_SIZE,
  CITY_CENTER,
  gridToScreen,
  screenToGrid,
  inBounds,
  inBuildZone,
  centerOrigin,
} from '@/lib/game/iso';
import { PALETTE } from '@/lib/game/palette';
import { loadAtlas, getTexture, UNIT_SLUGS } from '@/lib/game/sprites';
import { seedDecor, isRoadTile, type DecorTile } from '@/lib/game/decor';
import { spriteForLevel, BUILDINGS, type BuildingType } from '@/lib/game/buildings';
import {
  isChestReady,
  farmPendingCoins,
  type CityState,
  type PlacedBuilding,
} from '@/lib/cityStore';

export type CanvasMode = 'interactive' | 'preview';

interface Props {
  state: CityState;
  mode?: CanvasMode;
  /** When true, hide the dim/blocked tiles outside the build zone. */
  showBuildZone?: boolean;
  /** Building type currently being placed (ghost preview follows pointer). */
  placingType?: BuildingType | null;
  onTapTile?: (gx: number, gy: number) => void;
  onTapBuilding?: (b: PlacedBuilding) => void;
  onTapChest?: () => void;
  onCollectFarm?: (b: PlacedBuilding) => void;
}

const MIN_ZOOM_INTERACTIVE = 0.35;
const MAX_ZOOM_INTERACTIVE = 2.6;
const TAP_THRESHOLD_PX = 6;
const COIN_BADGE_THRESHOLD = 1; // show coin pop after this many pending coins

function drawTile(g: Graphics, fill: number, stroke: number, strokeWidth = 1, alpha = 0.4) {
  g.moveTo(0, -TILE_H / 2)
    .lineTo(TILE_W / 2, 0)
    .lineTo(0, TILE_H / 2)
    .lineTo(-TILE_W / 2, 0)
    .closePath();
  g.fill({ color: fill });
  g.stroke({ color: stroke, width: strokeWidth, alpha });
}

interface NPC {
  buildingId: string;
  homeGx: number;
  homeGy: number;
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  progress: number;
  speed: number;
  sprite: Sprite;
  facing: 1 | -1;
}

export default function CityCanvas({
  state,
  mode = 'interactive',
  showBuildZone = true,
  placingType = null,
  onTapTile,
  onTapBuilding,
  onTapChest,
  onCollectFarm,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const buildingLayerRef = useRef<Container | null>(null);
  const decorLayerRef = useRef<Container | null>(null);
  const overlayLayerRef = useRef<Container | null>(null);
  const npcLayerRef = useRef<Container | null>(null);
  const ghostRef = useRef<Sprite | null>(null);
  const chestSpriteRef = useRef<Sprite | null>(null);
  const npcsRef = useRef<NPC[]>([]);
  const atlasRef = useRef<Map<string, Texture> | null>(null);
  const originRef = useRef<{ originX: number; originY: number }>({ originX: 0, originY: 0 });
  const stateRef = useRef<CityState>(state);
  const placingRef = useRef<BuildingType | null>(placingType);
  const callbacksRef = useRef({ onTapTile, onTapBuilding, onTapChest, onCollectFarm });

  useEffect(() => { stateRef.current = state; });
  useEffect(() => { placingRef.current = placingType; }, [placingType]);
  useEffect(() => {
    callbacksRef.current = { onTapTile, onTapBuilding, onTapChest, onCollectFarm };
  }, [onTapTile, onTapBuilding, onTapChest, onCollectFarm]);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    appRef.current = app;

    (async () => {
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: mode === 'preview' ? 1 : window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true, texture: false });
        return;
      }
      host.appendChild(app.canvas);

      const atlas = await loadAtlas();
      if (cancelled) return;
      atlasRef.current = atlas;

      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      const tileLayer = new Container();
      world.addChild(tileLayer);

      const decorLayer = new Container();
      decorLayer.sortableChildren = true;
      world.addChild(decorLayer);
      decorLayerRef.current = decorLayer;

      const hoverLayer = new Container();
      world.addChild(hoverLayer);

      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      buildingLayerRef.current = buildingLayer;

      const npcLayer = new Container();
      npcLayer.sortableChildren = true;
      world.addChild(npcLayer);
      npcLayerRef.current = npcLayer;

      const overlayLayer = new Container();
      overlayLayer.sortableChildren = true;
      world.addChild(overlayLayer);
      overlayLayerRef.current = overlayLayer;

      // ---- Origin ----
      const originX = 0;
      const originY = -((GRID_SIZE - 1) * TILE_H) / 2;
      originRef.current = { originX, originY };

      // ---- Tiles (terrain) ----
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const { sx, sy } = gridToScreen(gx, gy, originX, originY);
          const tile = new Graphics();
          const inZone = inBuildZone(gx, gy);
          const road = isRoadTile(gx, gy);
          const alt = (gx + gy) % 2 === 0;
          let fill: number = alt ? PALETTE.grass : PALETTE.grassLight;
          if (road) fill = 0xb59866;
          if (!inZone && !road) fill = alt ? 0x4a7d4a : 0x568555;
          drawTile(tile, fill, PALETTE.grassEdge, 1, inZone ? 0.35 : 0.2);
          tile.position.set(sx, sy);
          tileLayer.addChild(tile);
        }
      }

      // Subtle highlight border around build zone
      if (showBuildZone) {
        const zoneRing = new Graphics();
        const r = 12; // BUILD_ZONE_RADIUS
        for (let gy = CITY_CENTER.gy - r; gy <= CITY_CENTER.gy + r; gy++) {
          for (let gx = CITY_CENTER.gx - r; gx <= CITY_CENTER.gx + r; gx++) {
            const dx = gx - CITY_CENTER.gx;
            const dy = gy - CITY_CENTER.gy;
            const onEdge = Math.max(Math.abs(dx), Math.abs(dy)) === r;
            if (!onEdge) continue;
            const { sx, sy } = gridToScreen(gx, gy, originX, originY);
            zoneRing.moveTo(sx, sy - TILE_H / 2)
              .lineTo(sx + TILE_W / 2, sy)
              .lineTo(sx, sy + TILE_H / 2)
              .lineTo(sx - TILE_W / 2, sy)
              .closePath();
          }
        }
        zoneRing.stroke({ color: 0xfdd069, width: 1.5, alpha: 0.35 });
        tileLayer.addChild(zoneRing);
      }

      // ---- Decor (procedural) ----
      const decor: DecorTile[] = seedDecor(state.npcSeed || 1);
      for (const d of decor) {
        const tex = getTexture(atlas, d.slug);
        if (!tex || tex === Texture.EMPTY) continue;
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.85);
        const { sx, sy } = gridToScreen(d.gx, d.gy, originX, originY);
        s.position.set(sx, sy + 4);
        s.scale.set(d.scale * 0.9);
        s.zIndex = d.gx + d.gy;
        decorLayer.addChild(s);
      }

      // ---- Daily chest ----
      const chestTex = getTexture(atlas, 'medievalStructure_18');
      if (chestTex && chestTex !== Texture.EMPTY) {
        const chest = new Sprite(chestTex);
        chest.anchor.set(0.5, 0.9);
        const { sx, sy } = gridToScreen(CITY_CENTER.gx, CITY_CENTER.gy, originX, originY);
        chest.position.set(sx, sy + 6);
        chest.scale.set(0.85);
        chest.zIndex = CITY_CENTER.gx + CITY_CENTER.gy;
        chest.eventMode = mode === 'interactive' ? 'static' : 'none';
        chest.cursor = 'pointer';
        chest.on('pointertap', (e: FederatedPointerEvent) => {
          e.stopPropagation();
          callbacksRef.current.onTapChest?.();
        });
        overlayLayer.addChild(chest);
        chestSpriteRef.current = chest;
      }

      // ---- Initial centering & zoom ----
      const centerWorld = () => {
        const { originX: ox, originY: oy } = centerOrigin(app.renderer.width, app.renderer.height);
        world.position.set(ox, oy + ((GRID_SIZE - 1) * TILE_H) / 2);
      };
      centerWorld();
      // Initial zoom: preview fits whole grid; interactive shows the build
      // zone (~26 tiles wide) so individual sprites stay readable.
      const fitScaleAll = Math.min(
        app.renderer.width / (GRID_SIZE * TILE_W * 0.55),
        app.renderer.height / (GRID_SIZE * TILE_H * 1.1),
      );
      const fitScaleZone = Math.min(
        app.renderer.width / (24 * TILE_W * 0.55),
        app.renderer.height / (24 * TILE_H * 1.1),
      );
      world.scale.set(mode === 'preview' ? fitScaleAll : Math.max(0.55, fitScaleZone));

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      // ---- Input (interactive mode only) ----
      if (mode === 'interactive') {
        type Pointer = { id: number; lastX: number; lastY: number; moved: number };
        const pointers = new Map<number, Pointer>();
        let pinchStartDist = 0;
        let pinchStartScale = 1;
        let pinchMid = { x: 0, y: 0 };

        const globalToGrid = (gx: number, gy: number) => {
          const local = world.toLocal(new Point(gx, gy));
          return screenToGrid(local.x, local.y, originRef.current.originX, originRef.current.originY);
        };

        const zoomAround = (px: number, py: number, target: number) => {
          const beforeLocal = world.toLocal(new Point(px, py));
          world.scale.set(target);
          const afterGlobal = world.toGlobal(beforeLocal);
          world.position.x += px - afterGlobal.x;
          world.position.y += py - afterGlobal.y;
        };

        const onDown = (e: FederatedPointerEvent) => {
          pointers.set(e.pointerId, {
            id: e.pointerId,
            lastX: e.global.x,
            lastY: e.global.y,
            moved: 0,
          });
          if (pointers.size === 2) {
            const arr = Array.from(pointers.values());
            const dx = arr[0].lastX - arr[1].lastX;
            const dy = arr[0].lastY - arr[1].lastY;
            pinchStartDist = Math.hypot(dx, dy) || 1;
            pinchStartScale = world.scale.x;
            pinchMid = { x: (arr[0].lastX + arr[1].lastX) / 2, y: (arr[0].lastY + arr[1].lastY) / 2 };
          }
        };

        const onMove = (e: FederatedPointerEvent) => {
          const p = pointers.get(e.pointerId);
          if (p) {
            const dx = e.global.x - p.lastX;
            const dy = e.global.y - p.lastY;
            p.moved += Math.hypot(dx, dy);
            p.lastX = e.global.x;
            p.lastY = e.global.y;
            if (pointers.size === 1) {
              world.position.x += dx;
              world.position.y += dy;
            } else if (pointers.size === 2) {
              const arr = Array.from(pointers.values());
              const ddx = arr[0].lastX - arr[1].lastX;
              const ddy = arr[0].lastY - arr[1].lastY;
              const dist = Math.hypot(ddx, ddy) || 1;
              const target = Math.max(
                MIN_ZOOM_INTERACTIVE,
                Math.min(MAX_ZOOM_INTERACTIVE, pinchStartScale * (dist / pinchStartDist)),
              );
              zoomAround(pinchMid.x, pinchMid.y, target);
            }
          }

          // Ghost follow
          if (placingRef.current) {
            const { gx, gy } = globalToGrid(e.global.x, e.global.y);
            updateGhost(gx, gy);
          }
        };

        const onUp = (e: FederatedPointerEvent) => {
          const p = pointers.get(e.pointerId);
          if (!p) return;
          const wasTap = p.moved < TAP_THRESHOLD_PX && pointers.size === 1;
          pointers.delete(e.pointerId);
          if (!wasTap) return;
          const { gx, gy } = globalToGrid(e.global.x, e.global.y);
          if (!inBounds(gx, gy)) return;

          // Chest tap is handled by the chest sprite directly.
          // Tap on a building → if farm with pending coins, collect; else upgrade flow
          const existing = stateRef.current.buildings.find(b => b.gx === gx && b.gy === gy);
          if (existing) {
            if (existing.type === 'farm' && farmPendingCoins(stateRef.current, existing) >= COIN_BADGE_THRESHOLD) {
              callbacksRef.current.onCollectFarm?.(existing);
              return;
            }
            callbacksRef.current.onTapBuilding?.(existing);
            return;
          }
          callbacksRef.current.onTapTile?.(gx, gy);
        };

        const onUpOutside = (e: FederatedPointerEvent) => { pointers.delete(e.pointerId); };

        const onWheel = (ev: WheelEvent) => {
          ev.preventDefault();
          const rect = host.getBoundingClientRect();
          const localX = ev.clientX - rect.left;
          const localY = ev.clientY - rect.top;
          const factor = Math.exp(-ev.deltaY * 0.0015);
          const target = Math.max(
            MIN_ZOOM_INTERACTIVE,
            Math.min(MAX_ZOOM_INTERACTIVE, world.scale.x * factor),
          );
          zoomAround(localX, localY, target);
        };

        app.stage.on('pointerdown', onDown);
        app.stage.on('pointermove', onMove);
        app.stage.on('pointerup', onUp);
        app.stage.on('pointerupoutside', onUpOutside);
        app.canvas.addEventListener('wheel', onWheel, { passive: false });

        (app as Application & { __cleanup?: () => void }).__cleanup = () => {
          app.canvas.removeEventListener('wheel', onWheel);
          app.stage.off('pointerdown', onDown);
          app.stage.off('pointermove', onMove);
          app.stage.off('pointerup', onUp);
          app.stage.off('pointerupoutside', onUpOutside);
        };
      }

      const ro = new ResizeObserver(() => {
        if (cancelled || !appRef.current) return;
        if (mode === 'preview') centerWorld();
      });
      ro.observe(host);

      syncBuildings();

      const tickerFn = (ticker: { deltaTime: number }) => {
        // NPC walking
        for (const n of npcsRef.current) {
          n.progress = Math.min(1, n.progress + n.speed * ticker.deltaTime);
          const t = n.progress;
          const ix = n.gx + (n.targetGx - n.gx) * t;
          const iy = n.gy + (n.targetGy - n.gy) * t;
          const { sx, sy } = gridToScreen(ix, iy, originRef.current.originX, originRef.current.originY);
          const bob = Math.sin(t * Math.PI * 4) * 1;
          n.sprite.position.set(sx, sy + bob);
          n.sprite.zIndex = Math.floor(ix + iy) + 0.5;
          if (n.progress >= 1) {
            n.gx = n.targetGx;
            n.gy = n.targetGy;
            const next = wanderNear(n.homeGx, n.homeGy, 3);
            n.targetGx = next.gx;
            n.targetGy = next.gy;
            n.progress = 0;
            const dirX = n.targetGx - n.gx;
            n.facing = dirX < 0 ? -1 : 1;
            n.sprite.scale.x = Math.abs(n.sprite.scale.x) * n.facing;
          }
        }

        // Coin badges + chest pulse
        const now = Date.now();
        if (chestSpriteRef.current) {
          const ready = isChestReady(stateRef.current);
          const s = chestSpriteRef.current;
          if (ready) {
            const pulse = 0.85 + Math.sin(now / 250) * 0.05;
            s.scale.set(pulse);
            s.tint = 0xfff8c0;
          } else {
            s.scale.set(0.85);
            s.tint = 0x888888;
          }
        }
      };
      app.ticker.add(tickerFn);

      const prevCleanup = (app as Application & { __cleanup?: () => void }).__cleanup;
      (app as Application & { __cleanup?: () => void }).__cleanup = () => {
        prevCleanup?.();
        ro.disconnect();
      };
    })();

    return () => {
      cancelled = true;
      const a = appRef.current;
      if (a) {
        const cleanup = (a as Application & { __cleanup?: () => void }).__cleanup;
        cleanup?.();
        try { a.destroy(true, { children: true, texture: false }); } catch { /* ignore */ }
      }
      appRef.current = null;
      worldRef.current = null;
      buildingLayerRef.current = null;
      decorLayerRef.current = null;
      overlayLayerRef.current = null;
      npcLayerRef.current = null;
      ghostRef.current = null;
      chestSpriteRef.current = null;
      npcsRef.current = [];
      if (host) host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Re-sync buildings/NPCs/coin badges when state changes
  useEffect(() => { syncBuildings(); /* eslint-disable-line */ }, [state]);

  // Update ghost sprite when placing type changes
  useEffect(() => {
    const layer = overlayLayerRef.current;
    const atlas = atlasRef.current;
    if (!layer || !atlas) return;
    if (ghostRef.current) {
      layer.removeChild(ghostRef.current);
      ghostRef.current.destroy();
      ghostRef.current = null;
    }
    if (placingType) {
      const slug = spriteForLevel(placingType, 1);
      const tex = getTexture(atlas, slug);
      if (tex && tex !== Texture.EMPTY) {
        const ghost = new Sprite(tex);
        ghost.anchor.set(0.5, 0.85);
        ghost.scale.set((BUILDINGS[placingType].spriteScale ?? 1) * 0.7);
        ghost.alpha = 0.55;
        ghost.tint = 0xc0ffc0;
        ghost.zIndex = 9999;
        layer.addChild(ghost);
        ghostRef.current = ghost;
      }
    }
  }, [placingType]);

  function updateGhost(gx: number, gy: number) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    if (!inBuildZone(gx, gy)) {
      ghost.alpha = 0.25;
      ghost.tint = 0xff7070;
    } else {
      const occupied = stateRef.current.buildings.some(b => b.gx === gx && b.gy === gy);
      ghost.alpha = occupied ? 0.25 : 0.55;
      ghost.tint = occupied ? 0xff7070 : 0xc0ffc0;
    }
    const { sx, sy } = gridToScreen(gx, gy, originRef.current.originX, originRef.current.originY);
    ghost.position.set(sx, sy + 4);
  }

  function syncBuildings() {
    const layer = buildingLayerRef.current;
    const npcLayer = npcLayerRef.current;
    const overlay = overlayLayerRef.current;
    const atlas = atlasRef.current;
    if (!layer || !npcLayer || !overlay || !atlas) return;

    // Clear and rebuild buildings + coin badges + NPCs.
    layer.removeChildren();
    npcLayer.removeChildren();
    // Keep chest + ghost in overlay; remove only badge children (tagged with name)
    for (const child of [...overlay.children]) {
      const lbl = (child as { label?: string }).label;
      if (lbl === 'coin-badge' || lbl === 'queue-clock') {
        overlay.removeChild(child);
      }
    }

    const { originX, originY } = originRef.current;
    const current = stateRef.current;

    for (const b of current.buildings) {
      const slug = spriteForLevel(b.type, b.level);
      const tex = getTexture(atlas, slug);
      if (!tex || tex === Texture.EMPTY) continue;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.85);
      const def = BUILDINGS[b.type];
      sprite.scale.set((def.spriteScale ?? 1) * 0.95);
      const { sx, sy } = gridToScreen(b.gx, b.gy, originX, originY);
      sprite.position.set(sx, sy + 4);
      sprite.zIndex = b.gx + b.gy;
      layer.addChild(sprite);

      // Coin badge for ready farms
      if (b.type === 'farm') {
        const pending = farmPendingCoins(current, b);
        if (pending >= COIN_BADGE_THRESHOLD) {
          const badge = makeCoinBadge(pending);
          badge.position.set(sx, sy - 50);
          badge.zIndex = b.gx + b.gy + 0.5;
          badge.label = 'coin-badge';
          overlay.addChild(badge);
        }
      }

      // Build queue clock above buildings under construction
      const q = current.buildQueue.find(x => x.buildingId === b.id);
      if (q && q.finishesAt > Date.now()) {
        const clock = makeQueueClock();
        clock.position.set(sx, sy - 60);
        clock.zIndex = b.gx + b.gy + 0.6;
        clock.label = 'queue-clock';
        overlay.addChild(clock);
      }

      // Spawn 1 NPC per active building (no queue, no scaffold)
      if (mode === 'interactive' && (!q || q.finishesAt <= Date.now())) {
        const npc = makeNPC(b, atlas);
        if (npc) {
          npcLayer.addChild(npc.sprite);
          npcsRef.current.push(npc);
        }
      }
    }

    // Cap NPC count and prune NPCs whose buildings vanished
    const ids = new Set(current.buildings.map(b => b.id));
    npcsRef.current = npcsRef.current.filter(n => ids.has(n.buildingId));
  }

  function makeNPC(b: PlacedBuilding, atlas: Map<string, Texture>): NPC | null {
    // Pick unit sprite per building type, deterministic by id
    const idx = Math.abs(hashCode(b.id + b.type)) % UNIT_SLUGS.length;
    const slug = UNIT_SLUGS[idx];
    const tex = getTexture(atlas, slug);
    if (!tex || tex === Texture.EMPTY) return null;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.85);
    sprite.scale.set(0.65);
    const { gx, gy } = wanderNear(b.gx, b.gy, 2);
    const target = wanderNear(b.gx, b.gy, 3);
    return {
      buildingId: b.id,
      homeGx: b.gx,
      homeGy: b.gy,
      gx,
      gy,
      targetGx: target.gx,
      targetGy: target.gy,
      progress: 0,
      speed: 0.005 + Math.random() * 0.004,
      sprite,
      facing: 1,
    };
  }

  return <div ref={hostRef} className={mode === 'preview' ? 'absolute inset-0 pointer-events-none' : 'fixed inset-0 touch-none'} />;
}

// ---- helpers ----

function makeCoinBadge(amount: number): Container {
  const c = new Container();
  const bg = new Graphics();
  bg.roundRect(-22, -14, 44, 22, 11);
  bg.fill({ color: 0xfdd069 });
  bg.stroke({ color: 0x3a2a18, width: 2 });
  c.addChild(bg);
  const txt = new Text({
    text: `+${amount}`,
    style: new TextStyle({
      fontFamily: 'Lilita One, sans-serif',
      fontSize: 14,
      fill: 0x3a2a18,
      stroke: { color: 0xffffff, width: 1.5 },
    }),
  });
  txt.anchor.set(0.5);
  txt.position.set(0, -3);
  c.addChild(txt);
  // Bobbing animation via local pivot
  const start = Date.now();
  const tick = () => {
    const dt = (Date.now() - start) / 1000;
    c.position.y += Math.sin(dt * 4) * 0.05;
  };
  // Pixi tick will be driven by parent app ticker through frame redraws;
  // we don't subscribe here to avoid leaks. Subtle motion is fine static.
  void tick;
  return c;
}

function makeQueueClock(): Container {
  const c = new Container();
  const ring = new Graphics();
  ring.circle(0, 0, 12);
  ring.fill({ color: 0x0d0a06, alpha: 0.85 });
  ring.stroke({ color: 0xfdd069, width: 2 });
  c.addChild(ring);
  const txt = new Text({
    text: '⏳',
    style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 14, fill: 0xfdd069 }),
  });
  txt.anchor.set(0.5);
  c.addChild(txt);
  return c;
}

function wanderNear(cx: number, cy: number, radius: number): { gx: number; gy: number } {
  const dx = Math.floor((Math.random() - 0.5) * 2 * radius);
  const dy = Math.floor((Math.random() - 0.5) * 2 * radius);
  const gx = Math.max(0, Math.min(GRID_SIZE - 1, cx + dx));
  const gy = Math.max(0, Math.min(GRID_SIZE - 1, cy + dy));
  return { gx, gy };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
