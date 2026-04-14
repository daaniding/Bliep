'use client';

import Link from 'next/link';
import GameShell from '../components/GameShell';
import { sfxTap } from '@/lib/sound';

interface MenuLink {
  href: string;
  label: string;
  desc: string;
  icon: string;
}

const LINKS: MenuLink[] = [
  { href: '/settings', label: 'Instellingen', desc: 'Notificaties, account, geluid', icon: '⚙' },
  { href: '/league', label: 'Friend League', desc: 'Speel met vrienden mee', icon: '🏆' },
  { href: '/stad', label: 'Mijn stad', desc: 'Bekijk en upgrade je gebouwen', icon: '🏰' },
];

export default function MeerPage() {
  return (
    <GameShell>
      <div
        className="flex flex-col mx-auto w-full"
        style={{
          maxWidth: 460,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 84px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
          paddingLeft: 16,
          paddingRight: 16,
          gap: 18,
          minHeight: '100dvh',
        }}
      >
        <header className="text-center animate-fade-up">
          <p
            className="font-display"
            style={{
              fontSize: 11,
              color: '#fdd069',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Meer
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 28,
              color: '#fff6dc',
              WebkitTextStroke: '2.5px #0d0a06',
              paintOrder: 'stroke fill',
              textShadow: '0 3px 0 #0d0a06',
              lineHeight: 1.1,
            }}
          >
            Menu
          </h1>
        </header>

        <div className="flex flex-col gap-3 stagger">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => sfxTap()}
              className="panel-dark-glass animate-fade-up flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{
                padding: '14px 16px',
                textDecoration: 'none',
                minHeight: 64,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background:
                    'linear-gradient(180deg, #fdd069 0%, #c8891e 50%, #6e4c10 100%)',
                  border: '2.5px solid #0d0a06',
                  boxShadow:
                    'inset 0 1.5px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.4), 0 2px 0 #0d0a06',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {link.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  className="font-display"
                  style={{
                    fontSize: 14,
                    color: '#fff6dc',
                    textShadow: '0 1.5px 0 #0d0a06',
                    letterSpacing: '0.04em',
                    lineHeight: 1.1,
                    margin: 0,
                  }}
                >
                  {link.label}
                </p>
                <p
                  className="font-body"
                  style={{
                    fontSize: 11,
                    color: '#f4e6b8',
                    opacity: 0.7,
                    lineHeight: 1.2,
                    marginTop: 3,
                    marginBottom: 0,
                  }}
                >
                  {link.desc}
                </p>
              </div>
              <span style={{ color: '#fdd069', fontSize: 22, opacity: 0.6 }}>›</span>
            </Link>
          ))}
        </div>

        <div
          className="panel-dark-glass animate-fade-up"
          style={{ padding: '16px 18px', marginTop: 8 }}
        >
          <p
            className="font-display"
            style={{
              fontSize: 11,
              color: '#fdd069',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Over Bliep
          </p>
          <p className="font-body" style={{ fontSize: 12.5, color: '#f4e6b8', lineHeight: 1.5 }}>
            Bliep is een productiviteitsspel: pak één opdracht per dag, focus voor 15,
            30 of 60 minuten, en bouw met je verdiende muntjes een middeleeuws koninkrijk.
            Hoe trouwer je bent, hoe sterker je rijk wordt.
          </p>
        </div>
      </div>
    </GameShell>
  );
}
