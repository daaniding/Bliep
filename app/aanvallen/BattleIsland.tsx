'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  AnimatedSprite,
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import { loadCombatSprites, type CombatSprites } from '@/lib/game/combatSprites';
import {
  createBattle,
  tickBattle,
  isBattleDone,
  type BattleState,
  type BattleEnemy,
  type BattleArcher,
  type BattleArrow,
  type BattleFx,
} from '@/lib/game/battleEngine';
import { loadTopdownAtlas, getTopdownTexture } from '@/lib/game/topdown';
import { spriteForLevel, footprintOf, BUILDINGS } from '@/lib/game/buildings';
import { TILE_W, TILE_H, CITY_CENTER } from '@/lib/game/iso';
import { parseElevation, MAP_COLS, MAP_ROWS } from '@/lib/game/staticMap';
import type { PveCamp } from '@/lib/pveCamps';
import type { CityState, PlacedBuilding } from '@/lib/cityStore';

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
      const H = host.clientHeight || 500;

      await app.init({
        width: W,
        height: H,
        backgroundAlpha: 1,
        background: 0x4a9bb8, // water blue
        antialias: false,
        roundPixels: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }
      host.appendChild(app.canvas);

      // Load assets
      const [atlas, combat] = await Promise.all([
        loadTopdownAtlas(),
        loadCombatSprites(),
      ]);
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }

      // ---- Scene ----
      const world = new Container();
      app.stage.addChild(world);

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

      // ---- Position the island ----
      // Calculate the bounding box of placed buildings to center the view
      const buildings = cityState.buildings;
      let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
      for (const b of buildings) {
        const fp = footprintOf(b.type);
        minGx = Math.min(minGx, b.gx);
        maxGx = Math.max(maxGx, b.gx + fp.w);
        minGy = Math.min(minGy, b.gy);
        maxGy = Math.max(maxGy, b.gy + fp.h);
      }
      // Fallback if no buildings
      if (!isFinite(minGx)) {
        minGx = CITY_CENTER.gx - 5;
        maxGx = CITY_CENTER.gx + 5;
        minGy = CITY_CENTER.gy - 5;
        maxGy = CITY_CENTER.gy + 5;
      }

      // Add padding
      const pad = 6;
      minGx -= pad;
      maxGx += pad;
      minGy -= pad;
      maxGy += pad;

      const islandW = (maxGx - minGx) * TILE_W;
      const islandH = (maxGy - minGy) * TILE_H;
      const scale = Math.min(W / islandW, H / islandH) * 0.9;
      world.scale.set(scale);
      world.x = W / 2 - (minGx + (maxGx - minGx) / 2) * TILE_W * scale;
      world.y = H / 2 - (minGy + (maxGy - minGy) / 2) * TILE_H * scale;

      const originX = 0;
      const originY = 0;

      // ---- Draw grass under buildings ----
      const ground = new Graphics();
      // Draw a simple green area for the island
      const elevation = parseElevation();
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);
      const GRASS_TINTS = [0x7ca054, 0x6e9048, 0x82a85c, 0x74984f, 0x88ae62];

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] > 0) {
            const gx = mapOffsetGx + rx;
            const gy = mapOffsetGy + ry;
            const tint = GRASS_TINTS[(gx * 7 + gy * 13) % GRASS_TINTS.length];
            ground.rect(gx * TILE_W, gy * TILE_H, TILE_W, TILE_H);
            ground.fill({ color: tint });
          }
        }
      }
      world.addChildAt(ground, 0);

      // ---- Render buildings ----
      const buildingSpriteMap = new Map<string, Sprite>();
      for (const b of buildings) {
        const slug = spriteForLevel(b.type, b.level);
        const tex = getTopdownTexture(atlas, slug);
        if (!tex) continue;

        const fp = footprintOf(b.type);
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.95);
        const cx = originX + (b.gx + fp.w / 2) * TILE_W;
        const cy = originY + (b.gy + fp.h / 2) * TILE_H;
        sprite.x = cx;
        sprite.y = cy;

        const def = BUILDINGS[b.type];
        const baseScale = (def.spriteScale ?? 1) * 1.4;
        const span = Math.max(fp.w, fp.h) * TILE_W;
        sprite.width = span * baseScale;
        sprite.height = (tex.height / tex.width) * span * baseScale;
        sprite.zIndex = Math.floor(cy + TILE_H * 0.4);

        buildingLayer.addChild(sprite);
        buildingSpriteMap.set(b.id, sprite);
      }

      // ---- Init battle ----
      const islandBbox = { minGx, maxGx, minGy, maxGy };
      const battle = createBattle(camp, buildings, won, originX, originY);

      // ---- Sprite pools for battle entities ----
      const enemySpriteMap = new Map<number, AnimatedSprite>();
      const archerSpriteMap = new Map<number, AnimatedSprite>();
      const arrowSpriteMap = new Map<number, Sprite>();
      const fxSpriteMap = new Map<number, AnimatedSprite>();
      const hpBarMap = new Map<string, Graphics>();

      // ---- Result text ----
      const resultText = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: '"Lilita One", sans-serif',
          fontSize: 42,
          fill: won ? 0xfdd069 : 0xc75b3d,
          stroke: { color: 0x0d0a06, width: 6 },
          dropShadow: {
            color: 0x000000,
            blur: 8,
            distance: 4,
            angle: Math.PI / 4,
            alpha: 0.6,
          },
        }),
      });
      resultText.anchor.set(0.5);
      resultText.x = W / 2;
      resultText.y = H * 0.15;
      resultText.alpha = 0;
      uiLayer.addChild(resultText);

      // ---- Main ticker ----
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60;

        tickBattle(battle, dt, buildings, originX, originY, islandBbox, camp);

        // ---- Sync enemy sprites ----
        for (const enemy of battle.enemies) {
          let sprite = enemySpriteMap.get(enemy.id);
          if (!sprite) {
            const frames = enemy.state === 'walk' ? combat.enemy.run :
                          enemy.state === 'attack' ? combat.enemy.attack :
                          combat.enemy.idle;
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
            // Scale to ~1 tile size
            const unitScale = TILE_W / 192 * 2.2;
            sprite.scale.set(enemy.facingLeft ? -unitScale : unitScale, unitScale);

            // Switch textures based on state
            const wantFrames = enemy.state === 'walk' ? combat.enemy.run :
                              enemy.state === 'attack' ? combat.enemy.attack :
                              combat.enemy.idle;
            if (sprite.textures !== wantFrames) {
              sprite.textures = wantFrames;
              sprite.play();
            }
          }
        }

        // ---- Sync archer sprites ----
        for (const archer of battle.archers) {
          let sprite = archerSpriteMap.get(archer.id);
          if (!sprite) {
            const frames = archer.state === 'shoot' ? combat.archer.shoot : combat.archer.idle;
            sprite = new AnimatedSprite(frames);
            sprite.anchor.set(0.5, 0.8);
            sprite.animationSpeed = 0.18;
            sprite.play();
            battleLayer.addChild(sprite);
            archerSpriteMap.set(archer.id, sprite);
          }

          sprite.x = archer.x;
          sprite.y = archer.y;
          sprite.zIndex = Math.floor(archer.y);
          const unitScale = TILE_W / 192 * 2.0;
          sprite.scale.set(unitScale);

          const wantFrames = archer.state === 'shoot' ? combat.archer.shoot : combat.archer.idle;
          if (sprite.textures !== wantFrames) {
            sprite.textures = wantFrames;
            sprite.play();
          }
        }

        // ---- Sync arrows ----
        for (const arrow of battle.arrows) {
          let sprite = arrowSpriteMap.get(arrow.id);
          if (!sprite) {
            sprite = new Sprite(combat.arrow);
            sprite.anchor.set(0.5);
            const arrowScale = TILE_W / 64 * 0.8;
            sprite.scale.set(arrowScale);
            battleLayer.addChild(sprite);
            arrowSpriteMap.set(arrow.id, sprite);
          }
          sprite.x = arrow.x;
          sprite.y = arrow.y;
          sprite.rotation = arrow.angle;
          sprite.zIndex = 99999; // arrows always on top
        }
        // Clean up removed arrows
        for (const [id, sprite] of arrowSpriteMap) {
          if (!battle.arrows.find(a => a.id === id)) {
            battleLayer.removeChild(sprite);
            arrowSpriteMap.delete(id);
          }
        }

        // ---- Sync FX ----
        for (const fx of battle.fx) {
          if (fx.done) {
            const sprite = fxSpriteMap.get(fx.id);
            if (sprite) {
              fxLayer.removeChild(sprite);
              fxSpriteMap.delete(fx.id);
            }
            continue;
          }

          let sprite = fxSpriteMap.get(fx.id);
          if (!sprite) {
            const frames = fx.type === 'explosion' ? combat.fx.explosion : combat.fx.fireSmall;
            sprite = new AnimatedSprite(frames);
            sprite.anchor.set(0.5);
            const fxScale = fx.type === 'explosion' ? TILE_W / 192 * 2.5 : TILE_W / 64 * 1.5;
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

        // ---- Building HP bars + damage tint ----
        for (const [buildingId, bhp] of battle.buildingHp) {
          const bSprite = buildingSpriteMap.get(buildingId);
          if (!bSprite) continue;

          if (bhp.destroyed) {
            bSprite.alpha = 0.3;
            bSprite.tint = 0x333333;
          } else if (bhp.hp < bhp.maxHp) {
            // Flash red when damaged
            const dmgRatio = bhp.hp / bhp.maxHp;
            bSprite.tint = dmgRatio > 0.5 ? 0xffffff :
                          dmgRatio > 0.25 ? 0xff9999 : 0xff4444;

            // HP bar
            let bar = hpBarMap.get(buildingId);
            if (!bar) {
              bar = new Graphics();
              battleLayer.addChild(bar);
              hpBarMap.set(buildingId, bar);
            }
            bar.clear();
            const barW = 50;
            const barH = 6;
            const barX = bSprite.x - barW / 2;
            const barY = bSprite.y - bSprite.height * 0.7;
            // Background
            bar.rect(barX, barY, barW, barH);
            bar.fill({ color: 0x000000, alpha: 0.6 });
            // Health
            bar.rect(barX + 1, barY + 1, (barW - 2) * dmgRatio, barH - 2);
            bar.fill({ color: dmgRatio > 0.5 ? 0x4caf50 : dmgRatio > 0.25 ? 0xff9800 : 0xf44336 });
            bar.zIndex = 999999;
          }
        }

        // ---- Camera shake during fight ----
        if (battle.phase === 'fight') {
          const hasAttacking = battle.enemies.some(e => e.state === 'attack');
          if (hasAttacking) {
            world.x += (Math.random() - 0.5) * 2;
            world.y += (Math.random() - 0.5) * 1.5;
          }
        }

        // ---- Result text in resolve phase ----
        if (battle.phase === 'resolve') {
          resultText.text = won ? 'OVERWINNING!' : 'VERSLAGEN!';
          resultText.alpha = Math.min(resultText.alpha + dt * 2, 1);
          resultText.scale.set(Math.min(resultText.scale.x + dt * 2, 1.2));
        }

        // ---- Done ----
        if (isBattleDone(battle) && !doneRef.current) {
          doneRef.current = true;
          // Wait a beat then call onComplete
          setTimeout(() => {
            onCompleteRef.current();
          }, 800);
        }
      });
    })();

    return () => {
      cancelled = true;
      try { app.destroy(true, { children: true, texture: false }); } catch { /* ignore */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    />
  );
}
