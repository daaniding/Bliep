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

      // ---- Stage background (ocean blue) ----
      const stageBg = new Graphics();
      const drawBg = () => {
        stageBg.clear();
        stageBg.rect(0, 0, app.renderer.width, app.renderer.height);
        stageBg.fill({ color: 0x5096b8 });
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
        return elevation[ry][rx] >= 2; // sand or grass
      };

      // ---- Bake water tile to a 2×2 block for seamless tiling ----
      // Single 16px→64px tiles show seams at certain zoom levels.
      // Using a 2×2 block (128×128) eliminates visible tile edges.
      const bakedWater = (() => {
        const c = new Container();
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const s = new Sprite(terrain.water);
            s.width = TILE_W;
            s.height = TILE_H;
            s.position.set(dx * TILE_W, dy * TILE_H);
            c.addChild(s);
          }
        }
        const t = app.renderer.generateTexture({ target: c, resolution: 1 });
        if (t.source) t.source.scaleMode = 'nearest';
        c.destroy({ children: true });
        return t;
      })();

      // ---- Water backdrop ----
      const waterLeft = -WATER_MARGIN * TILE_W;
      const waterTop = -WATER_MARGIN * TILE_H;
      const waterW = (GRID_SIZE + WATER_MARGIN * 2) * TILE_W;
      const waterH = (GRID_SIZE + WATER_MARGIN * 2) * TILE_H;
      const water = new TilingSprite({
        texture: bakedWater,
        width: waterW,
        height: waterH,
      });
      water.position.set(waterLeft, waterTop);
      tileLayer.addChild(water);

      // ---- Multi-layer terrain rendering ----
      const seed = state.npcSeed || 1;
      const hash = (x: number, y: number, salt: number): number => {
        let h = (x * 374761393 + y * 668265263 + salt * 2147483647 + seed * 69069) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return ((h >>> 0) % 10000) / 10000;
      };

      // Collect cells by type for rendering + preview bbox
      const grassCells: Array<{ gx: number; gy: number; rx: number; ry: number }> = [];
      const sandCells: Array<{ gx: number; gy: number; rx: number; ry: number }> = [];
      const landCells: Array<{ gx: number; gy: number }> = [];

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          const v = elevation[ry][rx];
          const gx = worldGx(rx), gy = worldGy(ry);
          if (v === 3) {
            grassCells.push({ gx, gy, rx, ry });
            landCells.push({ gx, gy });
          }
          if (v === 2) {
            sandCells.push({ gx, gy, rx, ry });
            landCells.push({ gx, gy });
          }
        }
      }

      // ---- Shallow water gradient (tropical feel) ----
      // Closer to land = lighter/more turquoise, further = deeper blue
      const waterOverlay = new Graphics();
      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] === 1) {
            // Calculate distance to nearest land for gradient
            let minDist = 4;
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nr = ry + dr, nc = rx + dc;
              const nv = elevation[nr]?.[nc] ?? 0;
              if (nv >= 2) { minDist = 1; break; }
            }
            if (minDist > 1) {
              // Check 2-tile radius
              outer: for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                  const nv = elevation[ry+dr]?.[rx+dc] ?? 0;
                  if (nv >= 2) { minDist = 2; break outer; }
                }
              }
            }
            // Gradient: closest = bright turquoise, further = subtle blue
            const color = minDist <= 1 ? 0x7ee8d0 : minDist <= 2 ? 0x6dd8c8 : 0x5cc0c0;
            const alpha = minDist <= 1 ? 0.3 : minDist <= 2 ? 0.22 : 0.15;
            waterOverlay.rect(worldGx(rx) * TILE_W, worldGy(ry) * TILE_H, TILE_W, TILE_H);
            waterOverlay.fill({ color, alpha });
          }
        }
      }
      tileLayer.addChild(waterOverlay);

      // ---- Sand beach strip (1 tile wide) ----
      for (const cell of sandCells) {
        const sprite = new Sprite(terrain.sandFill);
        sprite.anchor.set(0, 0);
        sprite.position.set(cell.gx * TILE_W, cell.gy * TILE_H);
        sprite.width = TILE_W;
        sprite.height = TILE_H;
        // Warm sandy tint
        sprite.tint = 0xFFF5E0;
        tileLayer.addChild(sprite);
      }

      // ---- Grass tiles — tint variation + coast autotile edges ----
      const grassTints = [
        0xFFFFFF, // natural (no tint)
        0xE5FFDD, // cool meadow
        0xFFF0C8, // warm sunlit patch
        0xD5ECC8, // shaded undergrowth
        0xEEFFE0, // bright clearing
      ];
      for (const cell of grassCells) {
        // Check if this grass cell borders sand/water — use coast autotile edge
        const coastIdx = autotileCoastIndex(elevation, cell.rx, cell.ry);
        const isEdge = coastIdx !== null && coastIdx !== 4;

        const tex = isEdge ? terrain.coast[coastIdx] : terrain.grass[0];
        const sprite = new Sprite(tex);
        sprite.anchor.set(0, 0);
        sprite.position.set(cell.gx * TILE_W, cell.gy * TILE_H);
        sprite.width = TILE_W;
        sprite.height = TILE_H;
        if (!isEdge) {
          const regionHash = hash(Math.floor(cell.gx / 5), Math.floor(cell.gy / 5), 42);
          sprite.tint = grassTints[Math.floor(regionHash * grassTints.length)];
        }
        tileLayer.addChild(sprite);
      }

      // ================================================================
      // DECORATION SCATTER — flowers, tufts, mushrooms on GRASS cells
      // Much denser for a lush, lived-in feel
      // ================================================================
      for (const cell of grassCells) {
        const centerDist = Math.hypot(cell.gx - CITY_CENTER.gx, cell.gy - CITY_CENTER.gy);
        const r = hash(cell.gx, cell.gy, 100);
        const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);

        // Grass tufts ~22%
        if (r < 0.22 && terrain.grassTufts.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 101) * terrain.grassTufts.length);
          const sprite = new Sprite(terrain.grassTufts[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 102) - 0.5) * TILE_W * 0.6,
                              sy + (hash(cell.gx, cell.gy, 103) - 0.5) * TILE_H * 0.6);
          sprite.width = TILE_W * 0.65;
          sprite.height = TILE_H * 0.65;
          sprite.alpha = 0.8;
          sprite.zIndex = Math.floor(sprite.position.y) - 1;
          decorLayer.addChild(sprite);
          // Don't continue — allow flowers on top of tufts sometimes
          if (hash(cell.gx, cell.gy, 104) > 0.3) continue;
        }
        // White flowers ~10%
        if (r < 0.32 && r >= 0.22 && terrain.flowersWhite.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 201) * terrain.flowersWhite.length);
          const sprite = new Sprite(terrain.flowersWhite[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 202) - 0.5) * TILE_W * 0.4, sy);
          sprite.width = TILE_W * 0.6;
          sprite.height = TILE_H * 0.6;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
          continue;
        }
        // Purple flowers ~5%
        if (r < 0.37 && r >= 0.32 && terrain.flowersPurple.length > 0) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 301) * terrain.flowersPurple.length);
          const sprite = new Sprite(terrain.flowersPurple[idx]);
          sprite.anchor.set(0.5, 0.8);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 302) - 0.5) * TILE_W * 0.3, sy);
          sprite.width = TILE_W * 0.6;
          sprite.height = TILE_H * 0.6;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
          continue;
        }
        // Mushrooms ~3%, further from center
        if (r < 0.40 && r >= 0.37 && terrain.mushrooms.length > 0 && centerDist > 14) {
          const idx = Math.floor(hash(cell.gx, cell.gy, 401) * terrain.mushrooms.length);
          const sprite = new Sprite(terrain.mushrooms[idx]);
          sprite.anchor.set(0.5, 0.9);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 402) - 0.5) * TILE_W * 0.3, sy);
          sprite.width = TILE_W * 0.5;
          sprite.height = TILE_H * 0.5;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
          continue;
        }
      }

      // ================================================================
      // CATTAILS / REEDS — along grass cells that touch water
      // ================================================================
      if (terrain.cattails.length > 0) {
        for (const cell of grassCells) {
          const n = elevation[cell.ry - 1]?.[cell.rx] ?? 0;
          const s = elevation[cell.ry + 1]?.[cell.rx] ?? 0;
          const w = elevation[cell.ry]?.[cell.rx - 1] ?? 0;
          const e = elevation[cell.ry]?.[cell.rx + 1] ?? 0;
          const touchesWater = n <= 1 || s <= 1 || w <= 1 || e <= 1;
          if (!touchesWater) continue;
          if (hash(cell.gx, cell.gy, 2000) > 0.25) continue;
          const idx = Math.floor(hash(cell.gx, cell.gy, 2001) * terrain.cattails.length);
          const sprite = new Sprite(terrain.cattails[idx]);
          sprite.anchor.set(0.5, 0.9);
          const { sx, sy } = gridToScreen(cell.gx, cell.gy, 0, 0);
          sprite.position.set(sx + (hash(cell.gx, cell.gy, 2002) - 0.5) * TILE_W * 0.5, sy);
          sprite.width = TILE_W * 0.55;
          sprite.height = TILE_H * 0.7;
          sprite.zIndex = Math.floor(sy);
          decorLayer.addChild(sprite);
        }
      }

      // ================================================================
      // TREE GROVES — clustered, not random
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
              const sheet = terrain.trees[pineIdx];
              tex = sheet.frames[0] ?? null;
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
        const treeScale = (TILE_W * tp.scale) / Math.max(tex.width, tex.height);
        sprite.scale.set(treeScale);
        sprite.position.set(px, py);
        sprite.zIndex = Math.floor(py);
        decorLayer.addChild(sprite);
      }

      // No ambient wandering animals — NPCs appear when buildings are placed.

      // ---- Clouds layer ----
      const cloudLayer = new Container();
      world.addChild(cloudLayer);
      const cloudSprites: { sprite: Sprite; speed: number }[] = [];
      if (terrain.clouds.length) {
        for (let i = 0; i < 8; i++) {
          const tex = terrain.clouds[i % terrain.clouds.length];
          const cloud = new Sprite(tex);
          cloud.anchor.set(0.5, 0.5);
          cloud.alpha = 0.85;
          cloud.position.set(
            hash(i, 0, 500) * GRID_SIZE * TILE_W,
            hash(i, 1, 500) * GRID_SIZE * TILE_H,
          );
          cloud.scale.set(1.5 + hash(i, 2, 500) * 1.5);
          cloudLayer.addChild(cloud);
          cloudSprites.push({ sprite: cloud, speed: 0.15 + hash(i, 3, 500) * 0.25 });
        }
      }

      // ---- Wave foam along coastline ----
      // Collect sand cells that border water for foam placement
      const foamCells: Array<{ px: number; py: number; phase: number }> = [];
      for (const cell of sandCells) {
        // Only place foam on sand cells touching water
        const n = elevation[cell.ry - 1]?.[cell.rx] ?? 0;
        const s = elevation[cell.ry + 1]?.[cell.rx] ?? 0;
        const w = elevation[cell.ry]?.[cell.rx - 1] ?? 0;
        const e = elevation[cell.ry]?.[cell.rx + 1] ?? 0;
        if (n > 1 && s > 1 && w > 1 && e > 1) continue; // fully surrounded by land
        const px = cell.gx * TILE_W + TILE_W / 2;
        const py = cell.gy * TILE_H + TILE_H / 2;
        foamCells.push({ px, py, phase: hash(cell.gx, cell.gy, 777) * Math.PI * 2 });
      }

      const foamLayer = new Graphics();
      tileLayer.addChild(foamLayer);

      // ---- Animated water + cloud drift + foam ----
      let waterT = 0;
      const cloudWrapX = GRID_SIZE * TILE_W + 400;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime ?? 1;
        waterT += 0.25 * dt;
        water.tilePosition.set(waterT, waterT * 0.5);
        for (const c of cloudSprites) {
          c.sprite.position.x += c.speed * dt;
          if (c.sprite.position.x > cloudWrapX) c.sprite.position.x = -200;
        }

        // Animate foam — gentle wave pulse
        const t = Date.now() / 1000;
        foamLayer.clear();
        for (const f of foamCells) {
          const wave = Math.sin(t * 1.2 + f.phase) * 0.5 + 0.5; // 0-1 pulse
          const alpha = 0.15 + wave * 0.25;
          const radius = TILE_W * 0.25 + wave * TILE_W * 0.1;
          foamLayer.circle(f.px, f.py, radius);
          foamLayer.fill({ color: 0xFFFFFF, alpha });
        }
      });

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
        app.renderer.width / (28 * TILE_W),
        app.renderer.height / (28 * TILE_H),
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
