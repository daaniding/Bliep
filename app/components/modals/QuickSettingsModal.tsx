'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BHModal from '../BHModal';
import { getJuiceSettings, setJuiceSettings, type JuiceSettings } from '@/lib/juice';

interface Props { open: boolean; onClose: () => void }

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

export default function QuickSettingsModal({ open, onClose }: Props) {
  const [s, setS] = useState<JuiceSettings>({ audio: true, haptics: true, particles: true });
  useEffect(() => { if (open) setS(getJuiceSettings()); }, [open]);

  function toggle(key: keyof JuiceSettings) {
    const next = { ...s, [key]: !s[key] };
    setS(next);
    setJuiceSettings({ [key]: next[key] });
  }

  return (
    <BHModal open={open} onClose={onClose} title="Instellingen" subtitle="Snel aanpassen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row label="🔊 Geluidseffecten" value={s.audio} onToggle={() => toggle('audio')} />
        <Row label="📳 Trillingen" value={s.haptics} onToggle={() => toggle('haptics')} />
        <Row label="✨ Effecten" value={s.particles} onToggle={() => toggle('particles')} />

        <div style={{ height: 1, background: 'rgba(42,22,8,0.3)', margin: '6px 0' }} />

        <Link
          href="/settings"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 8,
            background: 'rgba(42,22,8,0.12)',
            boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.35)',
            fontFamily: cinzel, fontWeight: 800, fontSize: 13, color: '#2a1608',
            textDecoration: 'none',
          }}
        >
          <span>⚙️ Alle instellingen</span>
          <span style={{ fontFamily: cinzel, fontWeight: 900, color: '#8e5a18' }}>›</span>
        </Link>

        <div style={{ marginTop: 6, fontFamily: philosopher, fontStyle: 'italic', fontSize: 11, color: '#5a3a22', textAlign: 'center' }}>
          Tik op de cirkel om te wisselen
        </div>
      </div>
    </BHModal>
  );
}

function Row({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(42,22,8,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(42,22,8,0.35)',
        fontFamily: cinzel, fontWeight: 800, fontSize: 13, color: '#2a1608',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 42, height: 24, borderRadius: 999,
          background: value
            ? 'linear-gradient(180deg, #9fe883, #3da83e 60%, #1a5a1a 100%)'
            : 'linear-gradient(180deg, #5a3a22, #2a1608)',
          boxShadow: value
            ? 'inset 0 0 0 1.5px #0a2a0a, inset 0 1px 0 rgba(255,255,220,.4)'
            : 'inset 0 0 0 1.5px #1a0a02, inset 0 1px 2px rgba(0,0,0,0.5)',
          transition: 'background .2s',
          flex: 'none',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: value ? 20 : 2,
            width: 20, height: 20, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fff6d0, #c9ac74 60%, #6a3a0a 100%)',
            boxShadow: 'inset 0 0 0 1px #1a0a02, 0 1px 2px rgba(0,0,0,0.5)',
            transition: 'left .18s ease',
          }}
        />
      </span>
    </button>
  );
}
