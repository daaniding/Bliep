'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadCity, processBuildQueue, CITY_CHANGED_EVENT, type CityState, type PlacedBuilding } from '@/lib/cityStore';
import { spriteForLevel, BUILDINGS } from '@/lib/game/buildings';

/**
 * Stylized HTML/CSS preview of the city — fast, lightweight, no Pixi instance.
 * Shows the actual buildings as sprite thumbnails on a grass field with
 * animated villagers walking around. Tap to enter /stad.
 */
export default function CityPreview() {
  const [state, setState] = useState<CityState | null>(null);

  useEffect(() => {
    setState(processBuildQueue(loadCity()));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setState(detail as CityState);
    };
    window.addEventListener(CITY_CHANGED_EVENT, onChange as EventListener);
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setState(s => (s ? processBuildQueue(s) : loadCity()));
    }, 10_000);
    return () => {
      window.removeEventListener(CITY_CHANGED_EVENT, onChange as EventListener);
      clearInterval(id);
    };
  }, []);

  if (!state) return <CityCard buildings={[]} cityLevel={0} buildingCount={0} />;

  const cityLevel = state.buildings.reduce((s, b) => s + b.level, 0);
  return <CityCard buildings={state.buildings} cityLevel={cityLevel} buildingCount={state.buildings.length} />;
}

function CityCard({ buildings, cityLevel, buildingCount }: { buildings: PlacedBuilding[]; cityLevel: number; buildingCount: number }) {
  // Compute building positions as percentages relative to the build zone
  // (32x32 grid, build zone is 24x24 centered). Map gx 4..28 → 5..95% of card.
  const placed = buildings.map(b => {
    const x = ((b.gx - 4) / 24) * 100;
    const y = ((b.gy - 4) / 24) * 100;
    return { ...b, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  });

  return (
    <Link
      href="/stad"
      className="relative block w-full h-full group overflow-hidden rounded-2xl border-4 border-[#1a0f05] shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_2px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-transform"
      aria-label="Open je stad"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 60%, #82b264 0%, #6b9c52 50%, #5e8a48 100%)',
      }}
    >
      {/* Grass texture overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #aacc88 2px, transparent 3px), ' +
            'radial-gradient(circle at 70% 60%, #aacc88 2px, transparent 3px), ' +
            'radial-gradient(circle at 40% 80%, #aacc88 2px, transparent 3px), ' +
            'radial-gradient(circle at 85% 25%, #aacc88 2px, transparent 3px)',
          backgroundSize: '40px 40px, 60px 60px, 35px 35px, 50px 50px',
        }}
      />

      {/* Decorative tree border (top + bottom + sides) */}
      <TreeBorder />

      {/* The chest in the center — pulsing */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '48%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center text-2xl"
          style={{ animation: 'chestBob 2s ease-in-out infinite', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
        >
          🎁
        </div>
      </div>

      {/* Buildings rendered as sprite thumbs */}
      {placed.map((b, i) => {
        const slug = spriteForLevel(b.type, b.level);
        return (
          <BuildingThumb key={b.id} slug={slug} x={b.x} y={b.y} index={i} />
        );
      })}

      {/* Walking villagers */}
      <Villagers count={Math.max(2, Math.min(6, buildingCount))} />

      {/* Top label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
        <span className="text-base">🏰</span>
        <p className="font-display text-[11px] uppercase tracking-widest text-[#fdd069] text-stroke-dark">
          Je Rijk
        </p>
        <span className="text-base">⚔️</span>
      </div>

      {/* Stat badges */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
        <div className="bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">🏠</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{buildingCount}</span>
        </div>
        <div className="bg-[#0d0a06]/85 backdrop-blur border border-[#fdd069]/50 rounded-full px-2.5 py-0.5 flex items-center gap-1">
          <span className="text-[11px]">⭐</span>
          <span className="font-display text-[10px] text-[#fdd069] tabular-nums">{cityLevel}</span>
        </div>
        <div className="bg-[#fdd069] border-2 border-[#1a0f05] rounded-full px-3 py-0.5 flex items-center gap-1 group-active:translate-y-[1px]">
          <span className="text-[10px]">👆</span>
          <span className="font-display text-[10px] text-[#1a0f05] uppercase tracking-wider">Bouw mee</span>
        </div>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" />

      <style jsx>{`
        @keyframes chestBob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-3px) scale(1.06); }
        }
      `}</style>
    </Link>
  );
}

function BuildingThumb({ slug, x, y, index }: { slug: string; x: number; y: number; index: number }) {
  const url = slug.startsWith('ts:')
    ? `/assets/topdown/buildings/tinyswords/${slug.split(':')[1]}/${slug.split(':')[2]}.png`
    : `/assets/topdown/buildings/${slug}.png`;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -85%)',
        animation: `buildingBob ${3 + (index % 3) * 0.5}s ease-in-out ${index * 0.25}s infinite`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="w-12 h-12 object-contain"
        style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))' }}
      />
      <style jsx>{`
        @keyframes buildingBob {
          0%, 100% { transform: translate(-50%, -85%); }
          50% { transform: translate(-50%, -88%); }
        }
      `}</style>
    </div>
  );
}

function Villagers({ count }: { count: number }) {
  // 6 villager poppetjes walking on different paths
  const paths = [
    { left: '15%', top: '25%', emoji: '🚶' },
    { left: '70%', top: '40%', emoji: '🚶‍♀️' },
    { left: '30%', top: '65%', emoji: '🧑‍🌾' },
    { left: '60%', top: '70%', emoji: '👧' },
    { left: '20%', top: '50%', emoji: '🧒' },
    { left: '80%', top: '55%', emoji: '👴' },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {paths.slice(0, count).map((p, i) => (
        <span
          key={i}
          className="absolute text-base"
          style={{
            left: p.left,
            top: p.top,
            animation: `walk${i % 3} ${5 + i}s ease-in-out infinite`,
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
          }}
        >
          {p.emoji}
        </span>
      ))}
      <style jsx>{`
        @keyframes walk0 {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(20px); }
        }
        @keyframes walk1 {
          0%, 100% { transform: translateX(0px) translateY(0px); }
          25% { transform: translateX(-15px) translateY(-5px); }
          75% { transform: translateX(15px) translateY(5px); }
        }
        @keyframes walk2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

function TreeBorder() {
  // Trees scattered along the border for forest feel
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Top row */}
      <div className="absolute top-1 left-0 right-0 flex justify-around text-base">
        <span>🌲</span><span>🌳</span><span>🌲</span><span>🌳</span><span>🌲</span><span>🌳</span>
      </div>
      {/* Bottom row */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-around text-base">
        <span>🌳</span><span>🌲</span><span>🌳</span><span>🌲</span><span>🌳</span><span>🌲</span>
      </div>
      {/* Left column */}
      <div className="absolute left-1 top-8 bottom-12 flex flex-col justify-around text-base">
        <span>🌲</span><span>🌳</span><span>🌲</span>
      </div>
      {/* Right column */}
      <div className="absolute right-1 top-8 bottom-12 flex flex-col justify-around text-base">
        <span>🌳</span><span>🌲</span><span>🌳</span>
      </div>
    </div>
  );
}
