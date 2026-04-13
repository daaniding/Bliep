'use client';

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, FederatedPointerEvent, Point } from 'pixi.js';
import { TILE_W, TILE_H, GRID_SIZE, gridToScreen, screenToGrid, inBounds, centerOrigin } from '@/lib/game/iso';
import { PALETTE } from '@/lib/game/palette';
import { buildBuildingGraphics } from '@/lib/game/drawBuilding';
import { createNPC, tickNPC, randomStartTile, type NPC } from '@/lib/game/npc';
import type { CityState, PlacedBuilding } from '@/lib/cityStore';

interface Props {
  state: CityState;
  onTapTile: (gx: number, gy: number) => void;
  onTapBuilding: (b: PlacedBuilding) => void;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;
const TAP_THRESHOLD_PX = 6; // movement allowed before a down→up becomes a drag

function drawTile(g: Graphics, fill: number, stroke: number, strokeWidth = 1) {
  g.moveTo(0, -TILE_H / 2)
    .lineTo(TILE_W / 2, 0)
    .lineTo(0, TILE_H / 2)
    .lineTo(-TILE_W / 2, 0)
    .closePath();
  g.fill({ color: fill });
  g.stroke({ color: stroke, width: strokeWidth, alpha: 0.4 });
}

export default function CityCanvas({ state, onTapTile, onTapBuilding }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const buildingLayerRef = useRef<Container | null>(null);
  const npcsRef = useRef<NPC[]>([]);
  const originRef = useRef<{ originX: number; originY: number }>({ originX: 0, originY: 0 });
  const stateRef = useRef<CityState>(state);
  const callbacksRef = useRef({ onTapTile, onTapBuilding });

  useEffect(() => { stateRef.current = state; });
  useEffect(() => { callbacksRef.current = { onTapTile, onTapBuilding }; }, [onTapTile, onTapBuilding]);

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
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true, texture: true });
        return;
      }
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      const tileLayer = new Container();
      world.addChild(tileLayer);

      const hoverLayer = new Container();
      world.addChild(hoverLayer);

      const entityLayer = new Container();
      entityLayer.sortableChildren = true;
      world.addChild(entityLayer);
      buildingLayerRef.current = entityLayer;

      // Spawn 2 NPCs
      const npcs: NPC[] = [
        createNPC(PALETTE.gold, PALETTE.wood),
        createNPC(PALETTE.woodDark, PALETTE.stone),
      ];
      npcs.forEach(n => {
        const start = randomStartTile();
        n.gx = start.gx; n.gy = start.gy; n.targetGx = start.gx; n.targetGy = start.gy;
        entityLayer.addChild(n.container);
      });
      npcsRef.current = npcs;

      // Origin stays fixed in world-local space. Screen center is implied
      // by world.x/world.y (initially 0), so the origin just needs to place
      // the grid around local (0, 0).
      const originX = 0;
      const originY = -((GRID_SIZE - 1) * TILE_H) / 2;
      originRef.current = { originX, originY };

      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const { sx, sy } = gridToScreen(gx, gy, originX, originY);
          const tile = new Graphics();
          const alt = (gx + gy) % 2 === 0;
          drawTile(tile, alt ? PALETTE.grass : PALETTE.grassLight, PALETTE.grassEdge);
          tile.position.set(sx, sy);
          tileLayer.addChild(tile);
        }
      }

      const hoverTile = new Graphics();
      drawTile(hoverTile, PALETTE.hover, PALETTE.hover, 2);
      hoverTile.alpha = 0;
      hoverLayer.addChild(hoverTile);

      // Center the world in the viewport initially
      const centerWorld = () => {
        const { originX: ox, originY: oy } = centerOrigin(app.renderer.width, app.renderer.height);
        world.position.set(ox, oy + ((GRID_SIZE - 1) * TILE_H) / 2);
      };
      centerWorld();

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      // Convert a global screen point to grid coords, accounting for pan/zoom
      const globalToGrid = (globalX: number, globalY: number) => {
        const local = world.toLocal(new Point(globalX, globalY));
        return screenToGrid(local.x, local.y, originRef.current.originX, originRef.current.originY);
      };

      // --- Input state for pan + pinch ---
      type Pointer = { id: number; startX: number; startY: number; lastX: number; lastY: number; moved: number };
      const pointers = new Map<number, Pointer>();
      let pinchStartDist = 0;
      let pinchStartScale = 1;
      let pinchMid = { x: 0, y: 0 };

      const onDown = (e: FederatedPointerEvent) => {
        pointers.set(e.pointerId, {
          id: e.pointerId,
          startX: e.global.x,
          startY: e.global.y,
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
            // Pan
            world.position.x += dx;
            world.position.y += dy;
          } else if (pointers.size === 2) {
            // Pinch zoom
            const arr = Array.from(pointers.values());
            const ddx = arr[0].lastX - arr[1].lastX;
            const ddy = arr[0].lastY - arr[1].lastY;
            const dist = Math.hypot(ddx, ddy) || 1;
            const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartScale * (dist / pinchStartDist)));
            zoomAround(pinchMid.x, pinchMid.y, target);
          }
        }

        // Hover (only when not dragging)
        if (pointers.size === 0) {
          const { gx, gy } = globalToGrid(e.global.x, e.global.y);
          if (inBounds(gx, gy)) {
            const { sx, sy } = gridToScreen(gx, gy, originRef.current.originX, originRef.current.originY);
            hoverTile.position.set(sx, sy);
            hoverTile.alpha = 0.25;
          } else {
            hoverTile.alpha = 0;
          }
        } else {
          hoverTile.alpha = 0;
        }
      };

      const onUp = (e: FederatedPointerEvent) => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        const wasTap = p.moved < TAP_THRESHOLD_PX && pointers.size === 1;
        pointers.delete(e.pointerId);
        if (wasTap) {
          const { gx, gy } = globalToGrid(e.global.x, e.global.y);
          if (!inBounds(gx, gy)) return;
          const existing = stateRef.current.buildings.find(b => b.gx === gx && b.gy === gy);
          if (existing) callbacksRef.current.onTapBuilding(existing);
          else callbacksRef.current.onTapTile(gx, gy);
        }
      };

      const onUpOutside = (e: FederatedPointerEvent) => {
        pointers.delete(e.pointerId);
      };

      const onLeave = () => { hoverTile.alpha = 0; };

      // Wheel zoom (desktop)
      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const rect = host.getBoundingClientRect();
        const localX = ev.clientX - rect.left;
        const localY = ev.clientY - rect.top;
        const factor = Math.exp(-ev.deltaY * 0.0015);
        const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, world.scale.x * factor));
        zoomAround(localX, localY, target);
      };

      const zoomAround = (globalX: number, globalY: number, targetScale: number) => {
        // Keep the point under the cursor fixed while scaling.
        const beforeLocal = world.toLocal(new Point(globalX, globalY));
        world.scale.set(targetScale);
        const afterGlobal = world.toGlobal(beforeLocal);
        world.position.x += globalX - afterGlobal.x;
        world.position.y += globalY - afterGlobal.y;
      };

      app.stage.on('pointerdown', onDown);
      app.stage.on('pointermove', onMove);
      app.stage.on('pointerup', onUp);
      app.stage.on('pointerupoutside', onUpOutside);
      app.stage.on('pointerleave', onLeave);
      app.canvas.addEventListener('wheel', onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        if (cancelled || !appRef.current) return;
        // Don't reset user's pan/zoom on resize; only ensure initial centering
        // if the user hasn't interacted yet. Heuristic: never re-center after mount.
      });
      ro.observe(host);

      syncBuildings();

      const tickerFn = (ticker: { deltaTime: number }) => {
        const blocked = (gx: number, gy: number) =>
          stateRef.current.buildings.some(b => b.gx === gx && b.gy === gy);
        const { originX: ox, originY: oy } = originRef.current;
        for (const npc of npcsRef.current) {
          tickNPC(npc, ticker.deltaTime, ox, oy, blocked);
        }
      };
      app.ticker.add(tickerFn);

      (app as Application & { __cleanup?: () => void }).__cleanup = () => {
        ro.disconnect();
        app.canvas.removeEventListener('wheel', onWheel);
        app.stage.off('pointerdown', onDown);
        app.stage.off('pointermove', onMove);
        app.stage.off('pointerup', onUp);
        app.stage.off('pointerupoutside', onUpOutside);
        app.stage.off('pointerleave', onLeave);
      };
    })();

    return () => {
      cancelled = true;
      const a = appRef.current;
      if (a) {
        const cleanup = (a as Application & { __cleanup?: () => void }).__cleanup;
        cleanup?.();
        try { a.destroy(true, { children: true, texture: true }); } catch { /* ignore */ }
      }
      appRef.current = null;
      worldRef.current = null;
      buildingLayerRef.current = null;
      if (host) host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { syncBuildings(); }, [state]);

  function syncBuildings() {
    const layer = buildingLayerRef.current;
    if (!layer) return;
    // Remove only building sprites, not NPC sprites. We track buildings by
    // putting them at the start of the layer and keeping NPCs appended.
    // Simpler approach: detach NPCs, clear, re-add NPCs.
    const npcContainers = npcsRef.current.map(n => n.container);
    npcContainers.forEach(c => {
      if (c.parent === layer) layer.removeChild(c);
    });
    layer.removeChildren();
    const { originX, originY } = originRef.current;
    const current = stateRef.current;
    for (const b of current.buildings) {
      const sprite = buildBuildingGraphics(b.type, b.level);
      const { sx, sy } = gridToScreen(b.gx, b.gy, originX, originY);
      sprite.position.set(sx, sy);
      sprite.zIndex = b.gx + b.gy;
      layer.addChild(sprite);
    }
    npcContainers.forEach(c => layer.addChild(c));
  }

  return <div ref={hostRef} className="fixed inset-0 touch-none" />;
}
