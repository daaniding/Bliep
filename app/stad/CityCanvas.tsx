'use client';

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { TILE_W, TILE_H, GRID_SIZE, gridToScreen, screenToGrid, inBounds, centerOrigin } from '@/lib/game/iso';
import { PALETTE } from '@/lib/game/palette';

function drawTile(g: Graphics, fill: number, stroke: number, strokeWidth = 1) {
  g.moveTo(0, -TILE_H / 2)
    .lineTo(TILE_W / 2, 0)
    .lineTo(0, TILE_H / 2)
    .lineTo(-TILE_W / 2, 0)
    .closePath();
  g.fill({ color: fill });
  g.stroke({ color: stroke, width: strokeWidth, alpha: 0.4 });
}

export default function CityCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

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

      const { originX, originY } = centerOrigin(app.renderer.width, app.renderer.height);

      // Draw 8x8 grass grid
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

      // Hover tile indicator
      const hoverTile = new Graphics();
      drawTile(hoverTile, PALETTE.hover, PALETTE.hover, 2);
      hoverTile.alpha = 0;
      hoverLayer.addChild(hoverTile);

      // Input
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      const onMove = (e: FederatedPointerEvent) => {
        const { gx, gy } = screenToGrid(e.global.x, e.global.y, originX, originY);
        if (inBounds(gx, gy)) {
          const { sx, sy } = gridToScreen(gx, gy, originX, originY);
          hoverTile.position.set(sx, sy);
          hoverTile.alpha = 0.25;
        } else {
          hoverTile.alpha = 0;
        }
      };
      const onLeave = () => { hoverTile.alpha = 0; };

      app.stage.on('pointermove', onMove);
      app.stage.on('pointerleave', onLeave);

      // Recenter on resize
      const ro = new ResizeObserver(() => {
        if (cancelled || !appRef.current) return;
        const { originX: nx, originY: ny } = centerOrigin(app.renderer.width, app.renderer.height);
        tileLayer.children.forEach((child, idx) => {
          const gy2 = Math.floor(idx / GRID_SIZE);
          const gx2 = idx % GRID_SIZE;
          const { sx, sy } = gridToScreen(gx2, gy2, nx, ny);
          (child as Graphics).position.set(sx, sy);
        });
      });
      ro.observe(host);

      (app as Application & { __cleanup?: () => void }).__cleanup = () => {
        ro.disconnect();
        app.stage.off('pointermove', onMove);
        app.stage.off('pointerleave', onLeave);
      };
    })();

    return () => {
      cancelled = true;
      const a = appRef.current;
      if (a) {
        const cleanup = (a as Application & { __cleanup?: () => void }).__cleanup;
        cleanup?.();
        try {
          a.destroy(true, { children: true, texture: true });
        } catch { /* ignore */ }
      }
      appRef.current = null;
      if (host) host.innerHTML = '';
    };
  }, []);

  return <div ref={hostRef} className="fixed inset-0" />;
}
