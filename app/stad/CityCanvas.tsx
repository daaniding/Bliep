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
import {
  loadTinyswordsTerrain,
  TILEMAP_CELL,
} from '@/lib/game/tinyswordsTerrain';
import { parseElevation, MAP_COLS, MAP_ROWS } from '@/lib/game/staticMap';
import { autotileGrassSlot } from '@/lib/game/autotile';
import { loadMinifolks, ANIMAL_KINDS, type AnimalKind, type MinifolksAnimals } from '@/lib/game/minifolks';
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
import { seedDecor, isRoadTile, type DecorTile } from '@/lib/game/decor';
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
  /** If true, the footprint is rotated 90° (w↔h swapped). */
  rotated?: boolean;
  /** Building being moved (shows ghost + hides original). */
  movingBuildingId?: string | null;
  /** When true, host fills its container instead of the viewport. */
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

/** Tiles of open water drawn around the grass island on each side. */
const WATER_MARGIN = 16;

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
  const terrainCacheRef = useRef<Awaited<ReturnType<typeof loadTinyswordsTerrain>> | null>(null);
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

    // Wait until the host has a non-zero size before initializing Pixi,
    // otherwise resizeTo: host reads 0x0 and the canvas is invisible.
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
      // Safety timeout — resolve anyway after 500ms
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
      // Force renderer to current host size in case resizeTo didn't catch it
      app.renderer.resize(initW, initH);
      if (cancelled) {
        app.destroy(true, { children: true, texture: false });
        return;
      }
      host.appendChild(app.canvas);

      const [atlas, terrain, animals] = await Promise.all([
        loadTopdownAtlas(),
        loadTinyswordsTerrain(),
        loadMinifolks(),
      ]);
      if (cancelled) return;
      atlasRef.current = atlas;
      terrainCacheRef.current = terrain;

      // Water-blue stage background so the dark page bg never bleeds through
      // at the edges before the map tiles finish placing.
      const stageBg = new Graphics();
      const drawBg = () => {
        stageBg.clear();
        stageBg.rect(0, 0, app.renderer.width, app.renderer.height);
        stageBg.fill({ color: 0x4a9bb8 });
      };
      drawBg();
      app.stage.addChild(stageBg);

      const world = new Container();
      // Dusk filter only applies in preview mode (home hero card) and
      // only to the non-animal layers, so /stad itself stays bright and
      // animals never flicker from per-frame filter re-composite cycles.
      const duskFilter = mode === 'preview' ? new ColorMatrixFilter() : null;
      if (duskFilter) {
        duskFilter.brightness(0.78, false);
      }
      app.stage.addChild(world);
      worldRef.current = world;

      const tileLayer = new Container();
      world.addChild(tileLayer);
      tileLayerRef.current = tileLayer;
      if (duskFilter) tileLayer.filters = [duskFilter];

      const decorLayer = new Container();
      decorLayer.sortableChildren = true;
      world.addChild(decorLayer);
      decorLayerRef.current = decorLayer;
      if (duskFilter) decorLayer.filters = [duskFilter];

      // Dedicated layer for wandering animals. No sortableChildren — the
      // previous flicker was caused by the layer re-sorting its children
      // on every tick as sprite positions changed inside a sortable
      // parent. Keep animals isolated with a fixed child order.
      const animalLayer = new Container();
      animalLayer.sortableChildren = false;
      world.addChild(animalLayer);

      // Single y-sorted entity layer for buildings + NPCs so they correctly
      // overlap based on screen Y (a villager walking south of a house should
      // appear in front, walking north should be hidden behind it).
      const buildingLayer = new Container();
      buildingLayer.sortableChildren = true;
      world.addChild(buildingLayer);
      buildingLayerRef.current = buildingLayer;
      if (duskFilter) buildingLayer.filters = [duskFilter];
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

      // ---- Tiny Swords terrain ----
      // Pixi v8 TilingSprite ignores source frames (tiles the whole source),
      // so spritesheet cells must be baked to standalone textures via
      // renderer.generateTexture.
      const bakeCell = (col: number, row: number): Texture => {
        const framed = new Texture({
          source: terrain.tilemap.source,
          frame: new Rectangle(col * TILEMAP_CELL, row * TILEMAP_CELL, TILEMAP_CELL, TILEMAP_CELL),
        });
        const s = new Sprite(framed);
        const t = app.renderer.generateTexture({ target: s, resolution: 1 });
        if (t.source) t.source.scaleMode = 'nearest';
        s.destroy();
        return t;
      };

      // (grass + cliff textures are baked on-demand via bakedOf in the
      // static-map loop below)

      // ---- Static map: hand-designed Tiny Swords island + autotile ----
      const elevation = parseElevation();

      // Bake every autotile cell we need once, cache by "col,row" key.
      // 9 flat (0..2, 0..2) + 9 raised (4..6, 0..2) + 1 cliff wall (5,5)
      // = 19 baked textures max.
      const bakedTiles = new Map<string, Texture>();
      const bakedOf = (col: number, row: number): Texture => {
        const key = `${col},${row}`;
        let t = bakedTiles.get(key);
        if (!t) {
          t = bakeCell(col, row);
          bakedTiles.set(key, t);
        }
        return t;
      };

      // Center the 44×30 static map on CITY_CENTER in the bigger 192×192
      // game grid so existing building coordinates roughly still line up.
      const mapOffsetGx = CITY_CENTER.gx - Math.floor(MAP_COLS / 2);
      const mapOffsetGy = CITY_CENTER.gy - Math.floor(MAP_ROWS / 2);
      const worldGx = (rx: number) => mapOffsetGx + rx;
      const worldGy = (ry: number) => mapOffsetGy + ry;

      const landAtWorld = (wgx: number, wgy: number): boolean => {
        const rx = wgx - mapOffsetGx;
        const ry = wgy - mapOffsetGy;
        if (rx < 0 || rx >= MAP_COLS || ry < 0 || ry >= MAP_ROWS) return false;
        return elevation[ry][rx] > 0;
      };

      // Water backdrop covers the whole extended map area.
      const waterTex = terrain.water;
      const waterLeft = -WATER_MARGIN * TILE_W;
      const waterTop = -WATER_MARGIN * TILE_H;
      const waterW = (GRID_SIZE + WATER_MARGIN * 2) * TILE_W;
      const waterH = (GRID_SIZE + WATER_MARGIN * 2) * TILE_H;
      const water = new TilingSprite({
        texture: waterTex,
        width: waterW,
        height: waterH,
      });
      water.position.set(waterLeft, waterTop);
      tileLayer.addChild(water);

      // ---- Grass rendering from the elevation grid ----
      // Flat only — elevation/plateau system removed per user feedback
      // ("hoogteverschillen werken niet"). Grass cells get a per-tile tint
      // variation from a small dusk-green palette so the ground reads
      // alive instead of a flat repeating texture.
      // Dusk-tone grass palette — slightly darker + desaturated so the
      // map reads schemerig without a global color filter.
      const GRASS_TINTS = [
        0x7ca054,
        0x6e9048,
        0x5e8040,
        0x78985a,
        0x688848,
        0x5a7a3e,
      ];
      const hashForTint = (gx: number, gy: number): number => {
        let h = (gx * 374761393 + gy * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return (h >>> 0) % GRASS_TINTS.length;
      };

      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          const slot = autotileGrassSlot(elevation, rx, ry);
          if (!slot) continue;
          const tex = bakedOf(slot.col, slot.row);
          const sprite = new Sprite(tex);
          sprite.anchor.set(0, 0);
          sprite.position.set(worldGx(rx) * TILE_W, worldGy(ry) * TILE_H);
          sprite.tint = GRASS_TINTS[hashForTint(rx, ry)];
          tileLayer.addChild(sprite);
        }
      }

      // ---- Water foam: big soft foam patches around the WHOLE coast ----
      // Place one animated foam sprite on every water cell that has a
      // grass neighbour. Each foam is 3+ tiles wide with very low alpha
      // so overlapping sprites blend into a soft sea-foam ring instead of
      // a dotted outline.
      const foamSheet = terrain.waterFoam;
      let foamCount = 0;
      const MAX_FOAM = 120;
      for (let ry = 0; ry < MAP_ROWS && foamCount < MAX_FOAM; ry++) {
        for (let rx = 0; rx < MAP_COLS && foamCount < MAX_FOAM; rx++) {
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
          foam.position.set(
            worldGx(rx) * TILE_W + TILE_W * 0.5,
            worldGy(ry) * TILE_H + TILE_H * 0.5,
          );
          foam.scale.set((TILE_W * 3.2) / foamSheet.frameW);
          foam.alpha = 0.22;
          tileLayer.addChild(foam);
          foamCount++;
        }
      }

      // Build zone = the island itself (no ring needed, coast is the border)

      // ---- Decor over the static map ----
      // Everything removed — the player paints decor/buildings/paths on
      // the grid themselves. Only grass + coast + animals + clouds remain
      // as the natural baseline.

      const seed = state.npcSeed || 1;
      const hash = (x: number, y: number, salt: number): number => {
        let h = (x * 374761393 + y * 668265263 + salt * 2147483647 + seed * 69069) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return ((h >>> 0) % 10000) / 10000;
      };

      let animatedDecorCount = 0;
      const MAX_ANIMATED_DECOR = 320;

      // Collect land cells once — used for wander spawning + preview bbox.
      const landCells: Array<{ gx: number; gy: number }> = [];
      for (let ry = 0; ry < MAP_ROWS; ry++) {
        for (let rx = 0; rx < MAP_COLS; rx++) {
          if (elevation[ry][rx] > 0) {
            landCells.push({ gx: worldGx(rx), gy: worldGy(ry) });
          }
        }
      }

      // All ambient decor (trees/bushes/rocks/stumps/gold/etc) removed —
      // the player now PLACES these things as buildings, so a grass-tile
      // is either empty or has a single buildable block on it. No more
      // procedural scatter.

      // Tiny Swords sheep removed — replaced by Minifolks forest animals
      // (bunny/deer/fox/boar/wolf/bear/bird) that actually wander around
      // the island. Each spawn is an AnimatedSprite with a moving target;
      // the ticker steps them toward it and flips on movement direction.
      type Wanderer = {
        sprite: AnimatedSprite;
        x: number;
        y: number;
        tx: number;
        ty: number;
        speed: number;
        restT: number;
        baseScaleX: number;
      };
      const wanderers: Wanderer[] = [];
      const ANIMAL_COUNT = 18;
      const KIND_SIZE: Record<AnimalKind, number> = {
        bird:  0.7,
        bunny: 0.85,
        deer:  1.4,
        fox:   1.25,
        boar:  1.3,
        wolf:  1.4,
        bear:  1.7,
      };
      const pickRandomLandWorld = (salt: number): { gx: number; gy: number } | null => {
        const c = landCells[Math.floor(hash(salt, 0, 900) * landCells.length)];
        return c ?? null;
      };
      for (let i = 0; i < ANIMAL_COUNT; i++) {
        if (animatedDecorCount >= MAX_ANIMATED_DECOR) break;
        const kind = ANIMAL_KINDS[i % ANIMAL_KINDS.length];
        const sheet = animals[kind];
        if (!sheet.frames.length) continue;
        const c = pickRandomLandWorld(i * 7 + 11);
        if (!c) continue;
        const sprite = new AnimatedSprite(sheet.frames);
        sprite.animationSpeed = 0.1 + hash(i, 0, 1001) * 0.05;
        sprite.loop = true;
        sprite.play();
        sprite.anchor.set(0.5, 0.9);
        const { sx, sy } = gridToScreen(c.gx, c.gy, 0, 0);
        const pxX = sx;
        const pxY = sy;
        sprite.position.set(pxX, pxY);
        const baseScaleX = (TILE_W * KIND_SIZE[kind]) / sheet.frameW;
        sprite.scale.set(baseScaleX, baseScaleX);
        // Animals live in the dedicated animalLayer (sortableChildren
        // disabled) so position updates don't retrigger parent sorts.
        animalLayer.addChild(sprite);
        animatedDecorCount++;
        wanderers.push({
          sprite,
          x: pxX,
          y: pxY,
          tx: pxX,
          ty: pxY,
          speed: 0.2 + hash(i, 0, 1002) * 0.25,
          restT: 60 + Math.random() * 120,
          baseScaleX,
        });
      }

      // Wander update — each animal steps toward its target, stops briefly,
      // then picks a new nearby land target. Collision with buildings is
      // checked via a live Set keyed by "gx,gy" which is rebuilt each tick
      // from state.buildings so newly placed buildings immediately block
      // movement.
      const wanderLandCheck = (px: number, py: number): boolean => {
        const gx = Math.floor(px / TILE_W);
        const gy = Math.floor(py / TILE_H);
        if (!landAtWorld(gx, gy)) return false;
        const occupied = occupiedCellsRef.current;
        if (occupied.has(`${gx},${gy}`)) return false;
        return true;
      };
      let occupiedRebuildT = 0;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime ?? 1;
        occupiedRebuildT -= dt;
        if (occupiedRebuildT <= 0) {
          const set = new Set<string>();
          for (const b of stateRef.current.buildings) {
            const fp = footprintOf(b.type);
            for (let dy = 0; dy < fp.h; dy++) {
              for (let dx = 0; dx < fp.w; dx++) {
                set.add(`${b.gx + dx},${b.gy + dy}`);
              }
            }
          }
          occupiedCellsRef.current = set;
          occupiedRebuildT = 30;
        }
        for (const w of wanderers) {
          if (w.restT > 0) {
            w.restT -= dt;
            continue;
          }
          const dx = w.tx - w.x;
          const dy = w.ty - w.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1) {
            // Pick a new nearby target on land
            for (let tries = 0; tries < 6; tries++) {
              const r = 1.5 + Math.random() * 3.5;
              const a = Math.random() * Math.PI * 2;
              const nx = w.x + Math.cos(a) * r * TILE_W;
              const ny = w.y + Math.sin(a) * r * TILE_H;
              if (wanderLandCheck(nx, ny)) {
                w.tx = nx;
                w.ty = ny;
                break;
              }
            }
            w.restT = 30 + Math.random() * 90;
            continue;
          }
          const step = w.speed * dt;
          const moveX = (dx / dist) * step;
          const moveY = (dy / dist) * step;
          w.x += moveX;
          w.y += moveY;
          w.sprite.position.set(w.x, w.y);
          if (Math.abs(moveX) > 0.05) {
            w.sprite.scale.x = moveX < 0 ? -w.baseScaleX : w.baseScaleX;
          }
        }
      });

      // Loose ground-items (tools, meat, wood drops) removed — they read
      // as "random stuff plopped on grass" rather than coherent landscape.

      // Water rocks + ducks removed too — water is clean now.

      // ---- Clouds layer — drifting above everything ----
      const cloudLayer = new Container();
      world.addChild(cloudLayer);
      const cloudSprites: { sprite: Sprite; speed: number }[] = [];
      if (terrain.clouds.length) {
        for (let i = 0; i < 8; i++) {
          const tex = terrain.clouds[i % terrain.clouds.length];
          const cloud = new Sprite(tex);
          cloud.anchor.set(0.5, 0.5);
          cloud.alpha = 0.85;
          const x = hash(i, 0, 500) * GRID_SIZE * TILE_W;
          const y = hash(i, 1, 500) * GRID_SIZE * TILE_H;
          cloud.position.set(x, y);
          cloud.scale.set(1.5 + hash(i, 2, 500) * 1.5);
          cloudLayer.addChild(cloud);
          cloudSprites.push({ sprite: cloud, speed: 0.15 + hash(i, 3, 500) * 0.25 });
        }
      }

      // ---- Animated water + cloud drift ----
      let waterT = 0;
      const cloudWrapX = GRID_SIZE * TILE_W + 400;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime ?? 1;
        waterT += 0.25 * dt;
        water.tilePosition.set(waterT, waterT * 0.5);
        for (const c of cloudSprites) {
          c.sprite.position.x += c.speed * dt;
          if (c.sprite.position.x > cloudWrapX) {
            c.sprite.position.x = -200;
          }
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
      // Compute the actual grass bounding box in world pixels so the preview
      // can frame the real island instead of the whole 192×192 grid.
      let islandMinX = Infinity, islandMaxX = -Infinity, islandMinY = Infinity, islandMaxY = -Infinity;
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
        // Always center on the actual island body, not the grid center,
        // so home preview frames the grass instead of empty water.
        const z = world.scale.x || 1;
        world.position.set(
          app.renderer.width / 2 - islandCenterPxX * z,
          app.renderer.height / 2 - islandCenterPxY * z,
        );
      };
      centerWorld();
      // Extended map dims (grass island + water margin on all sides). Used
      // for zoom/pan bounds so the water margin is visible and pannable.
      const extMapW = (GRID_SIZE + WATER_MARGIN * 2) * TILE_W;
      const extMapH = (GRID_SIZE + WATER_MARGIN * 2) * TILE_H;
      // Minimum zoom = "fit whole extended map in view" (includes water)
      const minZoomFit = Math.max(
        app.renderer.width / extMapW,
        app.renderer.height / extMapH,
      );
      // Default interactive view: ~20 tiles wide so users see part of the
      // surrounding water margin (island in the sea). Pinch-in for buildings,
      // pinch-out to see the full map.
      // Default: show the whole island + a ring of water around it.
      const defaultZoom = Math.min(
        app.renderer.width / (24 * TILE_W),
        app.renderer.height / (24 * TILE_H),
      );
      // Preview (used by home CityPreview): auto-fits the ACTUAL grass
      // bounding box + small water ring, centered on the grass — not on
      // the grid center. The old approach centered on CITY_CENTER which
      // didn't line up with the grass body in the static elevation grid.
      const previewPadding = 4 * TILE_W;
      const previewZoom = Math.min(
        app.renderer.width / (islandW + previewPadding * 2),
        app.renderer.height / (islandH + previewPadding * 2),
      );
      const minZoom = Math.max(minZoomFit, MIN_ZOOM_INTERACTIVE);
      const startZoom = mode === 'preview' ? Math.max(previewZoom, minZoomFit) : Math.max(defaultZoom, minZoom);
      world.scale.set(startZoom);
      // Center on the actual grass body so the island sits in the middle
      // of the viewport — not on CITY_CENTER which may fall on water if
      // the static map body is offset within the grid.
      const ccx = islandCenterPxX;
      const ccy = islandCenterPxY;
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
          // Allow panning into the water margin around the grass island.
          const mapW = extMapW * world.scale.x;
          const mapH = extMapH * world.scale.y;
          const viewW = app.renderer.width;
          const viewH = app.renderer.height;
          // World-space left edge of the extended map is -WATER_MARGIN*TILE_W.
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
          // Ctrl/Cmd+wheel zooms (matches browser "pinch-zoom" convention),
          // plain wheel pans. Fixes the old behaviour where trying to scroll
          // around the map would zoom you out instead.
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
          // Recompute the preview zoom against the new viewport so the
          // whole island fits whenever the hero card resizes.
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

    // Check if ALL footprint tiles are valid
    let canPlace = true;
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const tx = gx + dx, ty = gy + dy;
        if (!inBuildZone(tx, ty)) { canPlace = false; break; }
        // Check overlap with other buildings (skip the one being moved)
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

    // Draw footprint overlay
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

      // Special-case decor blocks (tree, path) — they don't use the
      // Tiny Swords building atlas, they render directly from terrain
      // sprites or a Graphics fill.
      const fp = footprintOf(b.type);
      // Center of the building's footprint rectangle (in grid coords).
      // A 2×2 at (gx, gy) centers at (gx+0.5, gy+0.5); 1×1 centers at (gx, gy).
      const centerGx = b.gx + (fp.w - 1) / 2;
      const centerGy = b.gy + (fp.h - 1) / 2;

      if (b.type === 'tree' && terrainRef?.trees.length) {
        const sheet = terrainRef.trees[(b.gx + b.gy) % terrainRef.trees.length];
        const sprite = new Sprite(sheet.frames[0]);
        sprite.anchor.set(0.5, 0.95);
        const longSide = Math.max(sheet.frameW, sheet.frameH);
        const baseScale = (TILE_W * 1.2) / longSide;
        sprite.scale.set(baseScale);
        const { sx, sy } = gridToScreen(centerGx, centerGy, 0, 0);
        sprite.position.set(sx, sy + TILE_H * 0.4);
        sprite.zIndex = Math.floor(sy + TILE_H * 0.4);
        layer.addChild(sprite);
        continue;
      }
      if (b.type === 'path') {
        // Path is a solid sand-colored tile spanning its footprint.
        const sprite = new Sprite(Texture.WHITE);
        sprite.tint = 0xc8a878;
        sprite.width = TILE_W * fp.w;
        sprite.height = TILE_H * fp.h;
        sprite.position.set(b.gx * TILE_W, b.gy * TILE_H);
        sprite.zIndex = -1;
        layer.addChild(sprite);
        continue;
      }

      // Start-house always shows castle sprite — bigger and higher
      const isCastle = b.id === 'start-house';
      const slug = isCastle ? 'ts:yellow:castle' : spriteForLevel(b.type, b.level);
      const tex = getTopdownTexture(atlas, slug);
      if (!tex || tex === Texture.EMPTY) continue;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.95);
      const longSide = Math.max(tex.width, tex.height);
      const footprintSpan = Math.max(fp.w, fp.h);
      const targetTiles = footprintSpan * (isCastle ? 2.5 : 1.4); // castle much bigger
      const baseScale = (TILE_W * targetTiles * (def.spriteScale ?? 1)) / longSide;
      sprite.scale.set(baseScale);
      const { sx, sy } = gridToScreen(centerGx, centerGy, 0, 0);
      const yOffset = isCastle ? -TILE_H * 0.3 : TILE_H * 0.4; // castle higher up
      sprite.position.set(sx, sy + yOffset);
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

      // NPC per building removed — those old Fan-tasy villagers walked
      // stiffly ("mensen lopen zo raar"). Minifolks animals now handle
      // wandering life on the island.
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

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
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
