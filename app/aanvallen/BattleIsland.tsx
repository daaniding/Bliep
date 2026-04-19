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
import { loadFarmTerrain } from '@/lib/game/farmTerrain';
import { generateGroves } from '@/lib/game/treeGroves';
import { spriteForLevel, footprintOf, BUILDINGS } from '@/lib/game/buildings';
import { TILE_W, TILE_H, CITY_CENTER } from '@/lib/game/iso';
import { parseElevation, processElevation, MAP_COLS, MAP_ROWS } from '@/lib/game/staticMap';
import type { PveCamp, Difficulty } from '@/lib/pveCamps';
import type { CityState } from '@/lib/cityStore';

interface Props {
  camp: PveCamp;
  cityState: CityState;
  difficulty: Difficulty;
  /** Called with the actual battle outcome (true=won, false=lost). */
  onComplete: (won: boolean) => void;
}

export default function BattleIsland({ camp, cityState, difficulty, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const cycleRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();

    (async () => {
      // Wait a frame for layout so clientWidth/Height are non-zero on mobile
      if ((host.clientWidth || 0) < 50 || (host.clientHeight || 0) < 50) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      const W = host.clientWidth || window.innerWidth || 400;
      const H = host.clientHeight || window.innerHeight || 600;

      await app.init({
        width: W, height: H,
        backgroundAlpha: 1, background: 0x4a9bb8,
        antialias: false, roundPixels: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }
      host.appendChild(app.canvas);

      // Resize canvas on window/orientation change (iOS rotate fix)
      const onResize = () => {
        if (!host) return;
        const nw = host.clientWidth || window.innerWidth || 400;
        const nh = host.clientHeight || window.innerHeight || 600;
        if (nw > 0 && nh > 0) app.renderer.resize(nw, nh);
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(onResize) : null;
      if (ro) ro.observe(host);

      let atlas: Awaited<ReturnType<typeof loadTopdownAtlas>>;
      let terrain: Awaited<ReturnType<typeof loadFarmTerrain>>;
      let combat: Awaited<ReturnType<typeof loadCombatSprites>>;
      try {
        [atlas, terrain, combat] = await Promise.all([
          loadTopdownAtlas().catch(() => ({} as Awaited<ReturnType<typeof loadTopdownAtlas>>)),
          loadFarmTerrain(),
          loadCombatSprites(),
        ]);
      } catch (err) {
        console.error('[battle] asset load failed', err);
        return;
      }
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }

      // Load custom tower sheets (per-level animated, match /stad)
      type TowerSheet = { frames: Texture[]; frameW: number; frameH: number };
      const towerSheets: Array<TowerSheet | null> = [];
      {
        const pixi = await import('pixi.js');
        for (let lv = 1; lv <= 7; lv++) {
          try {
            const tex = await pixi.Assets.load<Texture>(`/assets/towers/idle/${lv}.png`);
            if (!tex) { towerSheets.push(null); continue; }
            if (tex.source) tex.source.scaleMode = 'nearest';
            const fh = tex.frame.height;
            const count = Math.max(1, Math.floor(tex.frame.width / fh));
            const fw = Math.floor(tex.frame.width / count);
            const frames: Texture[] = [];
            for (let i = 0; i < count; i++) {
              const t = new Texture({ source: tex.source, frame: new Rectangle(i * fw, 0, fw, fh) });
              if (t.source) t.source.scaleMode = 'nearest';
              frames.push(t);
            }
            towerSheets.push({ frames, frameW: fw, frameH: fh });
          } catch { towerSheets.push(null); }
        }
      }

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
      // Trees render AFTER enemies so foliage hides units walking through bos
      const treeLayer = new Container();
      treeLayer.sortableChildren = true;
      world.addChild(treeLayer);
      // HP bars + tracker arrows ABOVE trees so they're always visible
      const hudLayer = new Container();
      world.addChild(hudLayer);
      const fxLayer = new Container();
      world.addChild(fxLayer);
      const uiLayer = new Container();
      app.stage.addChild(uiLayer);

      // ---- Terrain (matches /stad: farm tileset + random forest) ----
      const elevation = processElevation(parseElevation());
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);

      // Water background (simple tile sprite, tinted deep blue)
      const waterBg = new Graphics();
      waterBg.rect(
        (mapOffsetGx - 10) * TILE_W,
        (mapOffsetGy - 10) * TILE_H,
        (MAP_COLS + 20) * TILE_W,
        (MAP_ROWS + 20) * TILE_H,
      );
      waterBg.fill({ color: 0x2a7ca0 });
      tileLayer.addChild(waterBg);

      // Grass — random farm tiles
      const hashNum = (x: number, y: number, salt: number): number => {
        let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      };
      const landCells: Array<{ gx: number; gy: number }> = [];
      const landEdgeCells: Array<{ gx: number; gy: number }> = [];
      const landSet = new Set<string>();

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] !== 3) continue;
          const gx = mapOffsetGx + rx;
          const gy = mapOffsetGy + ry;
          landCells.push({ gx, gy });
          landSet.add(`${gx},${gy}`);
          const hasWater =
            (elevation[ry - 1]?.[rx] ?? 0) !== 3 ||
            (elevation[ry + 1]?.[rx] ?? 0) !== 3 ||
            (elevation[ry]?.[rx - 1] ?? 0) !== 3 ||
            (elevation[ry]?.[rx + 1] ?? 0) !== 3;
          if (hasWater) landEdgeCells.push({ gx, gy });
          const tex = terrain.grass[Math.floor(hashNum(gx, gy, 50) * terrain.grass.length)];
          const sprite = new Sprite(tex);
          sprite.anchor.set(0, 0);
          sprite.position.set(gx * TILE_W, gy * TILE_H);
          sprite.width = TILE_W; sprite.height = TILE_H;
          tileLayer.addChild(sprite);
        }
      }

      // Random forest via generateGroves (matches /stad)
      const groves = generateGroves(
        elevation, MAP_COLS, MAP_ROWS,
        CITY_CENTER.gx, CITY_CENTER.gy,
        mapOffsetGx, mapOffsetGy,
        cityState.npcSeed || 1,
      );
      const choppedSet = new Set(cityState.choppedTrees || []);
      for (const tp of groves) {
        if (tp.type === 'bush') continue;
        if (choppedSet.has(`${tp.gx},${tp.gy}`)) continue;
        const basicCount = Math.min(4, terrain.trees.length);
        if (basicCount === 0) continue;
        const sheet = terrain.trees[tp.sheetIndex % basicCount];
        const tex = sheet.frames[0];
        if (!tex) continue;
        const ts = new Sprite(tex);
        ts.anchor.set(0.5, 0.9);
        const longSide = Math.max(sheet.frameW, sheet.frameH);
        const scale = (TILE_W * tp.scale * 1.0) / longSide;
        ts.scale.set(scale);
        const sx = tp.gx * TILE_W + TILE_W / 2;
        const sy = tp.gy * TILE_H + TILE_H / 2;
        ts.x = sx + tp.offsetX * TILE_W;
        ts.y = sy + tp.offsetY * TILE_H;
        ts.zIndex = Math.floor(ts.y);
        treeLayer.addChild(ts);
      }

      // Central castle (target for enemy attacks — registered as 'castle-main')
      const buildings = cityState.buildings;
      const buildingSpriteMap = new Map<string, Sprite>();
      const castleTex = getTopdownTexture(atlas, 'ts:yellow:castle');
      if (castleTex && castleTex !== Texture.EMPTY) {
        const castle = new Sprite(castleTex);
        castle.anchor.set(0.5, 1.0);
        const cx = CITY_CENTER.gx * TILE_W + TILE_W / 2;
        const cy = CITY_CENTER.gy * TILE_H + TILE_H;
        castle.position.set(cx, cy);
        const castleScale = (7 * TILE_W) / Math.max(castleTex.width, castleTex.height);
        castle.scale.set(castleScale);
        castle.zIndex = Math.floor(cy);
        buildingLayer.addChild(castle);
        // Register so battle HP bar + damage flash show on visual castle
        buildingSpriteMap.set('castle-main', castle);
      }

      // ---- Buildings + Trees ----
      for (const b of buildings) {
        // Castle-main is rendered separately as decoration centerpiece
        if (b.id === 'castle-main') continue;
        const fp = footprintOf(b.type);

        // Trees — rendered in treeLayer so they overlap enemies walking through
        if (b.type === 'tree' && terrain.trees.length > 0) {
          const sheet = terrain.trees[(b.gx + b.gy) % terrain.trees.length];
          const ts = new Sprite(sheet.frames[0]);
          ts.anchor.set(0.5, 0.9);
          const longSide = Math.max(sheet.frameW, sheet.frameH);
          ts.scale.set((TILE_W * 2.2) / longSide);
          ts.x = (b.gx + 0.5) * TILE_W;
          ts.y = (b.gy + 0.5) * TILE_H;
          ts.zIndex = Math.floor(ts.y + TILE_H);
          treeLayer.addChild(ts);
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

        // Custom animated tower sheets (match /stad rendering)
        if (b.type === 'tower') {
          const lvIdx = Math.max(0, Math.min(6, b.level - 1));
          const sheet = towerSheets[lvIdx];
          if (sheet && sheet.frames.length > 0) {
            const anim = new AnimatedSprite(sheet.frames);
            anim.anchor.set(0.5, 0.95);
            const longSide = Math.max(sheet.frameW, sheet.frameH);
            const targetTiles = Math.max(fp.w, fp.h) * 1.4;
            const baseScaleTower = (TILE_W * targetTiles * (BUILDINGS.tower.spriteScale ?? 1)) / longSide;
            anim.scale.set(baseScaleTower);
            const cx = (b.gx + fp.w / 2) * TILE_W;
            const cy = (b.gy + fp.h / 2) * TILE_H;
            anim.position.set(cx, cy);
            anim.zIndex = Math.floor(cy + TILE_H * 0.4);
            anim.animationSpeed = 0.12;
            anim.loop = true;
            anim.play();
            buildingLayer.addChild(anim);
            buildingSpriteMap.set(b.id, anim as unknown as Sprite);
            continue;
          }
        }

        const slug = spriteForLevel(b.type, b.level);
        const tex = getTopdownTexture(atlas, slug);
        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.95);
        const cx = (b.gx + fp.w / 2) * TILE_W;
        const cy = (b.gy + fp.h / 2) * TILE_H;
        const bdef = BUILDINGS[b.type];
        const baseScale = (bdef.spriteScale ?? 1) * 1.4;
        const span = Math.max(fp.w, fp.h) * TILE_W;
        sprite.width = span * baseScale;
        sprite.height = (tex.height / tex.width) * span * baseScale;
        sprite.x = cx;
        sprite.y = cy;
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
        const nz = Math.max(fitScale * 1.0, Math.min(fitScale * 4, zoom * f));
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
            const nz = Math.max(fitScale * 1.0, Math.min(fitScale * 4, zoom * dist / lastPinchDist));
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
      const battle = createBattle(camp, buildings, 0, 0, landEdgeCells, landSet, difficulty);

      const enemyUnit = combat.enemies[camp.id];
      if (!enemyUnit) { console.error('No enemy sprites for camp', camp.id); return; }

      // ---- Sprite pools ----
      const enemySpriteMap = new Map<number, AnimatedSprite>();
      const enemyArrowMap = new Map<number, Graphics>();
      const enemyEdgeArrowMap = new Map<number, Graphics>();
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

      // ---- Follow-cycle state ----
      let followedEnemyId: number | null = null;
      let lastCycleReq = 0;

      // ---- Main ticker ----
      app.ticker.add((ticker) => {
        const rawDt = ticker.deltaTime / 60;

        // Cycle-enemy button request: advance to next alive enemy
        if (cycleRequestRef.current !== lastCycleReq) {
          lastCycleReq = cycleRequestRef.current;
          const alive = battle.enemies.filter(e => e.state !== 'dead');
          if (alive.length === 0) {
            followedEnemyId = null;
          } else {
            const currentIdx = followedEnemyId !== null
              ? alive.findIndex(e => e.id === followedEnemyId)
              : -1;
            followedEnemyId = alive[(currentIdx + 1) % alive.length].id;
          }
        }

        // Auto-advance if followed enemy died or no longer exists
        if (followedEnemyId !== null) {
          const current = battle.enemies.find(e => e.id === followedEnemyId);
          if (!current || current.state === 'dead') {
            const alive = battle.enemies.filter(e => e.state !== 'dead');
            followedEnemyId = alive.length > 0 ? alive[0].id : null;
          }
        }

        // Camera follow override (skips other camera code below)
        let followActive = false;
        if (followedEnemyId !== null && battle.phase !== 'countdown' && battle.phase !== 'resolve') {
          const e = battle.enemies.find(en => en.id === followedEnemyId);
          if (e && e.state !== 'dead') {
            followActive = true;
            const followZoom = fitScale * 2.4;
            zoom += (followZoom - zoom) * rawDt * 2.5;
            const targetCamX = W / 2 - e.x * zoom;
            const targetCamY = H / 2 - e.y * zoom;
            camX += (targetCamX - camX) * rawDt * 5;
            camY += (targetCamY - camY) * rawDt * 5;
            applyCamera();
          }
        }

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
          // Big red arrow above head (always visible, bobs + pulses)
          let arrow = enemyArrowMap.get(enemy.id);
          if (!arrow && enemy.state !== 'dead') {
            arrow = new Graphics();
            arrow
              .poly([-22, -6, 22, -6, 0, 22])
              .fill({ color: 0xff2828 })
              .stroke({ color: 0x0d0a06, width: 3 });
            hudLayer.addChild(arrow);
            enemyArrowMap.set(enemy.id, arrow);
          }
          if (enemy.state === 'dead') {
            sprite.alpha = Math.max(0, sprite.alpha - rawDt * 3);
            if (sprite.alpha <= 0) { battleLayer.removeChild(sprite); enemySpriteMap.delete(enemy.id); }
            const a = enemyArrowMap.get(enemy.id);
            if (a) { if (a.parent) a.parent.removeChild(a); a.destroy(); enemyArrowMap.delete(enemy.id); }
          } else {
            sprite.x = enemy.x; sprite.y = enemy.y;
            sprite.zIndex = Math.floor(enemy.y);
            const sc = TILE_W / enemyUnit.frameH * 3.0;
            sprite.scale.set(enemy.facingLeft ? -sc : sc, sc);
            const want = enemy.state === 'walk' ? enemyUnit.run : enemy.state === 'attack' ? enemyUnit.attack : enemyUnit.idle;
            if (sprite.textures !== want) { sprite.textures = want; sprite.play(); }
            if (arrow) {
              const bob = Math.sin(Date.now() / 180) * 6;
              arrow.x = enemy.x;
              arrow.y = enemy.y - TILE_W * 2.4 + bob;
              const pulse = 1.4 + Math.sin(Date.now() / 200) * 0.25;
              arrow.scale.set(pulse);
            }
            // Screen-edge indicator if enemy is off-screen
            const screen = world.toGlobal({ x: enemy.x, y: enemy.y });
            const onScreen = screen.x > 30 && screen.x < W - 30 && screen.y > 70 && screen.y < H - 30;
            let edge = enemyEdgeArrowMap.get(enemy.id);
            if (!onScreen) {
              if (!edge) {
                edge = new Graphics();
                edge.poly([-18, 0, 18, 0, 0, 22]).fill({ color: 0xff2828 }).stroke({ color: 0xfff8d0, width: 3 });
                uiLayer.addChild(edge);
                enemyEdgeArrowMap.set(enemy.id, edge);
              }
              // Clamp to edge, pointing toward enemy from screen center
              const cx = W / 2, cy = H / 2;
              const dx = screen.x - cx;
              const dy = screen.y - cy;
              const angle = Math.atan2(dy, dx);
              const pad = 40;
              const maxX = W / 2 - pad;
              const maxY = H / 2 - pad;
              const tx = Math.cos(angle);
              const ty = Math.sin(angle);
              const scaleX = tx !== 0 ? maxX / Math.abs(tx) : Infinity;
              const scaleY = ty !== 0 ? maxY / Math.abs(ty) : Infinity;
              const s = Math.min(scaleX, scaleY);
              edge.x = cx + tx * s;
              edge.y = cy + ty * s;
              edge.rotation = angle - Math.PI / 2;
              edge.scale.set(1 + Math.sin(Date.now() / 220) * 0.12);
            } else if (edge) {
              uiLayer.removeChild(edge);
              edge.destroy();
              enemyEdgeArrowMap.delete(enemy.id);
            }
          }
        }
        // Clean up edge arrows for removed enemies
        for (const [id, g] of enemyEdgeArrowMap) {
          if (!battle.enemies.find(e => e.id === id && e.state !== 'dead')) {
            uiLayer.removeChild(g); g.destroy(); enemyEdgeArrowMap.delete(id);
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
          const frameH = combat.archer.idle[0]?.height ?? 48;
          sprite.scale.set((TILE_W * 1.6) / frameH);
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

        // ---- Building HP bars + castle crown ----
        for (const [bid, bhp] of battle.buildingHp) {
          const bs = buildingSpriteMap.get(bid);
          if (!bs) continue;
          const isCastle = bid === battle.castleId;

          if (bhp.destroyed) {
            bs.alpha = 0.25; bs.tint = 0x333333;
          } else if (bhp.hp < bhp.maxHp || isCastle) {
            const r = bhp.hp / bhp.maxHp;
            if (bhp.hp < bhp.maxHp) {
              bs.tint = r > 0.5 ? 0xffffff : r > 0.25 ? 0xff9999 : 0xff4444;
            }

            let bar = hpBarMap.get(bid);
            if (!bar) { bar = new Graphics(); battleLayer.addChild(bar); hpBarMap.set(bid, bar); }
            bar.clear();
            const bw = isCastle ? 70 : 50;
            const bh = isCastle ? 8 : 6;
            const bx = bs.x - bw / 2;
            const by = bs.y - bs.height * 0.7 - (isCastle ? 14 : 0);

            // Castle crown icon
            if (isCastle) {
              bar.star(bs.x, by - 12, 5, 10, 5, 0);
              bar.fill({ color: 0xfdd069 });
            }

            bar.rect(bx, by, bw, bh).fill({ color: 0x000000, alpha: 0.7 });
            bar.rect(bx + 1, by + 1, (bw - 2) * r, bh - 2)
              .fill({ color: isCastle ? 0xfdd069 : (r > 0.5 ? 0x4caf50 : r > 0.25 ? 0xff9800 : 0xf44336) });
            bar.zIndex = 999999;
          }
        }

        // ---- Castle hit flash (brief red then fade) ----
        const flashState = (app as any)._flash ??= { alpha: 0 };
        if (battle.castleHit) flashState.alpha = 0.2;
        if (flashState.alpha > 0) {
          flashState.alpha = Math.max(0, flashState.alpha - rawDt * 2);
          if (battle.phase !== 'resolve') {
            vignette.clear();
            if (flashState.alpha > 0.01) vignette.rect(0, 0, W, H).fill({ color: 0xff0000, alpha: flashState.alpha });
          }
        }

        // ---- Unit HP bars (always visible while alive) ----
        const unitHpBars = (app as any)._uhp ??= new Map<number, Graphics>();
        const allUnits = [
          ...battle.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, dead: e.state === 'dead', color: 0xc75b3d })),
          ...battle.defenders.map(d => ({ id: d.id + 90000, x: d.x, y: d.y, hp: d.hp, maxHp: d.maxHp, dead: d.state === 'dead', color: 0x4a9bb8 })),
        ];
        for (const u of allUnits) {
          if (u.dead) {
            const bar = unitHpBars.get(u.id);
            if (bar) { battleLayer.removeChild(bar); unitHpBars.delete(u.id); }
            continue;
          }
          let bar = unitHpBars.get(u.id);
          if (!bar) { bar = new Graphics(); hudLayer.addChild(bar); unitHpBars.set(u.id, bar); }
          bar.clear();
          const bw = 60, bh = 9, r = Math.max(0, u.hp / u.maxHp);
          const by = u.y - TILE_W * 2.0;
          bar.rect(u.x - bw / 2, by, bw, bh).fill({ color: 0x0d0a06, alpha: 0.9 }).stroke({ color: 0xfff8d0, width: 2 });
          bar.rect(u.x - bw / 2 + 2, by + 2, (bw - 4) * r, bh - 4).fill({ color: u.color });
        }

        // ---- Damage numbers (float up and fade) ----
        const dmgTexts = (app as any)._dmg ??= new Map<number, Text>();
        for (const evt of battle.damageEvents) {
          const t = new Text({
            text: `-${evt.amount}`,
            style: new TextStyle({
              fontFamily: '"Lilita One", sans-serif', fontSize: 18,
              fill: evt.color, stroke: { color: 0x000000, width: 3 },
            }),
          });
          t.anchor.set(0.5); t.x = evt.x + (Math.random() - 0.5) * 20; t.y = evt.y;
          t.zIndex = 999999;
          battleLayer.addChild(t);
          dmgTexts.set(evt.id, t);
        }
        battle.damageEvents = []; // consumed
        for (const [id, t] of dmgTexts) {
          t.y -= rawDt * 80; t.alpha -= rawDt * 1.5;
          if (t.alpha <= 0) { battleLayer.removeChild(t); dmgTexts.delete(id); }
        }

        // ---- Wave announcement ----
        const waveText = (app as any)._waveText ??= (() => {
          const t = new Text({ text: '', style: new TextStyle({
            fontFamily: '"Lilita One", sans-serif', fontSize: 36,
            fill: 0xff6b35, stroke: { color: 0x0d0a06, width: 6 },
            dropShadow: { color: 0x000000, blur: 10, distance: 3, angle: Math.PI / 4, alpha: 0.7 },
          })});
          t.anchor.set(0.5); t.x = W / 2; t.y = H * 0.25; t.alpha = 0;
          uiLayer.addChild(t);
          return t;
        })() as Text;
        if (battle.waveAnnouncement) {
          waveText.text = battle.waveAnnouncement;
          waveText.alpha = Math.min(waveText.alpha + rawDt * 4, 1);
          waveText.scale.set(1 + Math.sin(battle.waveAnnouncementTimer * 3) * 0.05);
        } else {
          waveText.alpha = Math.max(waveText.alpha - rawDt * 3, 0);
        }

        // ---- Smoke on damaged buildings ----
        for (const [bid, bhp] of battle.buildingHp) {
          const bs = buildingSpriteMap.get(bid);
          if (!bs || bhp.destroyed) continue;
          const ratio = bhp.hp / bhp.maxHp;
          if (ratio < 0.5 && Math.random() < rawDt * 3) {
            // Spawn small fire particle on building
            battle.fx.push({
              id: battle.nextId++,
              x: bs.x + (Math.random() - 0.5) * 40,
              y: bs.y - bs.height * 0.3 - Math.random() * 20,
              type: 'fire', done: false,
            });
          }
        }

        // ---- Camera shake (only during attacks, scaled by timeScale) ----
        if (!followActive) {
          if (battle.phase === 'battle' && battle.enemies.some(e => e.state === 'attack')) {
            const intensity = battle.timeScale < 0.5 ? 5 : 3;
            world.x = camX + (Math.random() - 0.5) * intensity;
            world.y = camY + (Math.random() - 0.5) * intensity * 0.7;
          } else if (battle.phase !== 'countdown') {
            world.x = camX; world.y = camY;
          }
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      <button
        onClick={() => { cycleRequestRef.current += 1; }}
        style={{
          position: 'absolute',
          right: 14,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
          padding: '10px 16px',
          borderRadius: 14,
          border: '3px solid #0d0a06',
          background: 'linear-gradient(180deg, #fdd069 0%, #b8791f 100%)',
          color: '#1c0f06',
          fontFamily: '"Lilita One", sans-serif',
          fontSize: 14,
          letterSpacing: '0.04em',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 4px 0 #0d0a06, 0 7px 14px rgba(0,0,0,0.45)',
          cursor: 'pointer',
          zIndex: 50,
        }}
      >
        ▶ VOLG
      </button>
    </div>
  );
}
