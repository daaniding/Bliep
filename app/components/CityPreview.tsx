'use client';

import { useEffect, useState } from 'react';
import { loadCity, type CityState, type PlacedBuilding } from '@/lib/cityStore';
import type { BuildingType } from '@/lib/game/buildings';

/**
 * CityPreview — purely visual isometric snapshot of the player's city,
 * drawn as inline SVG. Reads buildings from loadCity() and projects
 * them onto an iso plane. Not interactive; it's the "Arena" of the
 * home dashboard — something alive to look at while you decide what
 * to do.
 *
 * No canvas, no 3D, no physics. Each building is:
 *   - a ground-shadow diamond
 *   - a stacked extruded box with a distinct roof
 *   - an outline stroke for Clash-style chunkiness
 *
 * Colours mirror the warm-night palette (gold / amber / deep navy)
 * so it sits cleanly on top of the video hero.
 */

const TILE_W = 34;
const TILE_H = 17;
const GRID_PAD = 1; // one extra tile around the building bbox

type Proj = { x: number; y: number };

function project(gx: number, gy: number): Proj {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

interface Palette {
  wall: string;
  wallShade: string;
  roof: string;
  roofShine: string;
  outline: string;
}

const PALETTES: Record<BuildingType, Palette> = {
  house: {
    wall:      '#d2a06a',
    wallShade: '#8a5a2a',
    roof:      '#c0392b',
    roofShine: '#e67260',
    outline:   '#1a0f05',
  },
  farm: {
    wall:      '#8a6a3a',
    wallShade: '#4a3315',
    roof:      '#6aa84b',
    roofShine: '#8cc76c',
    outline:   '#1a0f05',
  },
  barracks: {
    wall:      '#6b6b6b',
    wallShade: '#3a3a3a',
    roof:      '#3d7a3f',
    roofShine: '#5ea05c',
    outline:   '#0d0a06',
  },
  wall: {
    wall:      '#8e8472',
    wallShade: '#4a4234',
    roof:      '#a89878',
    roofShine: '#c9ba94',
    outline:   '#1a0f05',
  },
};

function Building({
  b,
  origin,
}: {
  b: PlacedBuilding;
  origin: Proj;
}) {
  const p = project(b.gx, b.gy);
  const cx = origin.x + p.x;
  const cy = origin.y + p.y;

  // Height grows with level: 22 / 30 / 38
  const H = 14 + b.level * 8;
  const W = TILE_W;
  const D = TILE_H;

  const pal = PALETTES[b.type];

  // Diamond ground tile (under the building)
  const tile = [
    `${cx},${cy - D / 2}`,
    `${cx + W / 2},${cy}`,
    `${cx},${cy + D / 2}`,
    `${cx - W / 2},${cy}`,
  ].join(' ');

  // Top face (roof)
  const roofTop = [
    `${cx},${cy - D / 2 - H}`,
    `${cx + W / 2},${cy - H}`,
    `${cx},${cy + D / 2 - H}`,
    `${cx - W / 2},${cy - H}`,
  ].join(' ');

  // Right wall
  const wallR = [
    `${cx + W / 2},${cy}`,
    `${cx + W / 2},${cy - H}`,
    `${cx},${cy + D / 2 - H}`,
    `${cx},${cy + D / 2}`,
  ].join(' ');

  // Left wall
  const wallL = [
    `${cx - W / 2},${cy}`,
    `${cx - W / 2},${cy - H}`,
    `${cx},${cy + D / 2 - H}`,
    `${cx},${cy + D / 2}`,
  ].join(' ');

  // A small window on the left wall for houses/barracks
  const winX = cx - W / 4;
  const winY = cy - H / 2;
  const showWindow = b.type === 'house' || b.type === 'barracks';

  // A tiny flag on top of the roof for the highest-level building type
  const showFlag = b.level >= 3;

  return (
    <g>
      {/* Soft ground shadow */}
      <polygon
        points={tile}
        fill="rgba(0, 0, 0, 0.45)"
        transform={`translate(2 3)`}
      />
      <polygon
        points={tile}
        fill="rgba(12, 10, 6, 0.55)"
        stroke={pal.outline}
        strokeWidth={1.4}
      />
      {/* Walls */}
      <polygon points={wallL} fill={pal.wallShade} stroke={pal.outline} strokeWidth={1.4} />
      <polygon points={wallR} fill={pal.wall}      stroke={pal.outline} strokeWidth={1.4} />
      {/* Roof */}
      <polygon points={roofTop} fill={pal.roof} stroke={pal.outline} strokeWidth={1.4} />
      {/* Roof highlight stripe */}
      <polygon
        points={`${cx},${cy - D / 2 - H} ${cx + W / 2},${cy - H} ${cx},${cy - H + 1}`}
        fill={pal.roofShine}
        opacity={0.6}
      />
      {/* Window */}
      {showWindow && (
        <rect
          x={winX - 3}
          y={winY - 3}
          width={6}
          height={6}
          fill="#fde3a0"
          stroke={pal.outline}
          strokeWidth={1}
        />
      )}
      {/* Level-3 flag */}
      {showFlag && (
        <g>
          <line
            x1={cx}
            y1={cy - D / 2 - H}
            x2={cx}
            y2={cy - D / 2 - H - 10}
            stroke={pal.outline}
            strokeWidth={1.4}
          />
          <polygon
            points={`${cx},${cy - D / 2 - H - 10} ${cx + 6},${cy - D / 2 - H - 8} ${cx},${cy - D / 2 - H - 6}`}
            fill="#c0392b"
            stroke={pal.outline}
            strokeWidth={1}
          />
        </g>
      )}
    </g>
  );
}

// Ground tiles — checkerboard diamonds under and around the city
function Ground({
  minX,
  maxX,
  minY,
  maxY,
  origin,
}: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  origin: Proj;
}) {
  const tiles: { key: string; points: string; fill: string }[] = [];
  for (let gx = minX - GRID_PAD; gx <= maxX + GRID_PAD; gx++) {
    for (let gy = minY - GRID_PAD; gy <= maxY + GRID_PAD; gy++) {
      const p = project(gx, gy);
      const cx = origin.x + p.x;
      const cy = origin.y + p.y;
      const points = [
        `${cx},${cy - TILE_H / 2}`,
        `${cx + TILE_W / 2},${cy}`,
        `${cx},${cy + TILE_H / 2}`,
        `${cx - TILE_W / 2},${cy}`,
      ].join(' ');
      const alt = (gx + gy) % 2 === 0;
      tiles.push({
        key: `${gx},${gy}`,
        points,
        fill: alt ? '#2e6235' : '#255027',
      });
    }
  }
  return (
    <g>
      {tiles.map((t) => (
        <polygon
          key={t.key}
          points={t.points}
          fill={t.fill}
          stroke="#0d1a0b"
          strokeWidth={0.6}
          opacity={0.95}
        />
      ))}
    </g>
  );
}

export default function CityPreview() {
  const [city, setCity] = useState<CityState | null>(null);

  useEffect(() => {
    setCity(loadCity());
    const id = window.setInterval(() => setCity(loadCity()), 2000);
    return () => clearInterval(id);
  }, []);

  if (!city) return null;
  const buildings = city.buildings.length > 0
    ? city.buildings
    : [{ id: 'seed', type: 'house' as BuildingType, gx: 7, gy: 7, level: 1 }];

  // Bounding box of the buildings on the grid.
  const minX = Math.min(...buildings.map((b) => b.gx));
  const maxX = Math.max(...buildings.map((b) => b.gx));
  const minY = Math.min(...buildings.map((b) => b.gy));
  const maxY = Math.max(...buildings.map((b) => b.gy));

  // Centre the projected bbox inside the viewBox.
  const topLeft = project(minX - GRID_PAD, maxY + GRID_PAD);
  const topRight = project(maxX + GRID_PAD, minY - GRID_PAD);
  const bottom = project(maxX + GRID_PAD, maxY + GRID_PAD);
  const top = project(minX - GRID_PAD, minY - GRID_PAD);

  const worldMinX = Math.min(topLeft.x, topRight.x, bottom.x, top.x) - TILE_W / 2;
  const worldMaxX = Math.max(topLeft.x, topRight.x, bottom.x, top.x) + TILE_W / 2;
  const worldMinY = Math.min(topLeft.y, topRight.y, bottom.y, top.y) - 60;
  const worldMaxY = Math.max(topLeft.y, topRight.y, bottom.y, top.y) + TILE_H / 2 + 4;

  // Origin so that the projected bbox sits centred around (0,0) of
  // our viewBox math.
  const origin: Proj = {
    x: -(worldMinX + worldMaxX) / 2,
    y: -(worldMinY + worldMaxY) / 2,
  };

  const vbW = worldMaxX - worldMinX;
  const vbH = worldMaxY - worldMinY;
  const viewBox = `${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`;

  // Paint-order: buildings further back first. Back = smaller (gx+gy).
  const sorted = [...buildings].sort(
    (a, b) => a.gx + a.gy - (b.gx + b.gy)
  );

  return (
    <div className="city-preview" aria-hidden>
      {/* Parchment-framed card that holds the iso scene */}
      <div className="card">
        <div className="card-inner">
          <div className="card-header font-display">
            <span className="lip">◆</span>
            <span>UW RIJK</span>
            <span className="lip">◆</span>
          </div>
          <svg
            viewBox={viewBox}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block' }}
          >
            <defs>
              <radialGradient id="cp-halo" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="rgba(255, 220, 140, 0.35)" />
                <stop offset="70%" stopColor="rgba(255, 220, 140, 0)" />
              </radialGradient>
            </defs>
            <rect
              x={-vbW / 2}
              y={-vbH / 2}
              width={vbW}
              height={vbH}
              fill="url(#cp-halo)"
            />
            <Ground
              minX={minX}
              maxX={maxX}
              minY={minY}
              maxY={maxY}
              origin={origin}
            />
            {sorted.map((b) => (
              <Building key={b.id} b={b} origin={origin} />
            ))}
          </svg>
          <div className="card-footer font-display">
            {buildings.length} gebouw{buildings.length === 1 ? '' : 'en'}
          </div>
        </div>
      </div>

      <style jsx>{`
        .city-preview {
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.75));
          pointer-events: none;
          animation: cpFadeUp 600ms ease-out 150ms both;
        }
        .card {
          position: relative;
          padding: 3px;
          border-radius: 18px;
          background: linear-gradient(
            180deg,
            #fff6dc 0%,
            #f0b840 25%,
            #8a5a10 75%,
            #3d2410 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 3px 0 #1a0f05,
            0 10px 22px rgba(0, 0, 0, 0.55);
        }
        .card-inner {
          position: relative;
          border-radius: 15px;
          overflow: hidden;
          background: linear-gradient(
            180deg,
            #12213f 0%,
            #0b1630 55%,
            #060c1f 100%
          );
          border: 2px solid #0d0a06;
          padding: 6px 8px 8px;
          aspect-ratio: 4 / 3;
          display: flex;
          flex-direction: column;
        }
        .card-inner::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 80% 55% at 50% 0%,
            rgba(255, 220, 140, 0.12) 0%,
            rgba(255, 220, 140, 0) 70%
          );
          pointer-events: none;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 11px;
          color: #fdd069;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-shadow: 0 1.5px 0 #0d0a06;
          margin-bottom: 2px;
          flex: 0 0 auto;
        }
        .lip {
          font-size: 9px;
          opacity: 0.75;
        }
        .card-inner > svg {
          flex: 1 1 auto;
          min-height: 0;
        }
        .card-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 4px;
          text-align: center;
          font-size: 9px;
          color: #fdd069;
          opacity: 0.7;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }

        @keyframes cpFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
