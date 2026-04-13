'use client';

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { TILE_W, TILE_H, GRID_SIZE, gridToScreen, screenToGrid, inBounds, centerOrigin } from '@/lib/game/iso';
import { PALETTE } from '@/lib/game/palette';
import { buildBuildingGraphics } from '@/lib/game/drawBuilding';
import type { CityState, PlacedBuilding } from '@/lib/cityStore';

interface Props {
  state: CityState;
  onTapTile: (gx: number, gy: number) => void;
  onTapBuilding: (b: PlacedBuilding) => void;
}

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
  const buildingLayerRef = useRef<Container | null>(null);
  const originRef = useRef<{ originX: number; originY: number }>({ originX: 0, originY: 0 });
  const stateRef = useRef<CityState>(state);
  const callbacksRef = useRef({ onTapTile, onTapBuilding });

  // Keep refs in sync with latest props
  useEffect(() => { stateRef.current = state; });
  useEffect(() => { callbacksRef.current = { onTapTile, onTapBuilding }; }, [onTapTile, onTapBuilding]);

  // Mount pixi app once
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

      const tileLayer = new Container();
      world.addChild(tileLayer);

      const hoverLayer = new Container();
      world.addChild(hoverLayer);

      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      buildingLayerRef.current = buildingLayer;

      const { originX, originY } = centerOrigin(app.renderer.width, app.renderer.height);
      originRef.current = { originX, originY };

      // Draw 8x8 grass
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

      // Hover indicator
      const hoverTile = new Graphics();
      drawTile(hoverTile, PALETTE.hover, PALETTE.hover, 2);
      hoverTile.alpha = 0;
      hoverLayer.addChild(hoverTile);

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      const onMove = (e: FederatedPointerEvent) => {
        const { originX: ox, originY: oy } = originRef.current;
        const { gx, gy } = screenToGrid(e.global.x, e.global.y, ox, oy);
        if (inBounds(gx, gy)) {
          const { sx, sy } = gridToScreen(gx, gy, ox, oy);
          hoverTile.position.set(sx, sy);
          hoverTile.alpha = 0.25;
        } else {
          hoverTile.alpha = 0;
        }
      };
      const onLeave = () => { hoverTile.alpha = 0; };
      const onTap = (e: FederatedPointerEvent) => {
        const { originX: ox, originY: oy } = originRef.current;
        const { gx, gy } = screenToGrid(e.global.x, e.global.y, ox, oy);
        if (!inBounds(gx, gy)) return;
        const existing = stateRef.current.buildings.find(b => b.gx === gx && b.gy === gy);
        if (existing) callbacksRef.current.onTapBuilding(existing);
        else callbacksRef.current.onTapTile(gx, gy);
      };

      app.stage.on('pointermove', onMove);
      app.stage.on('pointerleave', onLeave);
      app.stage.on('pointertap', onTap);

      const ro = new ResizeObserver(() => {
        if (cancelled || !appRef.current) return;
        const { originX: nx, originY: ny } = centerOrigin(app.renderer.width, app.renderer.height);
        originRef.current = { originX: nx, originY: ny };
        tileLayer.children.forEach((child, idx) => {
          const gy2 = Math.floor(idx / GRID_SIZE);
          const gx2 = idx % GRID_SIZE;
          const { sx, sy } = gridToScreen(gx2, gy2, nx, ny);
          (child as Graphics).position.set(sx, sy);
        });
        // Re-sync buildings
        syncBuildings();
      });
      ro.observe(host);

      // Initial render
      syncBuildings();

      (app as Application & { __cleanup?: () => void }).__cleanup = () => {
        ro.disconnect();
        app.stage.off('pointermove', onMove);
        app.stage.off('pointerleave', onLeave);
        app.stage.off('pointertap', onTap);
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
      buildingLayerRef.current = null;
      if (host) host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync building layer when city state changes
  useEffect(() => { syncBuildings(); }, [state]);

  function syncBuildings() {
    const layer = buildingLayerRef.current;
    if (!layer) return;
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
  }

  return <div ref={hostRef} className="fixed inset-0" />;
}
