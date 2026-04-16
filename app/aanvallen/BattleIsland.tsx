'use client';

import { useEffect, useRef } from 'react';
import {
  AnimatedSprite,
  Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  TilingSprite,
  Rectangle,
} from 'pixi.js';
import { loadCombatSprites } from '@/lib/game/combatSprites';
import { createBattle, tickBattle, isBattleDone } from '@/lib/game/battleEngine';
import { loadTopdownAtlas, getTopdownTexture } from '@/lib/game/topdown';
import { loadTinyswordsTerrain, TILEMAP_CELL } from '@/lib/game/tinyswordsTerrain';
import { spriteForLevel, footprintOf, BUILDINGS } from '@/lib/game/buildings';
import { autotileGrassSlot } from '@/lib/game/autotile';
import { TILE_W, TILE_H, CITY_CENTER } from '@/lib/game/iso';
import { parseElevation, MAP_COLS, MAP_ROWS } from '@/lib/game/staticMap';
import type { PveCamp } from '@/lib/pveCamps';
import type { CityState } from '@/lib/cityStore';

interface Props {
  camp: PveCamp;
  cityState: CityState;
  /** Called with the actual battle outcome (true=won, false=lost). */
  onComplete: (won: boolean) => void;
}

export default function BattleIsland({ camp, cityState, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();

    (async () => {
      const W = host.clientWidth || 400;
      const H = host.clientHeight || 600;

      await app.init({
        width: W, height: H,
        backgroundAlpha: 1, background: 0x4a9bb8,
        antialias: false, roundPixels: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }
      host.appendChild(app.canvas);

      const [atlas, terrain, combat] = await Promise.all([
        loadTopdownAtlas(), loadTinyswordsTerrain(), loadCombatSprites(),
      ]);
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }

      // ---- Scene ----
      const world = new Container();
      app.stage.addChild(world);

      // Night/dusk filter for dramatic battle atmosphere
      const nightFilter = new ColorMatrixFilter();
      nightFilter.brightness(0.65, false);
      nightFilter.saturate(-0.2, true);
      world.filters = [nightFilter];

      const tileLayer = new Container();
      world.addChild(tileLayer);
      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      const battleLayer = new Container();
      battleLayer.sortableChildren = true;
      world.addChild(battleLayer);
      const fxLayer = new Container();
      world.addChild(fxLayer);
      const uiLayer = new Container();
      app.stage.addChild(uiLayer);

      // ---- Terrain ----
      const elevation = parseElevation();
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);

      const bakedTiles = new Map<string, Texture>();
      const bakeCell = (col: number, row: number): Texture => {
        const key = `${col},${row}`;
        let t = bakedTiles.get(key);
        if (!t) {
          const framed = new Texture({ source: terrain.tilemap.source, frame: new Rectangle(col * TILEMAP_CELL, row * TILEMAP_CELL, TILEMAP_CELL, TILEMAP_CELL) });
          const s = new Sprite(framed);
          t = app.renderer.generateTexture({ target: s, resolution: 1 });
          if (t.source) t.source.scaleMode = 'nearest';
          s.destroy();
          bakedTiles.set(key, t);
        }
        return t;
      };

      // Water
      const ww = (MAP_COLS + 20) * TILE_W;
      const wh = (MAP_ROWS + 20) * TILE_H;
      const water = new TilingSprite({ texture: terrain.water, width: ww, height: wh });
      water.position.set((mapOffsetGx - 10) * TILE_W, (mapOffsetGy - 10) * TILE_H);
      tileLayer.addChild(water);

      // Grass
      const GRASS_TINTS = [0x7ca054, 0x6e9048, 0x5e8040, 0x78985a, 0x688848, 0x5a7a3e];
      const hashTint = (gx: number, gy: number) => {
        let h = (gx * 374761393 + gy * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        return GRASS_TINTS[((h ^ (h >>> 16)) >>> 0) % GRASS_TINTS.length];
      };
      const landCells: Array<{ gx: number; gy: number }> = [];
      const landEdgeCells: Array<{ gx: number; gy: number }> = [];

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] <= 0) continue;
          const gx = mapOffsetGx + rx;
          const gy = mapOffsetGy + ry;
          landCells.push({ gx, gy });
          const hasWater =
            (elevation[ry - 1]?.[rx] ?? 0) === 0 ||
            (elevation[ry + 1]?.[rx] ?? 0) === 0 ||
            (elevation[ry]?.[rx - 1] ?? 0) === 0 ||
            (elevation[ry]?.[rx + 1] ?? 0) === 0;
          if (hasWater) landEdgeCells.push({ gx, gy });
          const slot = autotileGrassSlot(elevation, rx, ry);
          if (!slot) continue;
          const tex = bakeCell(slot.col, slot.row);
          const sprite = new Sprite(tex);
          sprite.anchor.set(0, 0);
          sprite.position.set(gx * TILE_W, gy * TILE_H);
          sprite.tint = hashTint(rx, ry);
          tileLayer.addChild(sprite);
        }
      }

      // Foam
      const foamSheet = terrain.waterFoam;
      let foamCount = 0;
      for (let ry = 0; ry < MAP_ROWS && foamCount < 80; ry++) {
        for (let rx = 0; rx < MAP_COLS && foamCount < 80; rx++) {
          if (elevation[ry][rx] !== 0) continue;
          const hasGrass = (elevation[ry - 1]?.[rx] ?? 0) > 0 || (elevation[ry + 1]?.[rx] ?? 0) > 0 ||
            (elevation[ry]?.[rx - 1] ?? 0) > 0 || (elevation[ry]?.[rx + 1] ?? 0) > 0;
          if (!hasGrass) continue;
          const foam = new AnimatedSprite(foamSheet.frames);
          foam.animationSpeed = 0.10 + Math.random() * 0.04;
          foam.loop = true;
          foam.gotoAndPlay(Math.floor(Math.random() * foamSheet.frames.length));
          foam.anchor.set(0.5, 0.5);
          foam.position.set((mapOffsetGx + rx) * TILE_W + TILE_W * 0.5, (mapOffsetGy + ry) * TILE_H + TILE_H * 0.5);
          foam.scale.set((TILE_W * 3.2) / foamSheet.frameW);
          foam.alpha = 0.22;
          tileLayer.addChild(foam);
          foamCount++;
        }
      }

      // ---- Buildings + Trees ----
      const buildings = cityState.buildings;
      const buildingSpriteMap = new Map<string, Sprite>();

      for (const b of buildings) {
        const fp = footprintOf(b.type);

        // Trees — BIG, visible
        if (b.type === 'tree' && terrain.trees.length > 0) {
          const sheet = terrain.trees[(b.gx + b.gy) % terrain.trees.length];
          const ts = new Sprite(sheet.frames[0]);
          ts.anchor.set(0.5, 0.9);
          const longSide = Math.max(sheet.frameW, sheet.frameH);
          ts.scale.set((TILE_W * 2.2) / longSide); // bigger trees
          ts.x = (b.gx + 0.5) * TILE_W;
          ts.y = (b.gy + 0.5) * TILE_H;
          ts.zIndex = Math.floor(ts.y + TILE_H);
          buildingLayer.addChild(ts);
          continue;
        }

        if (b.type === 'path') {
          const p = new Graphics();
          p.rect(b.gx * TILE_W + 4, b.gy * TILE_H + 4, TILE_W - 8, TILE_H - 8);
          p.fill({ color: 0x8B7355 });
          p.zIndex = 0;
          buildingLayer.addChild(p);
          continue;
        }

        const slug = spriteForLevel(b.type, b.level);
        const tex = getTopdownTexture(atlas, slug);
        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.95);
        const cx = (b.gx + fp.w / 2) * TILE_W;
        const cy = (b.gy + fp.h / 2) * TILE_H;
        sprite.x = cx; sprite.y = cy;
        const bdef = BUILDINGS[b.type];
        const baseScale = (bdef.spriteScale ?? 1) * 1.4;
        const span = Math.max(fp.w, fp.h) * TILE_W;
        sprite.width = span * baseScale;
        sprite.height = (tex.height / tex.width) * span * baseScale;
        sprite.zIndex = Math.floor(cy + TILE_H * 0.4);
        buildingLayer.addChild(sprite);
        buildingSpriteMap.set(b.id, sprite);
      }

      // ---- Camera ----
      let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
      for (const { gx, gy } of landCells) {
        minPx = Math.min(minPx, gx * TILE_W);
        maxPx = Math.max(maxPx, (gx + 1) * TILE_W);
        minPy = Math.min(minPy, gy * TILE_H);
        maxPy = Math.max(maxPy, (gy + 1) * TILE_H);
      }
      const islandCx = (minPx + maxPx) / 2;
      const islandCy = (minPy + maxPy) / 2;
      const pad = TILE_W * 4;
      const fitScale = Math.min(W / (maxPx - minPx + pad * 2), H / (maxPy - minPy + pad * 2));

      let zoom = fitScale * 3.0; // start close on city
      let camX = W / 2 - islandCx * zoom;
      let camY = H / 2 - islandCy * zoom;
      const applyCamera = () => { world.scale.set(zoom); world.x = camX; world.y = camY; };
      applyCamera();

      // Zoom/pan controls
      app.canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const f = e.deltaY > 0 ? 0.9 : 1.1;
        const nz = Math.max(fitScale * 0.5, Math.min(fitScale * 4, zoom * f));
        camX = e.offsetX - (e.offsetX - camX) * (nz / zoom);
        camY = e.offsetY - (e.offsetY - camY) * (nz / zoom);
        zoom = nz; applyCamera();
      }, { passive: false });

      let lastPinchDist = 0, lastPinchCx = 0, lastPinchCy = 0;
      app.canvas.addEventListener('touchmove', (e: TouchEvent) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          if (lastPinchDist > 0) {
            const nz = Math.max(fitScale * 0.5, Math.min(fitScale * 4, zoom * dist / lastPinchDist));
            const rect = app.canvas.getBoundingClientRect();
            const mx = cx - rect.left, my = cy - rect.top;
            camX = mx - (mx - camX) * (nz / zoom) + (cx - lastPinchCx);
            camY = my - (my - camY) * (nz / zoom) + (cy - lastPinchCy);
            zoom = nz; applyCamera();
          }
          lastPinchDist = dist; lastPinchCx = cx; lastPinchCy = cy;
        }
      }, { passive: false });
      app.canvas.addEventListener('touchend', () => { lastPinchDist = 0; });

      let dragging = false, dsx = 0, dsy = 0, dcx = 0, dcy = 0;
      app.canvas.addEventListener('pointerdown', (e) => { dragging = true; dsx = e.clientX; dsy = e.clientY; dcx = camX; dcy = camY; });
      app.canvas.addEventListener('pointermove', (e) => { if (!dragging) return; camX = dcx + (e.clientX - dsx); camY = dcy + (e.clientY - dsy); applyCamera(); });
      app.canvas.addEventListener('pointerup', () => { dragging = false; });

      // ---- Init battle (landEdgeCells passed directly!) ----
      const islandBbox = { minGx: mapOffsetGx, maxGx: mapOffsetGx + MAP_COLS, minGy: mapOffsetGy, maxGy: mapOffsetGy + MAP_ROWS };
      const battle = createBattle(camp, buildings, 0, 0, landEdgeCells);

      const enemyUnit = combat.enemies[camp.id];
      if (!enemyUnit) { console.error('No enemy sprites for camp', camp.id); return; }

      // ---- Sprite pools ----
      const enemySpriteMap = new Map<number, AnimatedSprite>();
      const defenderSpriteMap = new Map<number, AnimatedSprite>();
      const archerSpriteMap = new Map<number, AnimatedSprite>();
      const arrowSpriteMap = new Map<number, Sprite>();
      const fxSpriteMap = new Map<number, AnimatedSprite>();
      const hpBarMap = new Map<string, Graphics>();

      // ---- UI: countdown + result text ----
      const countdownText = new Text({
        text: '3', style: new TextStyle({
          fontFamily: '"Lilita One", sans-serif', fontSize: 72,
          fill: 0xffffff, stroke: { color: 0x0d0a06, width: 10 },
          dropShadow: { color: 0x000000, blur: 16, distance: 6, angle: Math.PI / 4, alpha: 0.8 },
        }),
      });
      countdownText.anchor.set(0.5);
      countdownText.x = W / 2; countdownText.y = H / 2;
      uiLayer.addChild(countdownText);

      const resultText = new Text({
        text: '', style: new TextStyle({
          fontFamily: '"Lilita One", sans-serif', fontSize: 48,
          fill: 0xfdd069, stroke: { color: 0x0d0a06, width: 8 },
          dropShadow: { color: 0x000000, blur: 12, distance: 4, angle: Math.PI / 4, alpha: 0.7 },
        }),
      });
      resultText.anchor.set(0.5);
      resultText.x = W / 2; resultText.y = H * 0.15; resultText.alpha = 0;
      uiLayer.addChild(resultText);

      const vignette = new Graphics();
      app.stage.addChild(vignette);

      // ---- Cinematic state ----
      let cinematicTime = 0;
      const targetZoom = fitScale * 1.5; // don't zoom too far out

      // ---- Main ticker ----
      app.ticker.add((ticker) => {
        const rawDt = ticker.deltaTime / 60;

        // Cinematic zoom-out
        cinematicTime += rawDt;
        if (battle.phase === 'countdown') {
          const t = Math.min(cinematicTime / 2.5, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          zoom = fitScale * 3.0 + (targetZoom - fitScale * 3.0) * ease;
          camX = W / 2 - islandCx * zoom;
          camY = H / 2 - islandCy * zoom;
          applyCamera();

          // Countdown display
          const num = battle.countdownNum;
          countdownText.text = num > 0 ? String(num) : 'VECHT!';
          countdownText.style.fill = num > 0 ? 0xffffff : 0xfdd069;
          countdownText.alpha = 1;
          // Pulse scale
          const pulse = 1 + Math.sin(cinematicTime * 8) * 0.05;
          countdownText.scale.set(pulse);
        } else {
          // Hide countdown
          if (countdownText.alpha > 0) {
            countdownText.alpha -= rawDt * 4;
            if (countdownText.alpha < 0) countdownText.alpha = 0;
          }
        }

        tickBattle(battle, rawDt, buildings, 0, 0, islandBbox, camp);

        // ---- Enemies ----
        for (const enemy of battle.enemies) {
          let sprite = enemySpriteMap.get(enemy.id);
          if (!sprite) {
            sprite = new AnimatedSprite(enemyUnit.run);
            sprite.anchor.set(0.5, 0.8);
            sprite.animationSpeed = 0.15;
            sprite.play();
            battleLayer.addChild(sprite);
            enemySpriteMap.set(enemy.id, sprite);
          }
          if (enemy.state === 'dead') {
            sprite.alpha = Math.max(0, sprite.alpha - rawDt * 3);
            if (sprite.alpha <= 0) { battleLayer.removeChild(sprite); enemySpriteMap.delete(enemy.id); }
          } else {
            sprite.x = enemy.x; sprite.y = enemy.y;
            sprite.zIndex = Math.floor(enemy.y);
            const sc = TILE_W / enemyUnit.frameH * 3.0;
            sprite.scale.set(enemy.facingLeft ? -sc : sc, sc);
            const want = enemy.state === 'walk' ? enemyUnit.run : enemy.state === 'attack' ? enemyUnit.attack : enemyUnit.idle;
            if (sprite.textures !== want) { sprite.textures = want; sprite.play(); }
          }
        }

        // ---- Defenders ----
        for (const def of battle.defenders) {
          let sprite = defenderSpriteMap.get(def.id);
          const uf = def.unitType === 'lancer' ? combat.blueLancer : combat.blueWarrior;
          if (!sprite) {
            sprite = new AnimatedSprite(uf.idle);
            sprite.anchor.set(0.5, 0.8); sprite.animationSpeed = 0.15; sprite.play();
            battleLayer.addChild(sprite);
            defenderSpriteMap.set(def.id, sprite);
          }
          if (def.state === 'dead') {
            sprite.alpha = Math.max(0, sprite.alpha - rawDt * 3);
            if (sprite.alpha <= 0) { battleLayer.removeChild(sprite); defenderSpriteMap.delete(def.id); }
          } else {
            sprite.x = def.x; sprite.y = def.y;
            sprite.zIndex = Math.floor(def.y);
            const sc = TILE_W / uf.frameH * 3.0;
            sprite.scale.set(def.facingLeft ? -sc : sc, sc);
            const want = def.state === 'walk' ? uf.run : def.state === 'attack' ? uf.attack : uf.idle;
            if (sprite.textures !== want) { sprite.textures = want; sprite.play(); }
          }
        }

        // ---- Archers ----
        for (const a of battle.archers) {
          let sprite = archerSpriteMap.get(a.id);
          if (!sprite) {
            sprite = new AnimatedSprite(combat.archer.idle);
            sprite.anchor.set(0.5, 0.8); sprite.animationSpeed = 0.18; sprite.play();
            battleLayer.addChild(sprite);
            archerSpriteMap.set(a.id, sprite);
          }
          sprite.x = a.x; sprite.y = a.y; sprite.zIndex = Math.floor(a.y);
          sprite.scale.set(TILE_W / 192 * 2.8);
          const want = a.state === 'shoot' ? combat.archer.shoot : combat.archer.idle;
          if (sprite.textures !== want) { sprite.textures = want; sprite.play(); }
        }

        // ---- Arrows ----
        for (const arrow of battle.arrows) {
          let sprite = arrowSpriteMap.get(arrow.id);
          if (!sprite) {
            sprite = new Sprite(combat.arrow);
            sprite.anchor.set(0.5); sprite.scale.set(TILE_W / 64 * 0.7);
            battleLayer.addChild(sprite);
            arrowSpriteMap.set(arrow.id, sprite);
          }
          sprite.x = arrow.x; sprite.y = arrow.y; sprite.rotation = arrow.angle; sprite.zIndex = 99999;
        }
        for (const [id] of arrowSpriteMap) {
          if (!battle.arrows.find(a => a.id === id)) {
            battleLayer.removeChild(arrowSpriteMap.get(id)!);
            arrowSpriteMap.delete(id);
          }
        }

        // ---- FX (AnimatedSprite auto-plays, onComplete marks done) ----
        for (const fx of battle.fx) {
          if (fx.done) {
            const s = fxSpriteMap.get(fx.id);
            if (s) { fxLayer.removeChild(s); fxSpriteMap.delete(fx.id); }
            continue;
          }
          if (!fxSpriteMap.has(fx.id)) {
            const frames = fx.type === 'explosion' ? combat.fx.explosion : combat.fx.fireSmall;
            const sprite = new AnimatedSprite(frames);
            sprite.anchor.set(0.5);
            sprite.scale.set(fx.type === 'explosion' ? TILE_W / 192 * 4 : TILE_W / 64 * 2.5);
            sprite.animationSpeed = fx.type === 'explosion' ? 0.35 : 0.25;
            sprite.loop = false;
            sprite.onComplete = () => { fx.done = true; };
            sprite.x = fx.x; sprite.y = fx.y;
            sprite.play();
            fxLayer.addChild(sprite);
            fxSpriteMap.set(fx.id, sprite);
          }
        }

        // ---- Building HP bars ----
        for (const [bid, bhp] of battle.buildingHp) {
          const bs = buildingSpriteMap.get(bid);
          if (!bs) continue;
          if (bhp.destroyed) {
            bs.alpha = 0.25; bs.tint = 0x333333;
          } else if (bhp.hp < bhp.maxHp) {
            const r = bhp.hp / bhp.maxHp;
            bs.tint = r > 0.5 ? 0xffffff : r > 0.25 ? 0xff9999 : 0xff4444;
            let bar = hpBarMap.get(bid);
            if (!bar) { bar = new Graphics(); battleLayer.addChild(bar); hpBarMap.set(bid, bar); }
            bar.clear();
            const bw = 50, bh = 6, bx = bs.x - bw / 2, by = bs.y - bs.height * 0.7;
            bar.rect(bx, by, bw, bh).fill({ color: 0x000000, alpha: 0.6 });
            bar.rect(bx + 1, by + 1, (bw - 2) * r, bh - 2).fill({ color: r > 0.5 ? 0x4caf50 : r > 0.25 ? 0xff9800 : 0xf44336 });
            bar.zIndex = 999999;
          }
        }

        // ---- Camera shake (only during attacks, scaled by timeScale) ----
        if (battle.phase === 'fight' && battle.enemies.some(e => e.state === 'attack')) {
          const intensity = battle.timeScale < 0.5 ? 5 : 3; // stronger shake in slow-mo
          world.x = camX + (Math.random() - 0.5) * intensity;
          world.y = camY + (Math.random() - 0.5) * intensity * 0.7;
        } else if (battle.phase !== 'countdown') {
          world.x = camX; world.y = camY;
        }

        // ---- Resolve ----
        if (battle.phase === 'resolve') {
          const resolveZoom = targetZoom * 1.3;
          zoom += (resolveZoom - zoom) * rawDt * 1.5;
          camX = W / 2 - islandCx * zoom;
          camY = H / 2 - islandCy * zoom;
          applyCamera();

          vignette.clear();
          vignette.rect(0, 0, W, H).fill({ color: 0x000000, alpha: Math.min(resultText.alpha * 0.4, 0.4) });

          resultText.text = battle.won ? 'OVERWINNING!' : 'VERSLAGEN!';
          resultText.style.fill = battle.won ? 0xfdd069 : 0xc75b3d;
          resultText.alpha = Math.min(resultText.alpha + rawDt * 2.5, 1);
          const spring = resultText.alpha < 0.5 ? resultText.alpha * 2 * 1.3 : 1.3 - (resultText.alpha - 0.5) * 2 * 0.3;
          resultText.scale.set(Math.max(spring, 0.8));
        }

        // ---- Done ----
        if (isBattleDone(battle) && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => onCompleteRef.current(battle.won ?? false), 1200);
        }
      });
    })();

    return () => {
      cancelled = true;
      try { app.destroy(true, { children: true, texture: false }); } catch { /* */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={hostRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />;
}
