'use client';

import { useEffect, useRef } from 'react';
import {
  AnimatedSprite,
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  TilingSprite,
  Rectangle,
} from 'pixi.js';
import { loadCombatSprites, type CombatSprites } from '@/lib/game/combatSprites';
import {
  createBattle,
  tickBattle,
  isBattleDone,
  type BattleState,
} from '@/lib/game/battleEngine';
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
  won: boolean;
  onComplete: () => void;
}

export default function BattleIsland({ camp, cityState, won, onComplete }: Props) {
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
        width: W,
        height: H,
        backgroundAlpha: 1,
        background: 0x4a9bb8,
        antialias: false,
        roundPixels: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }
      host.appendChild(app.canvas);

      // ---- Load assets ----
      const [atlas, terrain, combat] = await Promise.all([
        loadTopdownAtlas(),
        loadTinyswordsTerrain(),
        loadCombatSprites(),
      ]);
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }

      // ---- Scene hierarchy ----
      const world = new Container();
      app.stage.addChild(world);

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

      // ---- Terrain: real Tiny Swords tiles ----
      const elevation = parseElevation();
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);

      // Bake tilemap cells
      const bakedTiles = new Map<string, Texture>();
      const bakeCell = (col: number, row: number): Texture => {
        const key = `${col},${row}`;
        let t = bakedTiles.get(key);
        if (!t) {
          const framed = new Texture({
            source: terrain.tilemap.source,
            frame: new Rectangle(col * TILEMAP_CELL, row * TILEMAP_CELL, TILEMAP_CELL, TILEMAP_CELL),
          });
          const s = new Sprite(framed);
          t = app.renderer.generateTexture({ target: s, resolution: 1 });
          if (t.source) t.source.scaleMode = 'nearest';
          s.destroy();
          bakedTiles.set(key, t);
        }
        return t;
      };

      // Water backdrop
      const waterW = (MAP_COLS + 20) * TILE_W;
      const waterH = (MAP_ROWS + 20) * TILE_H;
      const water = new TilingSprite({
        texture: terrain.water,
        width: waterW,
        height: waterH,
      });
      water.position.set((mapOffsetGx - 10) * TILE_W, (mapOffsetGy - 10) * TILE_H);
      tileLayer.addChild(water);

      // Grass tiles with autotile
      const GRASS_TINTS = [0x7ca054, 0x6e9048, 0x5e8040, 0x78985a, 0x688848, 0x5a7a3e];
      const hashTint = (gx: number, gy: number) => {
        let h = (gx * 374761393 + gy * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        return GRASS_TINTS[((h ^ (h >>> 16)) >>> 0) % GRASS_TINTS.length];
      };

      // Collect land cells for spawn positioning
      const landCells: Array<{ gx: number; gy: number }> = [];
      const landEdgeCells: Array<{ gx: number; gy: number }> = [];

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] <= 0) continue;

          const gx = mapOffsetGx + rx;
          const gy = mapOffsetGy + ry;
          landCells.push({ gx, gy });

          // Is this an edge cell? (has a water neighbor)
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

      // Foam around coast
      const foamSheet = terrain.waterFoam;
      let foamCount = 0;
      for (let ry = 0; ry < MAP_ROWS && foamCount < 80; ry++) {
        for (let rx = 0; rx < MAP_COLS && foamCount < 80; rx++) {
          if (elevation[ry][rx] !== 0) continue;
          const hasGrass =
            (elevation[ry - 1]?.[rx] ?? 0) > 0 ||
            (elevation[ry + 1]?.[rx] ?? 0) > 0 ||
            (elevation[ry]?.[rx - 1] ?? 0) > 0 ||
            (elevation[ry]?.[rx + 1] ?? 0) > 0;
          if (!hasGrass) continue;
          const foam = new AnimatedSprite(foamSheet.frames);
          foam.animationSpeed = 0.10 + Math.random() * 0.04;
          foam.loop = true;
          foam.gotoAndPlay(Math.floor(Math.random() * foamSheet.frames.length));
          foam.anchor.set(0.5, 0.5);
          const gx = mapOffsetGx + rx;
          const gy = mapOffsetGy + ry;
          foam.position.set(gx * TILE_W + TILE_W * 0.5, gy * TILE_H + TILE_H * 0.5);
          foam.scale.set((TILE_W * 3.2) / foamSheet.frameW);
          foam.alpha = 0.22;
          tileLayer.addChild(foam);
          foamCount++;
        }
      }

      // ---- Buildings + trees/paths ----
      const buildings = cityState.buildings;
      const buildingSpriteMap = new Map<string, Sprite>();

      for (const b of buildings) {
        const fp = footprintOf(b.type);
        const centerGx = b.gx + (fp.w - 1) / 2;
        const centerGy = b.gy + (fp.h - 1) / 2;
        const cx = (b.gx + fp.w / 2) * TILE_W;
        const cy = (b.gy + fp.h / 2) * TILE_H;

        // Trees — use terrain tree sprites
        if (b.type === 'tree' && terrain.trees.length) {
          const sheet = terrain.trees[(b.gx + b.gy) % terrain.trees.length];
          const treeSprite = new Sprite(sheet.frames[0]);
          treeSprite.anchor.set(0.5, 0.95);
          const longSide = Math.max(sheet.frameW, sheet.frameH);
          treeSprite.scale.set((TILE_W * 1.2) / longSide);
          treeSprite.x = centerGx * TILE_W + TILE_W / 2;
          treeSprite.y = centerGy * TILE_H + TILE_H * 0.9;
          treeSprite.zIndex = Math.floor(treeSprite.y);
          buildingLayer.addChild(treeSprite);
          continue;
        }

        // Paths — simple brown rectangle
        if (b.type === 'path') {
          const pathRect = new Graphics();
          pathRect.rect(b.gx * TILE_W + 4, b.gy * TILE_H + 4, TILE_W - 8, TILE_H - 8);
          pathRect.fill({ color: 0x8B7355 });
          pathRect.zIndex = 0;
          buildingLayer.addChild(pathRect);
          continue;
        }

        // Regular buildings
        const slug = spriteForLevel(b.type, b.level);
        const tex = getTopdownTexture(atlas, slug);
        if (!tex) continue;

        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.95);
        sprite.x = cx;
        sprite.y = cy;

        const bdef = BUILDINGS[b.type];
        const baseScale = (bdef.spriteScale ?? 1) * 1.4;
        const span = Math.max(fp.w, fp.h) * TILE_W;
        sprite.width = span * baseScale;
        sprite.height = (tex.height / tex.width) * span * baseScale;
        sprite.zIndex = Math.floor(cy + TILE_H * 0.4);
        buildingLayer.addChild(sprite);
        buildingSpriteMap.set(b.id, sprite);
      }

      // ---- Camera: auto-fit island + zoom/pan ----
      // Compute island bounds in world pixels
      let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
      for (const { gx, gy } of landCells) {
        minPx = Math.min(minPx, gx * TILE_W);
        maxPx = Math.max(maxPx, (gx + 1) * TILE_W);
        minPy = Math.min(minPy, gy * TILE_H);
        maxPy = Math.max(maxPy, (gy + 1) * TILE_H);
      }
      const islandCx = (minPx + maxPx) / 2;
      const islandCy = (minPy + maxPy) / 2;
      const islandW = maxPx - minPx;
      const islandH = maxPy - minPy;
      const pad = TILE_W * 4; // padding around island
      const fitScale = Math.min(W / (islandW + pad * 2), H / (islandH + pad * 2));

      let zoom = fitScale;
      let camX = W / 2 - islandCx * zoom;
      let camY = H / 2 - islandCy * zoom;

      const applyCamera = () => {
        world.scale.set(zoom);
        world.x = camX;
        world.y = camY;
      };
      applyCamera();

      // Zoom with scroll wheel
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(fitScale * 0.5, Math.min(fitScale * 4, zoom * factor));
        // Zoom toward mouse position
        const mx = e.offsetX;
        const my = e.offsetY;
        camX = mx - (mx - camX) * (newZoom / zoom);
        camY = my - (my - camY) * (newZoom / zoom);
        zoom = newZoom;
        applyCamera();
      };
      app.canvas.addEventListener('wheel', onWheel, { passive: false });

      // Touch pinch zoom
      let lastPinchDist = 0;
      let lastPinchCx = 0;
      let lastPinchCy = 0;
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cx = (t0.clientX + t1.clientX) / 2;
          const cy = (t0.clientY + t1.clientY) / 2;

          if (lastPinchDist > 0) {
            const factor = dist / lastPinchDist;
            const newZoom = Math.max(fitScale * 0.5, Math.min(fitScale * 4, zoom * factor));
            const rect = app.canvas.getBoundingClientRect();
            const mx = cx - rect.left;
            const my = cy - rect.top;
            camX = mx - (mx - camX) * (newZoom / zoom);
            camY = my - (my - camY) * (newZoom / zoom);
            // Also pan
            camX += (cx - lastPinchCx);
            camY += (cy - lastPinchCy);
            zoom = newZoom;
            applyCamera();
          }
          lastPinchDist = dist;
          lastPinchCx = cx;
          lastPinchCy = cy;
        }
      };
      const onTouchEnd = () => { lastPinchDist = 0; };
      app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      app.canvas.addEventListener('touchend', onTouchEnd);

      // Single-finger pan
      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragCamX = 0;
      let dragCamY = 0;
      const onPointerDown = (e: PointerEvent) => {
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragCamX = camX;
        dragCamY = camY;
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        camX = dragCamX + (e.clientX - dragStartX);
        camY = dragCamY + (e.clientY - dragStartY);
        applyCamera();
      };
      const onPointerUp = () => { dragging = false; };
      app.canvas.addEventListener('pointerdown', onPointerDown);
      app.canvas.addEventListener('pointermove', onPointerMove);
      app.canvas.addEventListener('pointerup', onPointerUp);

      // ---- Init battle ----
      // Island bbox in grid coords for spawn positioning
      const islandBbox = {
        minGx: mapOffsetGx,
        maxGx: mapOffsetGx + MAP_COLS,
        minGy: mapOffsetGy,
        maxGy: mapOffsetGy + MAP_ROWS,
      };
      const battle = createBattle(camp, buildings, won, 0, 0);
      battle.landEdgeCells = landEdgeCells;

      // ---- Sprite pools ----
      const enemySpriteMap = new Map<number, AnimatedSprite>();
      const archerSpriteMap = new Map<number, AnimatedSprite>();
      const arrowSpriteMap = new Map<number, Sprite>();
      const fxSpriteMap = new Map<number, AnimatedSprite>();
      const hpBarMap = new Map<string, Graphics>();

      // Get enemy frames for this camp
      const enemyUnit = combat.enemies[camp.id];
      if (!enemyUnit) {
        console.error('No enemy sprites for camp', camp.id);
        return;
      }

      // ---- Result text ----
      const resultText = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: '"Lilita One", sans-serif',
          fontSize: 48,
          fill: won ? 0xfdd069 : 0xc75b3d,
          stroke: { color: 0x0d0a06, width: 8 },
          dropShadow: {
            color: 0x000000,
            blur: 12,
            distance: 4,
            angle: Math.PI / 4,
            alpha: 0.7,
          },
        }),
      });
      resultText.anchor.set(0.5);
      resultText.x = W / 2;
      resultText.y = H * 0.12;
      resultText.alpha = 0;
      uiLayer.addChild(resultText);

      // ---- Main ticker ----
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;

        tickBattle(battle, dt, buildings, 0, 0, islandBbox, camp);

        // ---- Sync enemies ----
        for (const enemy of battle.enemies) {
          let sprite = enemySpriteMap.get(enemy.id);
          if (!sprite) {
            const frames = enemy.state === 'walk' ? enemyUnit.run :
                          enemy.state === 'attack' ? enemyUnit.attack :
                          enemyUnit.idle;
            sprite = new AnimatedSprite(frames);
            sprite.anchor.set(0.5, 0.8);
            sprite.animationSpeed = 0.15;
            sprite.play();
            battleLayer.addChild(sprite);
            enemySpriteMap.set(enemy.id, sprite);
          }

          if (enemy.state === 'dead') {
            sprite.alpha = Math.max(0, sprite.alpha - dt * 3);
            if (sprite.alpha <= 0) {
              battleLayer.removeChild(sprite);
              enemySpriteMap.delete(enemy.id);
            }
          } else {
            sprite.x = enemy.x;
            sprite.y = enemy.y;
            sprite.zIndex = Math.floor(enemy.y);
            // Scale based on frame height: 192px units → ~1.5 tiles, 320px → ~1.2 tiles
            const unitScale = TILE_W / enemyUnit.frameH * 1.8;
            sprite.scale.set(enemy.facingLeft ? -unitScale : unitScale, unitScale);

            const wantFrames = enemy.state === 'walk' ? enemyUnit.run :
                              enemy.state === 'attack' ? enemyUnit.attack :
                              enemyUnit.idle;
            if (sprite.textures !== wantFrames) {
              sprite.textures = wantFrames;
              sprite.play();
            }
          }
        }

        // ---- Sync archers ----
        for (const archer of battle.archers) {
          let sprite = archerSpriteMap.get(archer.id);
          if (!sprite) {
            sprite = new AnimatedSprite(combat.archer.idle);
            sprite.anchor.set(0.5, 0.8);
            sprite.animationSpeed = 0.18;
            sprite.play();
            battleLayer.addChild(sprite);
            archerSpriteMap.set(archer.id, sprite);
          }
          sprite.x = archer.x;
          sprite.y = archer.y;
          sprite.zIndex = Math.floor(archer.y);
          const unitScale = TILE_W / 192 * 1.6;
          sprite.scale.set(unitScale);

          const wantFrames = archer.state === 'shoot' ? combat.archer.shoot : combat.archer.idle;
          if (sprite.textures !== wantFrames) {
            sprite.textures = wantFrames;
            sprite.play();
          }
        }

        // ---- Sync defenders (blue warriors/lancers) ----
        const defenderSpriteMap = (app as any)._defSpriteMap ??= new Map<number, AnimatedSprite>();
        for (const def of battle.defenders) {
          let sprite = defenderSpriteMap.get(def.id);
          const unitFrames = def.unitType === 'lancer' ? combat.blueLancer : combat.blueWarrior;
          if (!sprite) {
            sprite = new AnimatedSprite(unitFrames.idle);
            sprite.anchor.set(0.5, 0.8);
            sprite.animationSpeed = 0.15;
            sprite.play();
            battleLayer.addChild(sprite);
            defenderSpriteMap.set(def.id, sprite);
          }
          if (def.state === 'dead') {
            sprite.alpha = Math.max(0, sprite.alpha - dt * 3);
            if (sprite.alpha <= 0) {
              battleLayer.removeChild(sprite);
              defenderSpriteMap.delete(def.id);
            }
          } else {
            sprite.x = def.x;
            sprite.y = def.y;
            sprite.zIndex = Math.floor(def.y);
            const unitScale = TILE_W / unitFrames.frameH * 1.8;
            sprite.scale.set(def.facingLeft ? -unitScale : unitScale, unitScale);
            const wantFrames = def.state === 'walk' ? unitFrames.run :
                              def.state === 'attack' ? unitFrames.attack :
                              unitFrames.idle;
            if (sprite.textures !== wantFrames) {
              sprite.textures = wantFrames;
              sprite.play();
            }
          }
        }

        // ---- Sync arrows ----
        for (const arrow of battle.arrows) {
          let sprite = arrowSpriteMap.get(arrow.id);
          if (!sprite) {
            sprite = new Sprite(combat.arrow);
            sprite.anchor.set(0.5);
            sprite.scale.set(TILE_W / 64 * 0.7);
            battleLayer.addChild(sprite);
            arrowSpriteMap.set(arrow.id, sprite);
          }
          sprite.x = arrow.x;
          sprite.y = arrow.y;
          sprite.rotation = arrow.angle;
          sprite.zIndex = 99999;
        }
        for (const [id] of arrowSpriteMap) {
          if (!battle.arrows.find(a => a.id === id)) {
            const s = arrowSpriteMap.get(id)!;
            battleLayer.removeChild(s);
            arrowSpriteMap.delete(id);
          }
        }

        // ---- Sync FX ----
        for (const fx of battle.fx) {
          if (fx.done) {
            const s = fxSpriteMap.get(fx.id);
            if (s) { fxLayer.removeChild(s); fxSpriteMap.delete(fx.id); }
            continue;
          }
          let sprite = fxSpriteMap.get(fx.id);
          if (!sprite) {
            const frames = fx.type === 'explosion' ? combat.fx.explosion : combat.fx.fireSmall;
            sprite = new AnimatedSprite(frames);
            sprite.anchor.set(0.5);
            const fxScale = fx.type === 'explosion' ? TILE_W / 192 * 2 : TILE_W / 64 * 1.2;
            sprite.scale.set(fxScale);
            sprite.animationSpeed = fx.type === 'explosion' ? 0.3 : 0.2;
            sprite.loop = false;
            sprite.play();
            fxLayer.addChild(sprite);
            fxSpriteMap.set(fx.id, sprite);
          }
          sprite.x = fx.x;
          sprite.y = fx.y;
        }

        // ---- Building damage ----
        for (const [buildingId, bhp] of battle.buildingHp) {
          const bSprite = buildingSpriteMap.get(buildingId);
          if (!bSprite) continue;

          if (bhp.destroyed) {
            bSprite.alpha = 0.25;
            bSprite.tint = 0x333333;
          } else if (bhp.hp < bhp.maxHp) {
            const ratio = bhp.hp / bhp.maxHp;
            bSprite.tint = ratio > 0.5 ? 0xffffff : ratio > 0.25 ? 0xff9999 : 0xff4444;

            let bar = hpBarMap.get(buildingId);
            if (!bar) {
              bar = new Graphics();
              battleLayer.addChild(bar);
              hpBarMap.set(buildingId, bar);
            }
            bar.clear();
            const barW = 50;
            const barH = 6;
            const bx = bSprite.x - barW / 2;
            const by = bSprite.y - bSprite.height * 0.7;
            bar.rect(bx, by, barW, barH).fill({ color: 0x000000, alpha: 0.6 });
            bar.rect(bx + 1, by + 1, (barW - 2) * ratio, barH - 2)
              .fill({ color: ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336 });
            bar.zIndex = 999999;
          }
        }

        // ---- Camera shake ----
        if (battle.phase === 'fight' && battle.enemies.some(e => e.state === 'attack')) {
          world.x = camX + (Math.random() - 0.5) * 3;
          world.y = camY + (Math.random() - 0.5) * 2;
        } else {
          world.x = camX;
          world.y = camY;
        }

        // ---- Result text ----
        if (battle.phase === 'resolve') {
          resultText.text = won ? 'OVERWINNING!' : 'VERSLAGEN!';
          resultText.alpha = Math.min(resultText.alpha + dt * 2, 1);
          resultText.scale.set(Math.min(resultText.scale.x + dt * 2, 1.2));
        }

        // ---- Done ----
        if (isBattleDone(battle) && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => onCompleteRef.current(), 800);
        }
      });
    })();

    return () => {
      cancelled = true;
      try { app.destroy(true, { children: true, texture: false }); } catch { /* */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
}
