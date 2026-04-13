'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics, Text } from 'pixi.js';

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

      // --- smoke test: draw a placeholder diamond (iso tile preview) ---
      const w = app.renderer.width;
      const h = app.renderer.height;
      const cx = w / 2;
      const cy = h / 2;

      const tile = new Graphics();
      tile.moveTo(0, -32).lineTo(64, 0).lineTo(0, 32).lineTo(-64, 0).closePath();
      tile.fill({ color: 0x6ba368 });
      tile.stroke({ color: 0x4a7d4a, width: 2 });
      tile.position.set(cx, cy);
      app.stage.addChild(tile);

      const label = new Text({
        text: 'Bliep · Stad (v1 smoke)',
        style: { fill: 0x6b4520, fontSize: 14, fontFamily: 'system-ui, sans-serif', fontWeight: '600' },
      });
      label.anchor.set(0.5, 0);
      label.position.set(cx, 16);
      app.stage.addChild(label);
    })();

    return () => {
      cancelled = true;
      const a = appRef.current;
      if (a) {
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
