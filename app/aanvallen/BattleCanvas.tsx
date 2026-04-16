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
} from 'pixi.js';
import { loadCombatSprites, type CombatSprites } from '@/lib/game/combatSprites';
import { loadMinifolks, type MinifolksAnimals } from '@/lib/game/minifolks';
import type { PveCamp, EnemySpriteKey } from '@/lib/pveCamps';

interface Props {
  camp: PveCamp;
  kazerneLvl: number;
  won: boolean;
  onComplete: () => void;
}

/** How many knight sprites to show based on barracks level. */
function knightCount(lvl: number): number {
  if (lvl <= 0) return 1;
  if (lvl <= 3) return 2 + Math.floor(lvl / 2);
  if (lvl <= 6) return 4;
  return 5 + Math.min(1, lvl - 7);
}

// Animation phases
const MARCH_DURATION = 0.8;
const CLASH_DURATION = 1.0;
const RESOLVE_DURATION = 0.8;
const DONE_PAUSE = 0.4;

export default function BattleCanvas({ camp, kazerneLvl, won, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();

    (async () => {
      const W = Math.min(host.clientWidth || 400, 480);
      const H = Math.min(host.clientHeight || 300, 320);

      await app.init({
        width: W,
        height: H,
        backgroundAlpha: 0,
        antialias: false,
        roundPixels: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }
      host.appendChild(app.canvas);

      // Load sprites
      const [combat, minifolks] = await Promise.all([
        loadCombatSprites(),
        loadMinifolks(),
      ]);
      if (cancelled) { app.destroy(true, { children: true, texture: false }); return; }

      // ---- Scene setup ----
      const scene = new Container();
      app.stage.addChild(scene);

      // Ground — simple grass strip
      const ground = new Graphics();
      ground.rect(0, H * 0.55, W, H * 0.45);
      ground.fill({ color: 0x5a8a3c });
      ground.rect(0, H * 0.55, W, 4);
      ground.fill({ color: 0x4a7a2c });
      scene.addChild(ground);

      // Sky gradient
      const sky = new Graphics();
      sky.rect(0, 0, W, H * 0.55);
      sky.fill({ color: 0x87CEEB });
      scene.addChild(sky);
      scene.setChildIndex(sky, 0);

      // ---- Create knight sprites ----
      const knightGroup = new Container();
      scene.addChild(knightGroup);
      const nKnights = knightCount(kazerneLvl);
      const knightSprites: AnimatedSprite[] = [];

      for (let i = 0; i < nKnights; i++) {
        const sprite = new AnimatedSprite(combat.knight.run);
        sprite.animationSpeed = 0.18;
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(2.5);
        // Stagger vertically for army feel
        const baseY = H * 0.78 + (i % 3) * 16 - 8;
        const baseX = -100 - i * 30;
        sprite.x = baseX;
        sprite.y = baseY;
        sprite.play();
        knightGroup.addChild(sprite);
        knightSprites.push(sprite);
      }

      // ---- Create enemy sprites ----
      const enemyGroup = new Container();
      scene.addChild(enemyGroup);
      const enemySprites: AnimatedSprite[] = [];

      const enemyFrames = getEnemyFrames(camp.spriteKey, combat, minifolks);
      const enemyScale = (camp.spriteScale ?? 1) * getBaseScale(camp.spriteKey);

      for (let i = 0; i < camp.spriteCount; i++) {
        const sprite = new AnimatedSprite(enemyFrames);
        sprite.animationSpeed = 0.12;
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(-enemyScale, enemyScale); // flip horizontally
        const baseY = H * 0.78 + (i % 3) * 14 - 6;
        const baseX = W + 80 + i * 28;
        sprite.x = baseX;
        sprite.y = baseY;
        sprite.play();
        enemyGroup.addChild(sprite);
        enemySprites.push(sprite);
      }

      // ---- Particles container ----
      const particles = new Container();
      scene.addChild(particles);

      // ---- Result text (hidden initially) ----
      const resultText = new Text({
        text: won ? 'OVERWINNING!' : 'VERSLAGEN!',
        style: new TextStyle({
          fontFamily: '"Lilita One", sans-serif',
          fontSize: 36,
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
      resultText.y = H * 0.3;
      resultText.alpha = 0;
      resultText.scale.set(0);
      scene.addChild(resultText);

      // ---- Animation state machine ----
      let elapsed = 0;
      type Phase = 'march' | 'clash' | 'resolve' | 'done';
      let phase: Phase = 'march';

      // Target positions
      const knightTargetX = W * 0.35;
      const enemyTargetX = W * 0.65;

      // Store initial positions for lerp
      const knightStartX = knightSprites.map(s => s.x);
      const enemyStartX = enemySprites.map(s => s.x);

      function spawnParticles() {
        const cx = W * 0.5;
        const cy = H * 0.7;
        for (let i = 0; i < 12; i++) {
          const p = new Graphics();
          const size = 3 + Math.random() * 5;
          p.circle(0, 0, size);
          p.fill({ color: [0xffffff, 0xfdd069, 0xff6b35][Math.floor(Math.random() * 3)] });
          p.x = cx + (Math.random() - 0.5) * 40;
          p.y = cy + (Math.random() - 0.5) * 30;
          p.alpha = 1;
          particles.addChild(p);
          // Store velocity on the graphics object
          (p as any)._vx = (Math.random() - 0.5) * 8;
          (p as any)._vy = -Math.random() * 6 - 2;
        }
      }

      let shakeTime = 0;
      let clashTriggered = false;

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // seconds
        elapsed += dt;

        // Animate particles
        for (let i = particles.children.length - 1; i >= 0; i--) {
          const p = particles.children[i] as Graphics;
          p.x += (p as any)._vx * dt * 60;
          p.y += (p as any)._vy * dt * 60;
          (p as any)._vy += 12 * dt; // gravity
          p.alpha -= dt * 1.5;
          if (p.alpha <= 0) particles.removeChild(p);
        }

        // Screen shake
        if (shakeTime > 0) {
          shakeTime -= dt;
          scene.x = (Math.random() - 0.5) * 8;
          scene.y = (Math.random() - 0.5) * 6;
        } else {
          scene.x = 0;
          scene.y = 0;
        }

        if (phase === 'march') {
          const t = Math.min(elapsed / MARCH_DURATION, 1);
          const ease = 1 - Math.pow(1 - t, 3); // ease out cubic
          for (let i = 0; i < knightSprites.length; i++) {
            knightSprites[i].x = knightStartX[i] + (knightTargetX - i * 30 - knightStartX[i]) * ease;
          }
          for (let i = 0; i < enemySprites.length; i++) {
            enemySprites[i].x = enemyStartX[i] + (enemyTargetX + i * 24 - enemyStartX[i]) * ease;
          }
          if (t >= 1) {
            phase = 'clash';
            elapsed = 0;
            // Switch knights to attack animation
            for (const k of knightSprites) {
              k.textures = combat.knight.attack;
              k.animationSpeed = 0.22;
              k.play();
            }
          }
        } else if (phase === 'clash') {
          const t = Math.min(elapsed / CLASH_DURATION, 1);

          // Trigger particles and shake at the start
          if (!clashTriggered) {
            clashTriggered = true;
            spawnParticles();
            shakeTime = 0.3;
          }

          // Spawn more particles partway through
          if (t > 0.4 && t < 0.45) {
            spawnParticles();
            shakeTime = 0.2;
          }

          if (t >= 1) {
            phase = 'resolve';
            elapsed = 0;
            // Switch knights to idle
            for (const k of knightSprites) {
              k.textures = combat.knight.idle;
              k.animationSpeed = 0.12;
              k.play();
            }
          }
        } else if (phase === 'resolve') {
          const t = Math.min(elapsed / RESOLVE_DURATION, 1);
          const ease = t * t; // ease in

          if (won) {
            // Enemies fade out and shrink
            for (const e of enemySprites) {
              e.alpha = 1 - ease;
              const baseScale = (camp.spriteScale ?? 1) * getBaseScale(camp.spriteKey);
              e.scale.set(-baseScale * (1 - ease * 0.5), baseScale * (1 - ease * 0.5));
            }
          } else {
            // Knights fade out and shrink
            for (const k of knightSprites) {
              k.alpha = 1 - ease;
              k.scale.set(2.5 * (1 - ease * 0.5));
            }
          }

          // Show result text
          resultText.alpha = Math.min(t * 2, 1);
          const textScale = Math.min(t * 1.5, 1);
          resultText.scale.set(textScale);

          if (t >= 1) {
            phase = 'done';
            elapsed = 0;
          }
        } else if (phase === 'done') {
          if (elapsed >= DONE_PAUSE) {
            app.ticker.stop();
            onComplete();
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      app.destroy(true, { children: true, texture: false });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        maxWidth: 480,
        height: 300,
        margin: '0 auto',
        borderRadius: 16,
        overflow: 'hidden',
        border: '3px solid #1a0f05',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    />
  );
}

/** Get enemy animation frames based on sprite key. */
function getEnemyFrames(
  key: EnemySpriteKey,
  combat: CombatSprites,
  minifolks: MinifolksAnimals,
): Texture[] {
  switch (key) {
    case 'light-bandit': return combat.bandit.light;
    case 'heavy-bandit': return combat.bandit.heavy;
    case 'wolf': return minifolks.wolf.frames;
    case 'bear': return minifolks.bear.frames;
    case 'boar': return minifolks.boar.frames;
  }
}

/** Base scale for different sprite types (to normalize sizes). */
function getBaseScale(key: EnemySpriteKey): number {
  switch (key) {
    case 'light-bandit':
    case 'heavy-bandit':
      return 2.5;
    case 'wolf':
    case 'boar':
      return 3.5;
    case 'bear':
      return 3.5;
  }
}
