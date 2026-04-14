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
  Rectangle,
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
import {
  loadTopdownAtlas,
  getTopdownTexture,
  GROUND_GRASS_SLUGS,
  villagerFrame,
  VILLAGER_TYPES,
  VILLAGER_FRAME_SIZE,
  VILLAGER_WALK_FRAMES,
  type VillagerType,
  type TopdownAtlas,
} from '@/lib/game/topdown';
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
  showBuildZone?: boolean;
  placingType?: BuildingType | null;
  onTapTile?: (gx: number, gy: number) => void;
  onTapBuilding?: (b: PlacedBuilding) => void;
  onTapChest?: () => void;
  onCollectFarm?: (b: PlacedBuilding) => void;
  onReady?: () => void;
}

const MIN_ZOOM_INTERACTIVE = 0.35;
const MAX_ZOOM_INTERACTIVE = 2.4;
const TAP_THRESHOLD_PX = 6;
const COIN_BADGE_THRESHOLD = 1;

// 16px source tiles → render at 64px on screen = 4× scale
const GROUND_SCALE = TILE_W / 16;

interface NPC {
  buildingId: string;
  homeGx: number;
  homeGy: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  sprite: Sprite;
  facingRight: boolean;
  frameTime: number;
  frame: number;
  villagerSheet: Texture;
  villagerType: VillagerType;
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
  onReady,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const tileLayerRef = useRef<Container | null>(null);
  const decorLayerRef = useRef<Container | null>(null);
  const buildingLayerRef = useRef<Container | null>(null);
  const npcLayerRef = useRef<Container | null>(null);
  const overlayLayerRef = useRef<Container | null>(null);
  const ghostRef = useRef<Sprite | null>(null);
  const chestSpriteRef = useRef<Sprite | null>(null);
  const npcsRef = useRef<NPC[]>([]);
  const atlasRef = useRef<TopdownAtlas | null>(null);
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
        antialias: false,
        roundPixels: true,
        resolution: mode === 'preview' ? 1 : window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true, texture: false });
        return;
      }
      host.appendChild(app.canvas);

      const atlas = await loadTopdownAtlas();
      if (cancelled) return;
      atlasRef.current = atlas;

      // Forever-green stage background so the dark page bg never bleeds
      // through when the map doesn't fill the viewport edge to edge.
      const stageBg = new Graphics();
      const drawBg = () => {
        stageBg.clear();
        stageBg.rect(0, 0, app.renderer.width, app.renderer.height);
        stageBg.fill({ color: 0x6b9c52 });
      };
      drawBg();
      app.stage.addChild(stageBg);

      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      const tileLayer = new Container();
      world.addChild(tileLayer);
      tileLayerRef.current = tileLayer;

      const decorLayer = new Container();
      decorLayer.sortableChildren = true;
      world.addChild(decorLayer);
      decorLayerRef.current = decorLayer;

      // Single y-sorted entity layer for buildings + NPCs so they correctly
      // overlap based on screen Y (a villager walking south of a house should
      // appear in front, walking north should be hidden behind it).
      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      buildingLayerRef.current = buildingLayer;
      // NPCs share the same layer; we keep the ref for cleanup symmetry.
      npcLayerRef.current = buildingLayer;

      const overlayLayer = new Container();
      overlayLayer.sortableChildren = true;
      world.addChild(overlayLayer);
      overlayLayerRef.current = overlayLayer;

      const particleLayer = new Container();
      world.addChild(particleLayer);

      // Origin: world local (0,0) is top-left of grid
      originRef.current = { originX: 0, originY: 0 };

      // ---- Solid green ground base (autotile sprites have transparent bg) ----
      const baseGround = new Graphics();
      baseGround.rect(0, 0, GRID_SIZE * TILE_W, GRID_SIZE * TILE_H);
      baseGround.fill({ color: 0x86b96a });
      tileLayer.addChild(baseGround);

      // Ring of darker grass outside the build zone (decor strip)
      const outer = new Graphics();
      const r = 12;
      const innerLeft = (CITY_CENTER.gx - r) * TILE_W;
      const innerTop = (CITY_CENTER.gy - r) * TILE_H;
      const innerW = (r * 2 + 1) * TILE_W;
      const innerH = (r * 2 + 1) * TILE_H;
      // Top
      outer.rect(0, 0, GRID_SIZE * TILE_W, innerTop);
      // Bottom
      outer.rect(0, innerTop + innerH, GRID_SIZE * TILE_W, GRID_SIZE * TILE_H - (innerTop + innerH));
      // Left
      outer.rect(0, innerTop, innerLeft, innerH);
      // Right
      outer.rect(innerLeft + innerW, innerTop, GRID_SIZE * TILE_W - (innerLeft + innerW), innerH);
      outer.fill({ color: 0x6b9c52 });
      tileLayer.addChild(outer);

      // ---- Ground decoration tiles (grass tufts on top) ----
      // Sprinkle grass tuft sprites for variety (every ~3rd tile, not all)
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          if (tileVariant(gx, gy, 3) !== 0) continue; // only ~33% of tiles
          const slug = GROUND_GRASS_SLUGS[tileVariant(gx + 1, gy + 7, GROUND_GRASS_SLUGS.length)];
          const tex = getTopdownTexture(atlas, slug);
          if (!tex || tex === Texture.EMPTY) continue;
          const sprite = new Sprite(tex);
          sprite.anchor.set(0);
          sprite.scale.set(GROUND_SCALE);
          sprite.position.set(gx * TILE_W, gy * TILE_H);
          sprite.alpha = 0.8;
          tileLayer.addChild(sprite);
        }
      }
      // Road overlay tiles
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          if (!isRoadTile(gx, gy)) continue;
          const road = new Graphics();
          road.rect(gx * TILE_W, gy * TILE_H, TILE_W, TILE_H);
          road.fill({ color: 0xc8a878 });
          tileLayer.addChild(road);
        }
      }

      // ---- Build zone ring ----
      if (showBuildZone) {
        const ring = new Graphics();
        const r = 12;
        const left = (CITY_CENTER.gx - r) * TILE_W;
        const top = (CITY_CENTER.gy - r) * TILE_H;
        const w = (r * 2 + 1) * TILE_W;
        const h = (r * 2 + 1) * TILE_H;
        ring.rect(left, top, w, h);
        ring.stroke({ color: 0xfdd069, width: 4, alpha: 0.55 });
        tileLayer.addChild(ring);
      }

      // ---- Decor ----
      const decor: DecorTile[] = seedDecor(state.npcSeed || 1);
      for (const d of decor) {
        const tex = getTopdownTexture(atlas, d.slug);
        if (!tex || tex === Texture.EMPTY) continue;
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.95);
        const { sx, sy } = gridToScreen(d.gx, d.gy, 0, 0);
        s.position.set(sx, sy + TILE_H * 0.4);
        // Source sprites range from ~16px (rocks) to ~80px (oak tree). Scale so
        // they all fit roughly inside one tile, with mountains slightly larger.
        const baseScale = (TILE_W * 0.85) / Math.max(tex.width, tex.height);
        s.scale.set(baseScale * d.scale);
        s.zIndex = d.gy * 1000 + d.gx;
        decorLayer.addChild(s);
      }

      // ---- Daily chest ----
      const chestTex = getTopdownTexture(atlas, 'chest');
      if (chestTex && chestTex !== Texture.EMPTY) {
        const chest = new Sprite(chestTex);
        chest.anchor.set(0.5, 0.95);
        const { sx, sy } = gridToScreen(CITY_CENTER.gx, CITY_CENTER.gy, 0, 0);
        chest.position.set(sx, sy + TILE_H * 0.4);
        const baseScale = (TILE_W * 1.4) / Math.max(chestTex.width, chestTex.height);
        chest.scale.set(baseScale);
        chest.zIndex = CITY_CENTER.gy * 1000 + CITY_CENTER.gx + 100;
        chest.eventMode = mode === 'interactive' ? 'static' : 'none';
        chest.cursor = 'pointer';
        chest.on('pointertap', (e: FederatedPointerEvent) => {
          e.stopPropagation();
          callbacksRef.current.onTapChest?.();
        });
        overlayLayer.addChild(chest);
        chestSpriteRef.current = chest;
      }

      // ---- Centering and zoom ----
      const centerWorld = () => {
        const { originX, originY } = centerOrigin(app.renderer.width, app.renderer.height);
        world.position.set(originX, originY);
      };
      centerWorld();
      // Minimum zoom = "fit whole map in view" (no off-map background visible)
      const minZoomFit = Math.max(
        app.renderer.width / (GRID_SIZE * TILE_W),
        app.renderer.height / (GRID_SIZE * TILE_H),
      );
      // Default interactive view: ~12 tiles wide so buildings are big and
      // recognizable. User can pinch-out to see more.
      const defaultZoom = Math.min(
        app.renderer.width / (12 * TILE_W),
        app.renderer.height / (12 * TILE_H),
      );
      // Preview view: ~14 tiles wide centered on city center so buildings + nearby decor read at a glance
      const previewZoom = Math.min(
        app.renderer.width / (14 * TILE_W),
        app.renderer.height / (14 * TILE_H),
      );
      const minZoom = Math.max(minZoomFit, MIN_ZOOM_INTERACTIVE);
      const startZoom = mode === 'preview' ? Math.max(previewZoom, minZoomFit) : Math.max(defaultZoom, minZoom);
      world.scale.set(startZoom);
      // Center on city center (where build zone is)
      const ccx = CITY_CENTER.gx * TILE_W + TILE_W / 2;
      const ccy = CITY_CENTER.gy * TILE_H + TILE_H / 2;
      world.position.set(
        app.renderer.width / 2 - ccx * startZoom,
        app.renderer.height / 2 - ccy * startZoom,
      );
      // Stash min zoom for later input handlers
      (app as Application & { __minZoom?: number }).__minZoom = minZoom;

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      // ---- Particles + shake (window event driven) ----
      type Particle = { g: Graphics; vx: number; vy: number; life: number; maxLife: number; gravity: number };
      const particles: Particle[] = [];

      const onBurstEvent = (e: Event) => {
        const detail = (e as CustomEvent).detail as { gx: number; gy: number; kind: 'coin' | 'sparkle' | 'smoke' } | undefined;
        if (!detail) return;
        const { sx, sy } = gridToScreen(detail.gx, detail.gy, 0, 0);
        const count = detail.kind === 'sparkle' ? 18 : detail.kind === 'smoke' ? 10 : 14;
        for (let i = 0; i < count; i++) {
          const g = new Graphics();
          if (detail.kind === 'coin') {
            g.circle(0, 0, 4).fill({ color: 0xfdd069 }).stroke({ color: 0x3a2a18, width: 1 });
          } else if (detail.kind === 'sparkle') {
            g.star(0, 0, 5, 5, 2).fill({ color: 0xfff8c0 });
          } else {
            g.circle(0, 0, 6).fill({ color: 0xcccccc, alpha: 0.7 });
          }
          g.position.set(sx, sy);
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
          const speed = 1.5 + Math.random() * 2.5;
          particleLayer.addChild(g);
          particles.push({
            g,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (detail.kind === 'coin' ? 3 : 1),
            life: 0,
            maxLife: detail.kind === 'smoke' ? 50 : 35,
            gravity: detail.kind === 'smoke' ? 0 : 0.2,
          });
        }
      };
      window.addEventListener('bliep:city-burst', onBurstEvent);

      let shakeMag = 0;
      const onShakeEvent = (e: Event) => {
        const d = (e as CustomEvent).detail as { intensity?: number } | undefined;
        shakeMag = Math.max(shakeMag, d?.intensity ?? 6);
      };
      window.addEventListener('bliep:city-shake', onShakeEvent);

      // ---- Input ----
      if (mode === 'interactive') {
        type Pointer = { id: number; lastX: number; lastY: number; moved: number };
        const pointers = new Map<number, Pointer>();
        let pinchStartDist = 0;
        let pinchStartScale = 1;
        let pinchMid = { x: 0, y: 0 };

        const globalToGrid = (gx: number, gy: number) => {
          const local = world.toLocal(new Point(gx, gy));
          return screenToGrid(local.x, local.y, 0, 0);
        };

        const clampWorld = () => {
          const mapW = GRID_SIZE * TILE_W * world.scale.x;
          const mapH = GRID_SIZE * TILE_H * world.scale.y;
          const viewW = app.renderer.width;
          const viewH = app.renderer.height;
          // If the map is smaller than the viewport on an axis, center it.
          // Otherwise clamp so the map edge stays at or beyond the view edge.
          if (mapW <= viewW) world.position.x = (viewW - mapW) / 2;
          else world.position.x = Math.min(0, Math.max(viewW - mapW, world.position.x));
          if (mapH <= viewH) world.position.y = (viewH - mapH) / 2;
          else world.position.y = Math.min(0, Math.max(viewH - mapH, world.position.y));
        };

        const zoomAround = (px: number, py: number, target: number) => {
          const beforeLocal = world.toLocal(new Point(px, py));
          world.scale.set(target);
          const afterGlobal = world.toGlobal(beforeLocal);
          world.position.x += px - afterGlobal.x;
          world.position.y += py - afterGlobal.y;
          clampWorld();
        };

        const onDown = (e: FederatedPointerEvent) => {
          pointers.set(e.pointerId, { id: e.pointerId, lastX: e.global.x, lastY: e.global.y, moved: 0 });
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
              clampWorld();
            } else if (pointers.size === 2) {
              const arr = Array.from(pointers.values());
              const ddx = arr[0].lastX - arr[1].lastX;
              const ddy = arr[0].lastY - arr[1].lastY;
              const dist = Math.hypot(ddx, ddy) || 1;
              const minZP = (app as Application & { __minZoom?: number }).__minZoom ?? MIN_ZOOM_INTERACTIVE;
              const target = Math.max(minZP, Math.min(MAX_ZOOM_INTERACTIVE, pinchStartScale * (dist / pinchStartDist)));
              zoomAround(pinchMid.x, pinchMid.y, target);
            }
          }
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
          const minZ = (app as Application & { __minZoom?: number }).__minZoom ?? MIN_ZOOM_INTERACTIVE;
          const target = Math.max(minZ, Math.min(MAX_ZOOM_INTERACTIVE, world.scale.x * factor));
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
          window.removeEventListener('bliep:city-burst', onBurstEvent);
          window.removeEventListener('bliep:city-shake', onShakeEvent);
        };
      } else {
        (app as Application & { __cleanup?: () => void }).__cleanup = () => {
          window.removeEventListener('bliep:city-burst', onBurstEvent);
          window.removeEventListener('bliep:city-shake', onShakeEvent);
        };
      }

      const ro = new ResizeObserver(() => {
        if (cancelled || !appRef.current) return;
        drawBg();
        if (mode === 'preview') centerWorld();
      });
      ro.observe(host);

      syncBuildings();
      onReady?.();

      const tickerFn = (ticker: { deltaTime: number }) => {
        // Villager walking + 6-frame walk cycle, horizontal flip for direction
        for (const n of npcsRef.current) {
          const dx = n.targetX - n.x;
          const dy = n.targetY - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 2) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 40 + Math.random() * 80;
            const homeScreenX = n.homeGx * TILE_W + TILE_W / 2;
            const homeScreenY = n.homeGy * TILE_H + TILE_H / 2 + TILE_H * 0.6;
            n.targetX = homeScreenX + Math.cos(angle) * radius;
            n.targetY = homeScreenY + Math.sin(angle) * radius;
          } else {
            const step = n.speed * ticker.deltaTime;
            n.x += (dx / dist) * step;
            n.y += (dy / dist) * step;
            // Horizontal facing only (sheet is side-view)
            if (Math.abs(dx) > 0.5) n.facingRight = dx > 0;
            // Animate frames every ~7 ticks
            n.frameTime += ticker.deltaTime;
            if (n.frameTime > 7) {
              n.frame = (n.frame + 1) % VILLAGER_WALK_FRAMES;
              n.frameTime = 0;
              const f = villagerFrame(n.frame);
              n.sprite.texture = new Texture({
                source: n.villagerSheet.source,
                frame: new Rectangle(f.x, f.y, f.w, f.h),
              });
            }
          }
          n.sprite.position.set(n.x, n.y);
          n.sprite.scale.x = (n.facingRight ? 1 : -1) * Math.abs(n.sprite.scale.x);
          n.sprite.zIndex = Math.floor(n.y);
        }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life += ticker.deltaTime;
          p.vy += p.gravity * ticker.deltaTime;
          p.g.position.x += p.vx * ticker.deltaTime;
          p.g.position.y += p.vy * ticker.deltaTime;
          p.g.alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life >= p.maxLife) {
            particleLayer.removeChild(p.g);
            p.g.destroy();
            particles.splice(i, 1);
          }
        }

        // Camera shake (stage offset)
        if (shakeMag > 0.1) {
          app.stage.position.set((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
          shakeMag *= 0.85;
        } else if (app.stage.position.x !== 0 || app.stage.position.y !== 0) {
          app.stage.position.set(0, 0);
        }

        // Chest pulse
        if (chestSpriteRef.current) {
          const ready = isChestReady(stateRef.current);
          const baseScale = chestSpriteRef.current.scale.x / (1 + Math.sin(Date.now() / 250) * 0.05) || 1;
          if (ready) {
            const pulse = baseScale * (1 + Math.sin(Date.now() / 250) * 0.05);
            chestSpriteRef.current.scale.set(pulse);
            chestSpriteRef.current.tint = 0xfff8c0;
          } else {
            chestSpriteRef.current.tint = 0x888888;
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
      tileLayerRef.current = null;
      decorLayerRef.current = null;
      buildingLayerRef.current = null;
      overlayLayerRef.current = null;
      npcLayerRef.current = null;
      ghostRef.current = null;
      chestSpriteRef.current = null;
      npcsRef.current = [];
      if (host) host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => { syncBuildings(); /* eslint-disable-line */ }, [state]);

  // Ghost sprite for placement
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
      const tex = getTopdownTexture(atlas, slug);
      if (tex && tex !== Texture.EMPTY) {
        const ghost = new Sprite(tex);
        ghost.anchor.set(0.5, 0.95);
        const baseScale = (TILE_W * 1.1 * (BUILDINGS[placingType].spriteScale ?? 1)) / Math.max(tex.width, tex.height);
        ghost.scale.set(baseScale);
        ghost.alpha = 0.6;
        ghost.tint = 0xc0ffc0;
        ghost.zIndex = 99999;
        layer.addChild(ghost);
        ghostRef.current = ghost;
      }
    }
  }, [placingType]);

  function updateGhost(gx: number, gy: number) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    if (!inBuildZone(gx, gy)) {
      ghost.alpha = 0.3;
      ghost.tint = 0xff7070;
    } else {
      const occupied = stateRef.current.buildings.some(b => b.gx === gx && b.gy === gy);
      ghost.alpha = occupied ? 0.3 : 0.6;
      ghost.tint = occupied ? 0xff7070 : 0xc0ffc0;
    }
    const { sx, sy } = gridToScreen(gx, gy, 0, 0);
    ghost.position.set(sx, sy + TILE_H * 0.4);
  }

  function syncBuildings() {
    const layer = buildingLayerRef.current;
    const npcLayer = npcLayerRef.current;
    const overlay = overlayLayerRef.current;
    const atlas = atlasRef.current;
    if (!layer || !npcLayer || !overlay || !atlas) return;

    layer.removeChildren();
    npcLayer.removeChildren();
    for (const child of [...overlay.children]) {
      const lbl = (child as { label?: string }).label;
      if (lbl === 'coin-badge' || lbl === 'queue-clock') overlay.removeChild(child);
    }
    npcsRef.current = [];

    const current = stateRef.current;
    for (const b of current.buildings) {
      const slug = spriteForLevel(b.type, b.level);
      const tex = getTopdownTexture(atlas, slug);
      if (!tex || tex === Texture.EMPTY) continue;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.95);
      const def = BUILDINGS[b.type];
      // Tiny Swords sprites range from 128px (small house) to 320px (castle).
      // Target ~2.5 tile widths for small structures, scaling up for big ones.
      const longSide = Math.max(tex.width, tex.height);
      const targetTiles = longSide >= 256 ? 4 : longSide >= 192 ? 3.2 : 2.5;
      const baseScale = (TILE_W * targetTiles * (def.spriteScale ?? 1)) / longSide;
      sprite.scale.set(baseScale);
      const { sx, sy } = gridToScreen(b.gx, b.gy, 0, 0);
      sprite.position.set(sx, sy + TILE_H * 0.4);
      // Y-sort: bottom of building anchor = sy + TILE_H * 0.4
      sprite.zIndex = Math.floor(sy + TILE_H * 0.4);
      layer.addChild(sprite);

      // Coin badge
      if (b.type === 'farm') {
        const pending = farmPendingCoins(current, b);
        if (pending >= COIN_BADGE_THRESHOLD) {
          const badge = makeCoinBadge(pending);
          badge.position.set(sx, sy - TILE_H * 0.5);
          badge.zIndex = b.gy * 1000 + b.gx + 1;
          badge.label = 'coin-badge';
          overlay.addChild(badge);
        }
      }

      // Build queue clock
      const q = current.buildQueue.find(x => x.buildingId === b.id);
      if (q && q.finishesAt > Date.now()) {
        const clock = makeQueueClock();
        clock.position.set(sx, sy - TILE_H * 0.6);
        clock.zIndex = b.gy * 1000 + b.gx + 2;
        clock.label = 'queue-clock';
        overlay.addChild(clock);
      }

      // NPC per active building — random villager type, animated walk
      if (mode === 'interactive' && (!q || q.finishesAt <= Date.now()) && atlas.villagerSheets.size > 0) {
        const types = Array.from(atlas.villagerSheets.keys());
        const villagerType = types[stringHash(b.id) % types.length];
        const sheet = atlas.villagerSheets.get(villagerType)!;
        const npc = makeNPC(b, sheet, villagerType);
        if (npc) {
          // Spawn 1-2 tiles below the building so they're not eclipsed
          npc.x += Math.random() * 80 - 40;
          npc.y += TILE_H * 1.4;
          npc.targetX = npc.x;
          npc.targetY = npc.y;
          layer.addChild(npc.sprite);
          npcsRef.current.push(npc);
        }
      }
    }
  }

  function makeNPC(b: PlacedBuilding, sheet: Texture, villagerType: VillagerType): NPC | null {
    const f = villagerFrame(0);
    const tex = new Texture({
      source: sheet.source,
      frame: new Rectangle(f.x, f.y, f.w, f.h),
    });
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(1.8); // 48x48 → 86x86 px (matches building scale)
    const { sx, sy } = gridToScreen(b.gx, b.gy, 0, 0);
    return {
      buildingId: b.id,
      homeGx: b.gx,
      homeGy: b.gy,
      x: sx,
      y: sy,
      targetX: sx,
      targetY: sy,
      speed: 0.4 + Math.random() * 0.4,
      sprite,
      facingRight: true,
      frameTime: 0,
      frame: 0,
      villagerSheet: sheet,
      villagerType,
    };
  }

  return <div ref={hostRef} className={mode === 'preview' ? 'absolute inset-0 pointer-events-none' : 'fixed inset-0 touch-none'} />;
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function tileVariant(gx: number, gy: number, n: number): number {
  let h = (gx * 73856093) ^ (gy * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h) % n;
}

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
