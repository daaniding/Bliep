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
  FederatedPointerEvent,
  Point,
} from 'pixi.js';
import { loadFarmTerrain, FARM_TILE, type FarmTerrain } from '@/lib/game/farmTerrain';
import { parseElevation, processElevation, MAP_COLS, MAP_ROWS } from '@/lib/game/staticMap';
import { autotileCoastIndex } from '@/lib/game/autotile';
import { generateGroves, type TreePlacement } from '@/lib/game/treeGroves';
import {
  TILE_W,
  TILE_H,
  GRID_SIZE,
  CITY_CENTER,
  BUILD_ZONE_RADIUS,
  gridToScreen,
  screenToGrid,
  inBounds,
  inBuildZone,
  centerOrigin,
} from '@/lib/game/iso';
import {
  loadTopdownAtlas,
  getTopdownTexture,
  villagerFrame,
  VILLAGER_TYPES,
  VILLAGER_FRAME_SIZE,
  VILLAGER_WALK_FRAMES,
  type VillagerType,
  type TopdownAtlas,
} from '@/lib/game/topdown';
import { spriteForLevel, BUILDINGS, footprintOf, coverCell, type BuildingType } from '@/lib/game/buildings';
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
  rotated?: boolean;
  movingBuildingId?: string | null;
  contained?: boolean;
  onTapTile?: (gx: number, gy: number) => void;
  onTapBuilding?: (b: PlacedBuilding) => void;
  onTapChest?: () => void;
  onCollectFarm?: (b: PlacedBuilding) => void;
  onReady?: () => void;
}

const MIN_ZOOM_INTERACTIVE = 0.04;
const MAX_ZOOM_INTERACTIVE = 2.4;
const TAP_THRESHOLD_PX = 6;
const COIN_BADGE_THRESHOLD = 1;
const WATER_MARGIN = 16;

/** Scale factor: 16px source tiles → 64px display. */
const TILE_SCALE = TILE_W / FARM_TILE; // = 4

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
  rotated = false,
  movingBuildingId = null,
  contained = false,
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
  const occupiedCellsRef = useRef<Set<string>>(new Set());
  const terrainCacheRef = useRef<FarmTerrain | null>(null);
  const originRef = useRef<{ originX: number; originY: number }>({ originX: 0, originY: 0 });
  const stateRef = useRef<CityState>(state);
  const placingRef = useRef<BuildingType | null>(placingType);
  const rotatedRef = useRef(rotated);
  const movingRef = useRef<string | null>(movingBuildingId);
  const footprintOverlayRef = useRef<Graphics | null>(null);
  const callbacksRef = useRef({ onTapTile, onTapBuilding, onTapChest, onCollectFarm });

  useEffect(() => { stateRef.current = state; });
  useEffect(() => { placingRef.current = placingType; }, [placingType]);
  useEffect(() => { rotatedRef.current = rotated; }, [rotated]);
  useEffect(() => { movingRef.current = movingBuildingId; }, [movingBuildingId]);
  useEffect(() => {
    callbacksRef.current = { onTapTile, onTapBuilding, onTapChest, onCollectFarm };
  }, [onTapTile, onTapBuilding, onTapChest, onCollectFarm]);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    appRef.current = app;

    const waitForSize = () => new Promise<void>(resolve => {
      if (host.clientWidth > 0 && host.clientHeight > 0) return resolve();
      const observer = new ResizeObserver(entries => {
        for (const e of entries) {
          if (e.contentRect.width > 0 && e.contentRect.height > 0) {
            observer.disconnect();
            resolve();
            return;
          }
        }
      });
      observer.observe(host);
      window.setTimeout(() => { observer.disconnect(); resolve(); }, 500);
    });

    (async () => {
      await waitForSize();
      if (cancelled) return;
      const initW = host.clientWidth || 360;
      const initH = host.clientHeight || 360;
      await app.init({
        width: initW,
        height: initH,
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: false,
        roundPixels: true,
        resolution: mode === 'preview' ? 1 : window.devicePixelRatio || 1,
        autoDensity: true,
      });
      app.renderer.resize(initW, initH);
      if (cancelled) {
        app.destroy(true, { children: true, texture: false });
        return;
      }
      host.appendChild(app.canvas);

      // ---- Load all assets in parallel ----
      const [atlas, terrain] = await Promise.all([
        loadTopdownAtlas(),
        loadFarmTerrain(),
      ]);
      if (cancelled) return;
      atlasRef.current = atlas;
      terrainCacheRef.current = terrain;

      // ---- Stage background (smooth ocean gradient — not tiled) ----
      const stageBg = new Graphics();
      const drawBg = () => {
        stageBg.clear();
        // Smooth gradient from lighter edges to darker center
        stageBg.rect(0, 0, app.renderer.width, app.renderer.height);
        stageBg.fill({ color: 0x2d6585 });
      };
      drawBg();
      app.stage.addChild(stageBg);

      const world = new Container();
      const duskFilter = mode === 'preview' ? new ColorMatrixFilter() : null;
      if (duskFilter) duskFilter.brightness(0.78, false);
      app.stage.addChild(world);
      worldRef.current = world;

      // ---- Layer stack ----
      const tileLayer = new Container();
      world.addChild(tileLayer);
      tileLayerRef.current = tileLayer;
      if (duskFilter) tileLayer.filters = [duskFilter];

      const decorLayer = new Container();
      decorLayer.sortableChildren = true;
      world.addChild(decorLayer);
      decorLayerRef.current = decorLayer;
      if (duskFilter) decorLayer.filters = [duskFilter];

      // No animal layer — NPCs come with buildings, not ambient.

      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      buildingLayerRef.current = buildingLayer;
      if (duskFilter) buildingLayer.filters = [duskFilter];
      npcLayerRef.current = buildingLayer;

      const overlayLayer = new Container();
      overlayLayer.sortableChildren = true;
      world.addChild(overlayLayer);
      overlayLayerRef.current = overlayLayer;

      const particleLayer = new Container();
      world.addChild(particleLayer);

      originRef.current = { originX: 0, originY: 0 };

      // ================================================================
      // TERRAIN RENDERING (antarcticbees Farm tileset)
      // Multi-layer: deep water → shallow water → sand → grass
      // ================================================================
      const rawElev = parseElevation();
      const elevation = processElevation(rawElev);

      // Center the island in the 192×192 game grid
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);
      const worldGx = (rx: number) => mapOffsetGx + rx;
      const worldGy = (ry: number) => mapOffsetGy + ry;

      const landAtWorld = (wgx: number, wgy: number): boolean => {
        const rx = wgx - mapOffsetGx;
        const ry = wgy - mapOffsetGy;
        if (rx < 0 || rx >= MAP_COLS || ry < 0 || ry >= MAP_ROWS) return false;
        return elevation[ry][rx] === 3; // grass
      };

      // ---- Bake water frames to 6×6 blocks with subtle variation ----
      // Larger baked texture = less visible tiling pattern
      const WATER_BAKE_SIZE = 12;
      const bakeWaterTile = (tex: Texture, frameIdx: number) => {
        const c = new Container();
        for (let dy = 0; dy < WATER_BAKE_SIZE; dy++) {
          for (let dx = 0; dx < WATER_BAKE_SIZE; dx++) {
            const s = new Sprite(tex);
            s.width = TILE_W; s.height = TILE_H;
            s.position.set(dx * TILE_W, dy * TILE_H);
            // Subtle tint variation to break up the grid
            const h = ((dx * 374761 + dy * 668265 + frameIdx * 12345) >>> 0) % 1000;
            const brightness = 0.96 + (h / 1000) * 0.08; // 0.96 - 1.04
            const r = Math.round(80 * brightness);
            const g = Math.round(150 * brightness);
            const b = Math.round(184 * brightness);
            s.tint = (r << 16) | (g << 8) | b;
            c.addChild(s);
          }
        }
        const t = app.renderer.generateTexture({ target: c, resolution: 1 });
        if (t.source) t.source.scaleMode = 'nearest';
        c.destroy({ children: true });
        return t;
      };
      const bakedWater = bakeWaterTile(terrain.water, 0);
      const bakedWaterFrames = terrain.waterFrames.map((f, i) => bakeWaterTile(f, i));

      // ---- Animated water backdrop ----
      const waterLeft = -WATER_MARGIN * TILE_W;
      const waterTop = -WATER_MARGIN * TILE_H;
      const waterW = (GRID_SIZE + WATER_MARGIN * 2) * TILE_W;
      const waterH = (GRID_SIZE + WATER_MARGIN * 2) * TILE_H;
      // Smooth color base layer (no tiling pattern visible)
      const waterBase = new Graphics();
      waterBase.rect(waterLeft, waterTop, waterW, waterH);
      waterBase.fill({ color: 0x2f6e8c });
      tileLayer.addChild(waterBase);

      // Tile layer 1 — subtle texture overlay
      const water = new TilingSprite({
        texture: bakedWaterFrames[0] || bakedWater,
        width: waterW,
        height: waterH,
      });
      water.position.set(waterLeft, waterTop);
      water.alpha = 0.28; // visible wave movement but still smooth
      tileLayer.addChild(water);

      // Tile layer 2 — offset, different speed for shimmer
      const water2 = new TilingSprite({
        texture: bakedWaterFrames[1] || bakedWater,
        width: waterW,
        height: waterH,
      });
      water2.position.set(waterLeft, waterTop);
      water2.alpha = 0.15;
      water2.tint = 0x70aacc;
      tileLayer.addChild(water2);

      // Animate water by cycling through 4 frames
      let waterFrame = 0;
      let waterFrameTimer = 0;

      // ---- Ocean detail layer (above water, below terrain) ----
      const oceanDetailLayer = new Container();
      oceanDetailLayer.sortableChildren = true;
      tileLayer.addChild(oceanDetailLayer);

      const oceanRng = (i: number, s: number) => {
        let h = (i * 374761393 + s * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        return ((h >>> 0) % 10000) / 10000;
      };
      const oceanCX = GRID_SIZE / 2 * TILE_W;
      const oceanCY = GRID_SIZE / 2 * TILE_H;

      // ---- Depth zones — darker center, lighter near edges ----
      const depthOverlay = new Graphics();
      // Dark deep center
      depthOverlay.circle(oceanCX, oceanCY, 60 * TILE_W);
      depthOverlay.fill({ color: 0x1a3a5c, alpha: 0.15 });
      depthOverlay.circle(oceanCX, oceanCY, 35 * TILE_W);
      depthOverlay.fill({ color: 0x0d2844, alpha: 0.12 });
      oceanDetailLayer.addChild(depthOverlay);

      // ---- Water rocks — animated, scattered throughout ----
      if (terrain.waterRocks.length > 0) {
        for (let i = 0; i < 40; i++) {
          const sheet = terrain.waterRocks[Math.floor(oceanRng(i, 0) * terrain.waterRocks.length)];
          const rock = new AnimatedSprite(sheet.frames);
          rock.anchor.set(0.5, 0.7);
          // Spread across visible area — some close, some far
          const angle = oceanRng(i, 1) * Math.PI * 2;
          const dist = 8 + oceanRng(i, 2) * 55;
          rock.position.set(oceanCX + Math.cos(angle) * dist * TILE_W, oceanCY + Math.sin(angle) * dist * TILE_H);
          const rockScale = (TILE_W * (0.8 + oceanRng(i, 3) * 1.2)) / sheet.frameW;
          rock.scale.set(rockScale);
          rock.animationSpeed = 0.08 + oceanRng(i, 4) * 0.04;
          rock.currentFrame = Math.floor(oceanRng(i, 5) * sheet.frames.length);
          rock.play();
          rock.zIndex = Math.floor(rock.position.y);
          oceanDetailLayer.addChild(rock);
        }
      }

      // ---- Foam patches — various sizes scattered on surface ----
      if (terrain.waterFoam) {
        const foamSheet = terrain.waterFoam;
        for (let i = 0; i < 25; i++) {
          const foam = new AnimatedSprite(foamSheet.frames);
          foam.anchor.set(0.5);
          const angle = oceanRng(i + 100, 10) * Math.PI * 2;
          const dist = 5 + oceanRng(i + 100, 11) * 60;
          foam.position.set(oceanCX + Math.cos(angle) * dist * TILE_W, oceanCY + Math.sin(angle) * dist * TILE_H);
          const foamScale = (TILE_W * (0.3 + oceanRng(i + 100, 12) * 0.8)) / foamSheet.frameW;
          foam.scale.set(foamScale);
          foam.animationSpeed = 0.04 + oceanRng(i + 100, 13) * 0.04;
          foam.currentFrame = Math.floor(oceanRng(i + 100, 14) * foamSheet.frames.length);
          foam.alpha = 0.35 + oceanRng(i + 100, 15) * 0.35;
          foam.play();
          oceanDetailLayer.addChild(foam);
        }
      }

      // ---- Swimming fish — slow movement across the water ----
      type SwimmingFish = { sprite: Sprite; x: number; y: number; vx: number; vy: number; homeX: number; homeY: number };
      const swimmingFish: SwimmingFish[] = [];
      if (terrain.fishes.length > 0) {
        for (let i = 0; i < 15; i++) {
          const tex = terrain.fishes[Math.floor(oceanRng(i + 200, 0) * terrain.fishes.length)];
          const sprite = new Sprite(tex);
          sprite.anchor.set(0.5);
          const angle = oceanRng(i + 200, 1) * Math.PI * 2;
          const dist = 10 + oceanRng(i + 200, 2) * 50;
          const x = oceanCX + Math.cos(angle) * dist * TILE_W;
          const y = oceanCY + Math.sin(angle) * dist * TILE_H;
          sprite.position.set(x, y);
          const fishScale = (TILE_W * (0.6 + oceanRng(i + 200, 3) * 0.5)) / Math.max(tex.width, tex.height);
          sprite.scale.set(fishScale);
          sprite.alpha = 0.6 + oceanRng(i + 200, 4) * 0.3;
          sprite.zIndex = Math.floor(y);
          oceanDetailLayer.addChild(sprite);
          const speed = 0.15 + oceanRng(i + 200, 5) * 0.25;
          const dir = oceanRng(i + 200, 6) * Math.PI * 2;
          swimmingFish.push({ sprite, x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, homeX: x, homeY: y });
        }
      }

      // ---- Floating ducks — animated, wandering slowly ----
      type FloatingDuck = { sprite: AnimatedSprite; x: number; y: number; vx: number; vy: number; homeX: number; homeY: number };
      const floatingDucks: FloatingDuck[] = [];
      if (terrain.duck) {
        const duckSheet = terrain.duck;
        for (let i = 0; i < 5; i++) {
          const duck = new AnimatedSprite(duckSheet.frames);
          duck.anchor.set(0.5);
          const angle = oceanRng(i + 300, 1) * Math.PI * 2;
          const dist = 12 + oceanRng(i + 300, 2) * 30;
          const x = oceanCX + Math.cos(angle) * dist * TILE_W;
          const y = oceanCY + Math.sin(angle) * dist * TILE_H;
          duck.position.set(x, y);
          const duckScale = (TILE_W * (1.0 + oceanRng(i + 300, 3) * 0.4)) / duckSheet.frameW;
          duck.scale.set(duckScale);
          duck.animationSpeed = 0.04 + oceanRng(i + 300, 4) * 0.02;
          duck.currentFrame = Math.floor(oceanRng(i + 300, 5) * duckSheet.frames.length);
          duck.play();
          duck.zIndex = Math.floor(y) + 10;
          oceanDetailLayer.addChild(duck);
          const speed = 0.08 + oceanRng(i + 300, 6) * 0.12;
          const dir = oceanRng(i + 300, 7) * Math.PI * 2;
          floatingDucks.push({ sprite: duck, x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, homeX: x, homeY: y });
        }
      }

      // ---- Cloud shadows — dark patches drifting over the water ----
      const cloudShadows: { g: Graphics; speed: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const g = new Graphics();
        const size = 80 + oceanRng(i + 400, 0) * 200;
        g.ellipse(0, 0, size, size * 0.6);
        g.fill({ color: 0x000000, alpha: 0.06 + oceanRng(i + 400, 1) * 0.06 });
        const x = oceanRng(i + 400, 2) * GRID_SIZE * TILE_W;
        const y = oceanRng(i + 400, 3) * GRID_SIZE * TILE_H;
        g.position.set(x, y);
        oceanDetailLayer.addChild(g);
        cloudShadows.push({ g, speed: 0.12 + oceanRng(i + 400, 4) * 0.15 });
      }

      // ---- Sparkle/glint effects — light flashes on the surface ----
      type Sparkle = { g: Graphics; x: number; y: number; phase: number; speed: number };
      const sparkles: Sparkle[] = [];
      for (let i = 0; i < 30; i++) {
        const g = new Graphics();
        g.star(0, 0, 4, 3, 1.5);
        g.fill({ color: 0xffffff, alpha: 0.8 });
        const x = oceanRng(i + 500, 0) * GRID_SIZE * TILE_W;
        const y = oceanRng(i + 500, 1) * GRID_SIZE * TILE_H;
        g.position.set(x, y);
        g.scale.set(0.5 + oceanRng(i + 500, 2) * 0.5);
        g.alpha = 0;
        oceanDetailLayer.addChild(g);
        sparkles.push({ g, x, y, phase: oceanRng(i + 500, 3) * Math.PI * 2, speed: 0.3 + oceanRng(i + 500, 4) * 0.5 });
      }

      // ---- Bubble particles — small circles rising gently ----
      type Bubble = { g: Graphics; x: number; y: number; vy: number; life: number; maxLife: number; baseAlpha: number };
      const bubbles: Bubble[] = [];
      let bubbleTimer = 0;

      // ---- Multi-layer terrain rendering ----
      // TEMP: hide island to focus on ocean only
      const HIDE_ISLAND = false;
      const SHAPE_ONLY = true; // only grass + coast, no trees/decorations
      const seed = state.npcSeed || 1;
      const hash = (x: number, y: number, salt: number): number => {
        let h = (x * 374761393 + y * 668265263 + salt * 2147483647 + seed * 69069) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return ((h >>> 0) % 10000) / 10000;
      };

      // Collect cells by type
      const grassCells: Array<{ gx: number; gy: number; rx: number; ry: number }> = [];
      const lakeCells: Array<{ gx: number; gy: number; rx: number; ry: number }> = [];
      const landCells: Array<{ gx: number; gy: number }> = [];

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          const v = elevation[ry][rx];
          const gx = worldGx(rx), gy = worldGy(ry);
          if (v === 3) {
            grassCells.push({ gx, gy, rx, ry });
            landCells.push({ gx, gy });
          } else if (v === 4) {
            lakeCells.push({ gx, gy, rx, ry });
          }
        }
      }

      const swayTrees: { sprite: Sprite; baseX: number; phase: number }[] = [];
      if (!HIDE_ISLAND) {
      // ---- Shallow water gradient ----
      const waterOverlay = new Graphics();
      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] === 1) {
            let minDist = 4;
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nv = elevation[ry + dr]?.[rx + dc] ?? 0;
              if (nv >= 2) { minDist = 1; break; }
            }
            if (minDist > 1) {
              outer: for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                  const nv = elevation[ry+dr]?.[rx+dc] ?? 0;
                  if (nv >= 2) { minDist = 2; break outer; }
                }
              }
            }
            const color = minDist <= 1 ? 0x70e8c8 : minDist <= 2 ? 0x58d4b8 : 0x48c0b0;
            const alpha = minDist <= 1 ? 0.50 : minDist <= 2 ? 0.38 : 0.25;
            waterOverlay.rect(worldGx(rx) * TILE_W, worldGy(ry) * TILE_H, TILE_W, TILE_H);
            waterOverlay.fill({ color, alpha });
          }
        }
      }
      tileLayer.addChild(waterOverlay);

      // ---- Animated water edges — foam on water cells adjacent to land ----
      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          const v = elevation[ry][rx];
          if (v !== 0 && v !== 1) continue;
          const nv = elevation[ry - 1]?.[rx] ?? 0;
          const sv = elevation[ry + 1]?.[rx] ?? 0;
          const wv = elevation[ry]?.[rx - 1] ?? 0;
          const ev = elevation[ry]?.[rx + 1] ?? 0;
          const landN = nv === 3, landS = sv === 3, landW = wv === 3, landE = ev === 3;

          let frames: Texture[] | null = null;
          if (landN || landS || landW || landE) {
            if (landN && landW) frames = terrain.waterEdge.NW;
            else if (landN && landE) frames = terrain.waterEdge.NE;
            else if (landS && landW) frames = terrain.waterEdge.SW;
            else if (landS && landE) frames = terrain.waterEdge.SE;
            else if (landN) frames = terrain.waterEdge.N;
            else if (landS) frames = terrain.waterEdge.S;
            else if (landW) frames = terrain.waterEdge.W;
            else if (landE) frames = terrain.waterEdge.E;
          } else {
            // Inner corners (diagonal land only)
            const nwv = elevation[ry - 1]?.[rx - 1] ?? 0;
            const nev = elevation[ry - 1]?.[rx + 1] ?? 0;
            const swv = elevation[ry + 1]?.[rx - 1] ?? 0;
            const sev = elevation[ry + 1]?.[rx + 1] ?? 0;
            if (nwv === 3) frames = terrain.waterEdge.NW;
            else if (nev === 3) frames = terrain.waterEdge.NE;
            else if (swv === 3) frames = terrain.waterEdge.SW;
            else if (sev === 3) frames = terrain.waterEdge.SE;
          }
          if (!frames || frames.length === 0) continue;
          const gx = worldGx(rx), gy = worldGy(ry);
          const anim = new AnimatedSprite(frames);
          anim.anchor.set(0, 0);
          anim.position.set(gx * TILE_W, gy * TILE_H);
          anim.width = TILE_W; anim.height = TILE_H;
          anim.animationSpeed = 0.06; anim.play();
          anim.currentFrame = Math.floor(hash(gx, gy, 8000) * frames.length);
          tileLayer.addChild(anim);
        }
      }

      // ---- Lake water ----
      if (lakeCells.length > 0) {
        let lakeMinX = Infinity, lakeMinY = Infinity, lakeMaxX = -Infinity, lakeMaxY = -Infinity;
        for (const c of lakeCells) {
          const px = c.gx * TILE_W, py = c.gy * TILE_H;
          if (px < lakeMinX) lakeMinX = px;
          if (py < lakeMinY) lakeMinY = py;
          if (px + TILE_W > lakeMaxX) lakeMaxX = px + TILE_W;
          if (py + TILE_H > lakeMaxY) lakeMaxY = py + TILE_H;
        }
        const lakeWater = new TilingSprite({ texture: bakedWater, width: lakeMaxX - lakeMinX + TILE_W * 2, height: lakeMaxY - lakeMinY + TILE_H * 2 });
        lakeWater.position.set(lakeMinX - TILE_W, lakeMinY - TILE_H);
        lakeWater.tint = 0x88ccee;
        tileLayer.addChild(lakeWater);
        const lakeMask = new Graphics();
        for (const c of lakeCells) { lakeMask.rect(c.gx * TILE_W, c.gy * TILE_H, TILE_W, TILE_H); }
        lakeMask.fill({ color: 0xffffff });
        tileLayer.addChild(lakeMask);
        lakeWater.mask = lakeMask;
        const lakeWaterRef = lakeWater;
        app.ticker.add((ticker) => { const dt = ticker.deltaTime ?? 1; lakeWaterRef.tilePosition.x -= 0.15 * dt; lakeWaterRef.tilePosition.y += 0.3 * dt; });
      }

      // ---- Grass tiles — smooth noise-based tint variation ----
      const noiseGrid = new Map<string, number>();
      const noiseAt = (gx: number, gy: number): number => { const key = `${gx},${gy}`; let v = noiseGrid.get(key); if (v === undefined) { v = hash(gx, gy, 42); noiseGrid.set(key, v); } return v; };
      const smoothNoise = (x: number, y: number): number => {
        const freq = 0.045, fx = x * freq, fy = y * freq;
        const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const n00 = noiseAt(ix, iy), n10 = noiseAt(ix + 1, iy), n01 = noiseAt(ix, iy + 1), n11 = noiseAt(ix + 1, iy + 1);
        return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy;
      };
      const lerpColor = (a: number, b: number, t: number): number => {
        const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
        const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
        return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
      };
      const grassColorA = 0xFCFFF8, grassColorB = 0xECF4E0, grassColorC = 0xE0ECDA;

      // ---- Distance from edge for each grass cell (for biome zones) ----
      const grassDistFromEdge = new Map<string, number>();
      const maxGrassDist = 20;
      {
        const dq: Array<[number, number, number]> = [];
        const dVisited = new Set<string>();
        // Start BFS from grass cells that touch water
        for (const cell of grassCells) {
          const rv = elevation[cell.ry - 1]?.[cell.rx] ?? 0;
          const sv = elevation[cell.ry + 1]?.[cell.rx] ?? 0;
          const wv = elevation[cell.ry]?.[cell.rx - 1] ?? 0;
          const ev = elevation[cell.ry]?.[cell.rx + 1] ?? 0;
          const isW = (v: number) => v === 0 || v === 1 || v === 4;
          if (isW(rv) || isW(sv) || isW(wv) || isW(ev)) {
            const key = `${cell.rx},${cell.ry}`;
            grassDistFromEdge.set(key, 0);
            dVisited.add(key);
            dq.push([cell.rx, cell.ry, 0]);
          }
        }
        let di = 0;
        while (di < dq.length) {
          const [x, y, d] = dq[di++];
          if (d >= maxGrassDist) continue;
          for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = x + dx, ny = y + dy;
            const key = `${nx},${ny}`;
            if (dVisited.has(key)) continue;
            if (ny < 0 || ny >= MAP_ROWS || nx < 0 || nx >= MAP_COLS) continue;
            if (elevation[ny][nx] !== 3) continue;
            dVisited.add(key);
            grassDistFromEdge.set(key, d + 1);
            dq.push([nx, ny, d + 1]);
          }
        }
      }

      for (const cell of grassCells) {
        const distFromEdge = grassDistFromEdge.get(`${cell.rx},${cell.ry}`) ?? maxGrassDist;
        const edgeT = Math.min(1, distFromEdge / maxGrassDist);

        // Biome noise — zachte grote vlekken
        const biome1 = smoothNoise(cell.gx, cell.gy);
        const biome2 = smoothNoise(cell.gx * 1.7 + 200, cell.gy * 1.7 + 200);
        const t = Math.min(1, Math.max(0, edgeT * 0.5 + biome1 * 0.3 + biome2 * 0.2));

        // TEXTURE variatie: mix verschillende grass tiles op basis van zone + random
        const r = hash(cell.gx, cell.gy, 50);
        let tex: Texture;
        if (t < 0.25) {
          // Bosrand — donkere gras tiles
          tex = terrain.grassDark[Math.floor(r * terrain.grassDark.length)];
        } else if (t > 0.65) {
          // Open centrum — lichte gras tiles
          tex = terrain.grassLight[Math.floor(r * terrain.grassLight.length)];
        } else {
          // Midden zone — mix van alle medium gras tiles
          tex = terrain.grass[Math.floor(r * terrain.grass.length)];
        }

        const sprite = new Sprite(tex);
        sprite.anchor.set(0, 0);
        sprite.position.set(cell.gx * TILE_W, cell.gy * TILE_H);
        sprite.width = TILE_W; sprite.height = TILE_H;

        // Subtiele tint bovenop de texture variatie
        const darkGreen  = 0xd0deb4;
        const medGreen   = 0xe0ecc8;
        const lightGreen = 0xeef6dc;
        sprite.tint = t < 0.45
          ? lerpColor(darkGreen, medGreen, t / 0.45)
          : lerpColor(medGreen, lightGreen, (t - 0.45) / 0.55);

        tileLayer.addChild(sprite);
      }

      // ---- Animated leaf wind overlays — scattered across the island ----
      const leafWindTex = await (async () => {
        try {
          const t = await (await import('pixi.js')).Assets.load<Texture>('/assets/farm/trees/spring/leaves_wind_basic_spritesheet.png');
          if (t?.source) t.source.scaleMode = 'nearest';
          return t;
        } catch { return null; }
      })();
      if (leafWindTex && grassCells.length > 0) {
        // Slice into frames (assume horizontal strip)
        const fw = leafWindTex.frame.height; // square frames
        const fCount = Math.floor(leafWindTex.frame.width / fw);
        if (fCount > 1) {
          const leafFrames: Texture[] = [];
          for (let i = 0; i < fCount; i++) {
            leafFrames.push(new Texture({ source: leafWindTex.source, frame: new Rectangle(i * fw, 0, fw, fw) }));
          }
          // Place ~20 animated leaf wind patches across the island
          for (let i = 0; i < 20; i++) {
            const cellIdx = Math.floor(hash(i, 0, 7000) * grassCells.length);
            const cell = grassCells[cellIdx];
            const anim = new AnimatedSprite(leafFrames);
            anim.anchor.set(0.5, 0.5);
            const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);
            anim.position.set(sx, sy);
            const leafScale = (TILE_W * 2.5) / fw;
            anim.scale.set(leafScale);
            anim.animationSpeed = 0.08 + hash(i, 1, 7000) * 0.04;
            anim.currentFrame = Math.floor(hash(i, 2, 7000) * leafFrames.length);
            anim.alpha = 0.6;
            anim.play();
            anim.zIndex = 999980;
            decorLayer.addChild(anim);
          }
        }
      }

      {
      // ================================================================
      // DECORATION SCATTER — DENSE, overlapping, breaking up the grid
      // Elke cel kan MEERDERE decoraties krijgen
      // ================================================================
      for (const cell of grassCells) {
        const distFromEdge = grassDistFromEdge.get(`${cell.rx},${cell.ry}`) ?? maxGrassDist;
        const edgeT = Math.min(1, distFromEdge / maxGrassDist);
        const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);

        // --- Layer 1: Grass tufts (45% van cellen) — breekt het grid op ---
        if (hash(cell.gx, cell.gy, 100) < 0.45 && terrain.grassTufts.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 101) * terrain.grassTufts.length);
          const sprite = new Sprite(terrain.grassTufts[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(
            sx + (hash(cell.gx, cell.gy, 102) - 0.5) * TILE_W * 0.7,
            sy + (hash(cell.gx, cell.gy, 103) - 0.5) * TILE_H * 0.7
          );
          sprite.width = TILE_W * 1.0; sprite.height = TILE_H * 1.0;
          sprite.alpha = 0.8;
          sprite.zIndex = Math.floor(sprite.position.y) - 1;
          decorLayer.addChild(sprite);
        }

        // --- Layer 2: TWEEDE tuft op andere positie (25%) — meer overlap ---
        if (hash(cell.gx, cell.gy, 110) < 0.25 && terrain.grassTufts.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 111) * terrain.grassTufts.length);
          const sprite = new Sprite(terrain.grassTufts[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(
            sx + (hash(cell.gx, cell.gy, 112) - 0.5) * TILE_W * 0.9,
            sy + (hash(cell.gx, cell.gy, 113) - 0.5) * TILE_H * 0.5
          );
          sprite.width = TILE_W * 0.7; sprite.height = TILE_H * 0.7;
          sprite.alpha = 0.65;
          sprite.zIndex = Math.floor(sprite.position.y) - 2;
          decorLayer.addChild(sprite);
        }

        // --- Layer 3: Witte bloemen (18% — meer in open centrum) ---
        const flowerChance = edgeT > 0.4 ? 0.18 : 0.06;
        if (hash(cell.gx, cell.gy, 200) < flowerChance && terrain.flowersWhite.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 201) * terrain.flowersWhite.length);
          const sprite = new Sprite(terrain.flowersWhite[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(
            sx + (hash(cell.gx, cell.gy, 202) - 0.5) * TILE_W * 0.6,
            sy + (hash(cell.gx, cell.gy, 203) - 0.5) * TILE_H * 0.4
          );
          sprite.width = TILE_W * 1.0; sprite.height = TILE_H * 1.0;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
        }

        // --- Layer 4: Paarse bloemen (10% — clusters via noise) ---
        const purpleNoise = smoothNoise(cell.gx * 3.5 + 500, cell.gy * 3.5 + 500);
        if (purpleNoise > 0.6 && hash(cell.gx, cell.gy, 300) < 0.25 && terrain.flowersPurple.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 301) * terrain.flowersPurple.length);
          const sprite = new Sprite(terrain.flowersPurple[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(
            sx + (hash(cell.gx, cell.gy, 302) - 0.5) * TILE_W * 0.5,
            sy + (hash(cell.gx, cell.gy, 303) - 0.5) * TILE_H * 0.3
          );
          sprite.width = TILE_W * 0.9; sprite.height = TILE_H * 0.9;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
        }

        // --- Layer 5: Paddenstoelen (5% — alleen aan randen) ---
        if (edgeT < 0.3 && hash(cell.gx, cell.gy, 400) < 0.08 && terrain.mushrooms.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 401) * terrain.mushrooms.length);
          const sprite = new Sprite(terrain.mushrooms[idx]);
          sprite.anchor.set(0.5, 0.9);
          sprite.position.set(
            sx + (hash(cell.gx, cell.gy, 402) - 0.5) * TILE_W * 0.5,
            sy + (hash(cell.gx, cell.gy, 403) - 0.5) * TILE_H * 0.3
          );
          sprite.width = TILE_W * 0.8; sprite.height = TILE_H * 0.8;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
        }

        // --- Layer 6: Stenen (3% — verspreid, meer aan randen) ---
        if (edgeT < 0.4 && hash(cell.gx, cell.gy, 500) < 0.04 && terrain.rocks.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 501) * terrain.rocks.length);
          const sprite = new Sprite(terrain.rocks[idx]);
          sprite.anchor.set(0.5, 0.9);
          sprite.position.set(sx, sy);
          sprite.width = TILE_W * 0.7; sprite.height = TILE_H * 0.6;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
        }
      }

      // ================================================================
      // CATTAILS / REEDS — along cliff cells that touch water
      // ================================================================
      if (terrain.cattails.length > 0) {
        for (const cell of grassCells) {
          const n = elevation[cell.ry - 1]?.[cell.rx] ?? 0;
          const s = elevation[cell.ry + 1]?.[cell.rx] ?? 0;
          const w = elevation[cell.ry]?.[cell.rx - 1] ?? 0;
          const e = elevation[cell.ry]?.[cell.rx + 1] ?? 0;
          const isW = (v: number) => v === 0 || v === 1 || v === 4;
          const touchesWater = isW(n) || isW(s) || isW(w) || isW(e);
          if (!touchesWater) continue;
          if (hash(cell.gx, cell.gy, 2000) > 0.35) continue;
          const idx = Math.floor(hash(cell.gx, cell.gy, 2001) * terrain.cattails.length);
          const sprite = new Sprite(terrain.cattails[idx]);
          sprite.anchor.set(0.5, 0.9);
          const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 2002) - 0.5) * TILE_W * 0.5, sy + TILE_H * 0.1);
          sprite.width = TILE_W * 0.65; sprite.height = TILE_H * 0.8;
          sprite.zIndex = Math.floor(sy) + 1;
          decorLayer.addChild(sprite);
        }
      }

      // ================================================================
      // TREE GROVES — HUGE overlapping trees like reference images
      // ================================================================
      const groveplacements = generateGroves(
        elevation, MAP_COLS, MAP_ROWS,
        CITY_CENTER.gx, CITY_CENTER.gy,
        mapOffsetGx, mapOffsetGy, seed,
      );

      for (const tp of groveplacements) {
        const { sx, sy } = gridToScreen(tp.gx, tp.gy, 0, 0);
        const px = sx + tp.offsetX * TILE_W;
        const py = sy + tp.offsetY * TILE_H;
        let tex: Texture | null = null;

        switch (tp.type) {
          case 'basic':
            if (terrain.trees.length > 0) {
              const sheet = terrain.trees[tp.sheetIndex % terrain.trees.length];
              tex = sheet.frames[0] ?? null;
            }
            break;
          case 'large':
            if (terrain.largeTrees.length > 0)
              tex = terrain.largeTrees[tp.sheetIndex % terrain.largeTrees.length];
            break;
          case 'cherry':
            if (terrain.cherryTrees.length > 0)
              tex = terrain.cherryTrees[tp.sheetIndex % terrain.cherryTrees.length];
            break;
          case 'fruit':
            if (terrain.fruitTrees.length > 0)
              tex = terrain.fruitTrees[tp.sheetIndex % terrain.fruitTrees.length];
            break;
          case 'pine':
            if (terrain.trees.length > 0) {
              const pineIdx = Math.min(4, terrain.trees.length - 1);
              tex = terrain.trees[pineIdx].frames[0] ?? null;
            }
            break;
          case 'bush':
            if (terrain.bushes.length > 0)
              tex = terrain.bushes[tp.sheetIndex % terrain.bushes.length];
            break;
        }

        if (!tex) continue;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0.9);
        // Trees are 1.5x bigger than before for that lush canopy feel
        const treeScale = (TILE_W * tp.scale * 1.5) / Math.max(tex.width, tex.height);
        sprite.scale.set(treeScale);
        sprite.position.set(px, py);
        sprite.zIndex = Math.floor(py);
        decorLayer.addChild(sprite);
        if (swayTrees.length < 120 && tp.type !== 'bush') {
          swayTrees.push({ sprite, baseX: px, phase: hash(tp.gx, tp.gy, 4000) * Math.PI * 2 });
        }
      }

      } // end SHAPE_ONLY
      } // end HIDE_ISLAND

      // ---- Clouds layer — varied depth and layering ----
      const cloudLayer = new Container();
      world.addChild(cloudLayer);
      const cloudSprites: { sprite: Sprite; speed: number }[] = [];
      if (terrain.clouds.length) {
        // Two layers: back (faded, slow) and front (opaque, faster)
        const cloudConfigs = [
          { alpha: 0.35, scaleBase: 2.5, speedBase: 0.08, count: 4 }, // background
          { alpha: 0.70, scaleBase: 1.8, speedBase: 0.18, count: 5 }, // midground
          { alpha: 0.90, scaleBase: 1.2, speedBase: 0.28, count: 3 }, // foreground
        ];
        let ci = 0;
        for (const cfg of cloudConfigs) {
          for (let i = 0; i < cfg.count; i++) {
            const tex = terrain.clouds[ci % terrain.clouds.length];
            const cloud = new Sprite(tex);
            cloud.anchor.set(0.5, 0.5);
            cloud.alpha = cfg.alpha + (hash(ci, 4, 500) - 0.5) * 0.15;
            cloud.position.set(
              hash(ci, 0, 500) * GRID_SIZE * TILE_W,
              hash(ci, 1, 500) * GRID_SIZE * TILE_H,
            );
            cloud.scale.set(cfg.scaleBase + hash(ci, 2, 500) * 1.0);
            cloudLayer.addChild(cloud);
            cloudSprites.push({ sprite: cloud, speed: cfg.speedBase + hash(ci, 3, 500) * 0.12 });
            ci++;
          }
        }
      }

      // ---- Butterflies — small animated particles over flower areas ----
      type ButterflyData = { g: Graphics; baseX: number; baseY: number; phase: number; speed: number; amp: number };
      const butterflies: ButterflyData[] = [];
      const butterflyColors = [0xffd4ef, 0xffe8a0, 0x9bdbff, 0xd5ecc8, 0xf0c8ff];
      for (let i = 0; i < 14; i++) {
        const g = new Graphics();
        const color = butterflyColors[i % butterflyColors.length];
        g.circle(-2.5, -1, 2.5).fill({ color, alpha: 0.85 });
        g.circle(2.5, -1, 2.5).fill({ color, alpha: 0.85 });
        g.circle(0, 1, 1.2).fill({ color: 0x3a2a18 });
        const cellIdx = Math.floor(hash(i, 0, 3000) * grassCells.length);
        const cell = grassCells[cellIdx];
        const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);
        g.position.set(sx, sy - 20);
        g.zIndex = 999990;
        g.alpha = 0.75;
        decorLayer.addChild(g);
        butterflies.push({
          g, baseX: sx, baseY: sy - 20,
          phase: hash(i, 1, 3000) * Math.PI * 2,
          speed: 0.25 + hash(i, 2, 3000) * 0.35,
          amp: 25 + hash(i, 3, 3000) * 35,
        });
      }

      // ---- Fish splash particles in water ----
      type FishSplash = { g: Graphics; x: number; y: number; life: number; maxLife: number; vy: number };
      const fishSplashes: FishSplash[] = [];
      // Collect shallow water positions for fish spawning
      const shallowWaterPos: Array<{ px: number; py: number }> = [];
      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] === 1 && hash(worldGx(rx), worldGy(ry), 5000) < 0.03) {
            shallowWaterPos.push({
              px: worldGx(rx) * TILE_W + TILE_W / 2,
              py: worldGy(ry) * TILE_H + TILE_H / 2,
            });
          }
        }
      }
      let fishTimer = 0;

      // ---- Animated water + cloud drift + foam + ambient ----
      let waterT = 0;
      const cloudWrapX = GRID_SIZE * TILE_W + 400;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime ?? 1;
        waterT += 0.25 * dt;
        water.tilePosition.set(waterT, waterT * 0.5);
        // Second layer moves in opposite direction for shimmer
        water2.tilePosition.set(-waterT * 0.7 + 100, waterT * 0.3 + 50);

        // Cycle water animation: 1→2→3→2→1→2→3→2 (frame 4 = frame 2 per tileset docs)
        waterFrameTimer += dt;
        if (waterFrameTimer > 18 && bakedWaterFrames.length >= 3) {
          waterFrameTimer = 0;
          // Ping-pong: 0,1,2,1,0,1,2,1,...
          const sequence = [0, 1, 2, 1];
          waterFrame = (waterFrame + 1) % sequence.length;
          water.texture = bakedWaterFrames[sequence[waterFrame]];
        }
        for (const c of cloudSprites) {
          c.sprite.position.x += c.speed * dt;
          if (c.sprite.position.x > cloudWrapX) c.sprite.position.x = -200;
        }

        const t = Date.now() / 1000;

        // Animate butterflies — figure-8 flight + wing flap
        for (const b of butterflies) {
          b.g.position.set(
            b.baseX + Math.sin(t * b.speed + b.phase) * b.amp,
            b.baseY + Math.cos(t * b.speed * 0.7 + b.phase) * b.amp * 0.5 - 15,
          );
          const wingFlap = Math.sin(t * 8 + b.phase);
          b.g.scale.set(1, 0.3 + Math.abs(wingFlap) * 0.7);
        }

        // Animate tree sway — subtle horizontal oscillation
        for (const ts of swayTrees) {
          ts.sprite.position.x = ts.baseX + Math.sin(t * 0.6 + ts.phase) * 1.8;
        }

        // ---- OCEAN LIFE ANIMATIONS ----
        // Swimming fish — gentle wandering with direction changes
        for (const f of swimmingFish) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          // Steer back toward home if too far
          const dx = f.homeX - f.x, dy = f.homeY - f.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 200) { f.vx += (dx / dist) * 0.01 * dt; f.vy += (dy / dist) * 0.01 * dt; }
          // Random drift
          f.vx += (Math.sin(t * 0.3 + f.homeX * 0.001) * 0.005) * dt;
          f.vy += (Math.cos(t * 0.25 + f.homeY * 0.001) * 0.003) * dt;
          // Clamp speed
          const spd = Math.hypot(f.vx, f.vy);
          if (spd > 0.4) { f.vx *= 0.4 / spd; f.vy *= 0.4 / spd; }
          f.sprite.position.set(f.x, f.y);
          f.sprite.scale.x = f.vx >= 0 ? Math.abs(f.sprite.scale.x) : -Math.abs(f.sprite.scale.x);
        }

        // Floating ducks — gentle bobbing + wandering
        for (const d of floatingDucks) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          const dx = d.homeX - d.x, dy = d.homeY - d.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 300) { d.vx += (dx / dist) * 0.008 * dt; d.vy += (dy / dist) * 0.008 * dt; }
          d.vx += (Math.sin(t * 0.15 + d.homeX * 0.002) * 0.003) * dt;
          d.vy += (Math.cos(t * 0.12 + d.homeY * 0.002) * 0.002) * dt;
          const spd = Math.hypot(d.vx, d.vy);
          if (spd > 0.2) { d.vx *= 0.2 / spd; d.vy *= 0.2 / spd; }
          d.sprite.position.set(d.x, d.y + Math.sin(t * 1.5 + d.homeX) * 2); // bobbing
          d.sprite.scale.x = d.vx >= 0 ? Math.abs(d.sprite.scale.x) : -Math.abs(d.sprite.scale.x);
        }

        // Cloud shadows — drift across the water
        for (const cs of cloudShadows) {
          cs.g.position.x += cs.speed * dt;
          if (cs.g.position.x > GRID_SIZE * TILE_W + 300) cs.g.position.x = -300;
        }

        // Sparkles — pulse in and out
        for (const sp of sparkles) {
          const pulse = Math.sin(t * sp.speed + sp.phase);
          sp.g.alpha = Math.max(0, pulse * 0.7);
          sp.g.scale.set(0.3 + Math.max(0, pulse) * 0.7);
        }

        // Bubbles — spawn and rise
        bubbleTimer += dt;
        if (bubbleTimer > 40 && bubbles.length < 20) {
          bubbleTimer = 0;
          const bx = oceanCX + (Math.random() - 0.5) * 80 * TILE_W;
          const by = oceanCY + (Math.random() - 0.5) * 60 * TILE_H;
          const g = new Graphics();
          const size = 1.5 + Math.random() * 2.5;
          g.circle(0, 0, size);
          g.fill({ color: 0xc0e8ff, alpha: 0.6 });
          g.circle(-size * 0.3, -size * 0.3, size * 0.3);
          g.fill({ color: 0xffffff, alpha: 0.4 });
          g.position.set(bx, by);
          oceanDetailLayer.addChild(g);
          bubbles.push({ g, x: bx, y: by, vy: -0.3 - Math.random() * 0.4, life: 0, maxLife: 60 + Math.random() * 40, baseAlpha: 0.4 + Math.random() * 0.3 });
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.life += dt;
          b.y += b.vy * dt;
          b.x += Math.sin(b.life * 0.1 + b.x * 0.01) * 0.2;
          b.g.position.set(b.x, b.y);
          b.g.alpha = b.baseAlpha * Math.max(0, 1 - b.life / b.maxLife);
          b.g.scale.set(0.8 + (b.life / b.maxLife) * 0.4);
          if (b.life >= b.maxLife) {
            oceanDetailLayer.removeChild(b.g);
            b.g.destroy();
            bubbles.splice(i, 1);
          }
        }

        // Fish splash — occasional jump in shallow water
        fishTimer += dt;
        if (fishTimer > 180 && shallowWaterPos.length > 0) { // ~3 seconds
          fishTimer = 0;
          if (Math.random() < 0.4) {
            const pos = shallowWaterPos[Math.floor(Math.random() * shallowWaterPos.length)];
            const g = new Graphics();
            // Splash ring
            g.circle(0, 0, 3).fill({ color: 0xFFFFFF, alpha: 0.9 });
            g.position.set(pos.px, pos.py);
            particleLayer.addChild(g);
            fishSplashes.push({ g, x: pos.px, y: pos.py, life: 0, maxLife: 40, vy: -2 });
            // Droplets
            for (let d = 0; d < 4; d++) {
              const drop = new Graphics();
              drop.circle(0, 0, 1.5).fill({ color: 0x9bdbff, alpha: 0.8 });
              drop.position.set(pos.px, pos.py);
              particleLayer.addChild(drop);
              const angle = (d / 4) * Math.PI * 2 + Math.random() * 0.5;
              fishSplashes.push({
                g: drop, x: pos.px, y: pos.py,
                life: 0, maxLife: 30, vy: -1.5 + Math.sin(angle) * 1.5,
              });
            }
          }
        }
        // Animate fish splashes
        for (let i = fishSplashes.length - 1; i >= 0; i--) {
          const fs = fishSplashes[i];
          fs.life += dt;
          fs.g.position.y += fs.vy * dt;
          fs.vy += 0.1 * dt; // gravity
          fs.g.alpha = Math.max(0, 1 - fs.life / fs.maxLife);
          fs.g.scale.set(1 + fs.life / fs.maxLife * 0.5);
          if (fs.life >= fs.maxLife) {
            particleLayer.removeChild(fs.g);
            fs.g.destroy();
            fishSplashes.splice(i, 1);
          }
        }
      });

      // ---- Daily chest ----
      const chestTex = getTopdownTexture(atlas, 'chest');
      if (!HIDE_ISLAND && chestTex && chestTex !== Texture.EMPTY) {
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
      let islandMinX = Infinity, islandMaxX = -Infinity;
      let islandMinY = Infinity, islandMaxY = -Infinity;
      for (const c of landCells) {
        const x = c.gx * TILE_W;
        const y = c.gy * TILE_H;
        if (x < islandMinX) islandMinX = x;
        if (x > islandMaxX) islandMaxX = x;
        if (y < islandMinY) islandMinY = y;
        if (y > islandMaxY) islandMaxY = y;
      }
      const islandW = (islandMaxX - islandMinX) + TILE_W;
      const islandH = (islandMaxY - islandMinY) + TILE_H;
      const islandCenterPxX = islandMinX + islandW / 2;
      const islandCenterPxY = islandMinY + islandH / 2;

      const centerWorld = () => {
        const z = world.scale.x || 1;
        world.position.set(
          app.renderer.width / 2 - islandCenterPxX * z,
          app.renderer.height / 2 - islandCenterPxY * z,
        );
      };
      centerWorld();

      const extMapW = (GRID_SIZE + WATER_MARGIN * 2) * TILE_W;
      const extMapH = (GRID_SIZE + WATER_MARGIN * 2) * TILE_H;
      const minZoomFit = Math.max(
        app.renderer.width / extMapW,
        app.renderer.height / extMapH,
      );
      const defaultZoom = Math.min(
        app.renderer.width / (18 * TILE_W),
        app.renderer.height / (18 * TILE_H),
      );
      const previewPadding = 4 * TILE_W;
      const previewZoom = Math.min(
        app.renderer.width / (islandW + previewPadding * 2),
        app.renderer.height / (islandH + previewPadding * 2),
      );
      const minZoom = Math.max(minZoomFit, MIN_ZOOM_INTERACTIVE);
      const startZoom = mode === 'preview' ? Math.max(previewZoom, minZoomFit) : Math.max(defaultZoom, minZoom);
      world.scale.set(startZoom);
      world.position.set(
        app.renderer.width / 2 - islandCenterPxX * startZoom,
        app.renderer.height / 2 - islandCenterPxY * startZoom,
      );
      (app as Application & { __minZoom?: number }).__minZoom = minZoom;

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      // ---- Particles + shake ----
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
            g, vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (detail.kind === 'coin' ? 3 : 1),
            life: 0, maxLife: detail.kind === 'smoke' ? 50 : 35,
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

      // ---- Input (interactive mode only) ----
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
          const mapW = extMapW * world.scale.x;
          const mapH = extMapH * world.scale.y;
          const viewW = app.renderer.width;
          const viewH = app.renderer.height;
          const leftEdge = -WATER_MARGIN * TILE_W * world.scale.x;
          const topEdge = -WATER_MARGIN * TILE_H * world.scale.y;
          if (mapW <= viewW) {
            world.position.x = (viewW - mapW) / 2 + leftEdge * -1;
          } else {
            const minX = viewW - (leftEdge + mapW);
            const maxX = -leftEdge;
            world.position.x = Math.min(maxX, Math.max(minX, world.position.x));
          }
          if (mapH <= viewH) {
            world.position.y = (viewH - mapH) / 2 + topEdge * -1;
          } else {
            const minY = viewH - (topEdge + mapH);
            const maxY = -topEdge;
            world.position.y = Math.min(maxY, Math.max(minY, world.position.y));
          }
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
            pinchStartDist = Math.hypot(arr[0].lastX - arr[1].lastX, arr[0].lastY - arr[1].lastY) || 1;
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
            if (placingRef.current && pointers.size === 1) {
              const { gx, gy } = globalToGrid(e.global.x, e.global.y);
              updateGhost(gx, gy);
            } else if (pointers.size === 1) {
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
        };

        const onUp = (e: FederatedPointerEvent) => {
          const p = pointers.get(e.pointerId);
          if (!p) return;
          const wasDrag = p.moved >= TAP_THRESHOLD_PX;
          const wasTap = !wasDrag && pointers.size === 1;
          pointers.delete(e.pointerId);
          if (placingRef.current) {
            const { gx, gy } = globalToGrid(e.global.x, e.global.y);
            if (inBounds(gx, gy)) callbacksRef.current.onTapTile?.(gx, gy);
            return;
          }
          if (!wasTap) return;
          const { gx, gy } = globalToGrid(e.global.x, e.global.y);
          if (!inBounds(gx, gy)) return;
          const existing = stateRef.current.buildings.find(b => coverCell(b.type, b.gx, b.gy, gx, gy));
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
          if (ev.ctrlKey || ev.metaKey) {
            const rect = host.getBoundingClientRect();
            const localX = ev.clientX - rect.left;
            const localY = ev.clientY - rect.top;
            const factor = Math.exp(-ev.deltaY * 0.0015);
            const minZ = (app as Application & { __minZoom?: number }).__minZoom ?? MIN_ZOOM_INTERACTIVE;
            const target = Math.max(minZ, Math.min(MAX_ZOOM_INTERACTIVE, world.scale.x * factor));
            zoomAround(localX, localY, target);
          } else {
            world.position.x -= ev.deltaX;
            world.position.y -= ev.deltaY;
            clampWorld();
          }
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
        if (mode === 'preview') {
          const pz = Math.min(
            app.renderer.width / (islandW + previewPadding * 2),
            app.renderer.height / (islandH + previewPadding * 2),
          );
          world.scale.set(pz);
          centerWorld();
        }
      });
      ro.observe(host);

      syncBuildings();
      onReady?.();

      const tickerFn = (ticker: { deltaTime: number }) => {
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
            if (Math.abs(dx) > 0.5) n.facingRight = dx > 0;
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

        if (shakeMag > 0.1) {
          app.stage.position.set((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
          shakeMag *= 0.85;
        } else if (app.stage.position.x !== 0 || app.stage.position.y !== 0) {
          app.stage.position.set(0, 0);
        }

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
    if (footprintOverlayRef.current) {
      layer.removeChild(footprintOverlayRef.current);
      footprintOverlayRef.current.destroy();
      footprintOverlayRef.current = null;
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
    const overlay = overlayLayerRef.current;
    if (!ghost || !overlay) return;
    const type = placingRef.current;
    if (!type) return;
    const baseFp = BUILDINGS[type].footprint ?? { w: 1, h: 1 };
    const fp = rotatedRef.current ? { w: baseFp.h, h: baseFp.w } : baseFp;
    let canPlace = true;
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const tx = gx + dx, ty = gy + dy;
        if (!inBuildZone(tx, ty)) { canPlace = false; break; }
        const overlap = stateRef.current.buildings.some(b => {
          if (b.id === movingRef.current) return false;
          const bfp = BUILDINGS[b.type].footprint ?? { w: 1, h: 1 };
          return tx >= b.gx && tx < b.gx + bfp.w && ty >= b.gy && ty < b.gy + bfp.h;
        });
        if (overlap) { canPlace = false; break; }
      }
      if (!canPlace) break;
    }
    ghost.alpha = canPlace ? 0.7 : 0.3;
    ghost.tint = canPlace ? 0xc0ffc0 : 0xff7070;
    const { sx, sy } = gridToScreen(gx, gy, 0, 0);
    ghost.position.set(sx + (fp.w - 1) * TILE_W / 2, sy + (fp.h - 1) * TILE_H / 2 + TILE_H * 0.4);
    if (!footprintOverlayRef.current) {
      footprintOverlayRef.current = new Graphics();
      footprintOverlayRef.current.zIndex = 99998;
      overlay.addChild(footprintOverlayRef.current);
    }
    const g = footprintOverlayRef.current;
    g.clear();
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const tx = gx + dx, ty = gy + dy;
        const valid = inBuildZone(tx, ty) && !stateRef.current.buildings.some(b => {
          if (b.id === movingRef.current) return false;
          const bfp = BUILDINGS[b.type].footprint ?? { w: 1, h: 1 };
          return tx >= b.gx && tx < b.gx + bfp.w && ty >= b.gy && ty < b.gy + bfp.h;
        });
        g.rect(tx * TILE_W + 2, ty * TILE_H + 2, TILE_W - 4, TILE_H - 4);
        g.fill({ color: valid ? 0x44ff44 : 0xff4444, alpha: 0.3 });
        g.stroke({ color: valid ? 0x44ff44 : 0xff4444, width: 2, alpha: 0.6 });
      }
    }
  }

  function syncBuildings() {
    // TEMP: hide buildings while focusing on ocean
    const HIDE_BUILDINGS = true;
    if (HIDE_BUILDINGS) return;
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
    const terrainRef = terrainCacheRef.current;
    for (const b of current.buildings) {
      const def = BUILDINGS[b.type];
      const fp = footprintOf(b.type);
      const centerGx = b.gx + (fp.w - 1) / 2;
      const centerGy = b.gy + (fp.h - 1) / 2;

      if (b.type === 'tree' && terrainRef?.trees.length) {
        const sheet = terrainRef.trees[(b.gx + b.gy) % terrainRef.trees.length];
        const sprite = new Sprite(sheet.frames[0]);
        sprite.anchor.set(0.5, 0.95);
        const longSide = Math.max(sheet.frameW, sheet.frameH);
        const baseScale = (TILE_W * 1.8) / longSide;
        sprite.scale.set(baseScale);
        const { sx, sy } = gridToScreen(centerGx, centerGy, 0, 0);
        sprite.position.set(sx, sy + TILE_H * 0.4);
        sprite.zIndex = Math.floor(sy + TILE_H * 0.4);
        layer.addChild(sprite);
        continue;
      }
      if (b.type === 'path') {
        // Use stone path tiles from the farm tileset
        const pathTex = terrainRef?.stonePath?.[0] ?? terrainRef?.sandFill;
        const sprite = new Sprite(pathTex || Texture.WHITE);
        if (!pathTex) sprite.tint = 0xc8a878;
        sprite.width = TILE_W * fp.w;
        sprite.height = TILE_H * fp.h;
        sprite.position.set(b.gx * TILE_W, b.gy * TILE_H);
        sprite.zIndex = -1;
        layer.addChild(sprite);
        continue;
      }

      // Check if we have a farm building sprite first
      const farmBuildingTex = terrainRef?.buildings.get(
        b.type === 'house' ? 'farm:house_a' :
        b.type === 'farm' ? 'farm:barn' :
        b.type === 'barracks' ? 'farm:shop' :
        b.type === 'tower' ? 'farm:tower_a' :
        b.type === 'fountain' ? 'farm:house_b' :
        ''
      );

      const isCastle = b.id === 'start-house';
      let tex: Texture | null = null;
      let useFarm = false;

      if (isCastle && terrainRef?.buildings.has('farm:shop')) {
        tex = terrainRef.buildings.get('farm:shop')!;
        useFarm = true;
      } else if (farmBuildingTex) {
        tex = farmBuildingTex;
        useFarm = true;
      } else {
        const slug = isCastle ? 'ts:yellow:castle' : spriteForLevel(b.type, b.level);
        tex = getTopdownTexture(atlas, slug);
      }

      if (!tex || tex === Texture.EMPTY) continue;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.95);
      const longSide = Math.max(tex.width, tex.height);
      const footprintSpan = Math.max(fp.w, fp.h);
      const targetTiles = footprintSpan * (isCastle ? 2.5 : 1.4);
      const baseScale = (TILE_W * targetTiles * (def.spriteScale ?? 1)) / longSide;
      sprite.scale.set(baseScale);
      const { sx, sy } = gridToScreen(centerGx, centerGy, 0, 0);
      const yOffset = isCastle ? -TILE_H * 0.3 : TILE_H * 0.4;
      sprite.position.set(sx, sy + yOffset);
      sprite.zIndex = Math.floor(sy + TILE_H * 0.4);
      layer.addChild(sprite);

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

      const q = current.buildQueue.find(x => x.buildingId === b.id);
      if (q && q.finishesAt > Date.now()) {
        const clock = makeQueueClock();
        clock.position.set(sx, sy - TILE_H * 0.6);
        clock.zIndex = b.gy * 1000 + b.gx + 2;
        clock.label = 'queue-clock';
        overlay.addChild(clock);
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
    sprite.scale.set(1.8);
    const { sx, sy } = gridToScreen(b.gx, b.gy, 0, 0);
    return {
      buildingId: b.id, homeGx: b.gx, homeGy: b.gy,
      x: sx, y: sy, targetX: sx, targetY: sy,
      speed: 0.4 + Math.random() * 0.4,
      sprite, facingRight: true, frameTime: 0, frame: 0,
      villagerSheet: sheet, villagerType,
    };
  }

  return (
    <div
      ref={hostRef}
      className={
        contained
          ? 'absolute inset-0 pointer-events-none'
          : mode === 'preview'
          ? 'absolute inset-0 pointer-events-none'
          : 'fixed inset-0 touch-none'
      }
    />
  );
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
