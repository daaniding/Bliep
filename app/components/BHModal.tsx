'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Accent color tint for header band (default gold) */
  accent?: string;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

export default function BHModal({ open, onClose, title, subtitle, children, accent = '#F5C842' }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 grid place-items-center"
          onClick={onClose}
          onTouchMove={(e) => e.preventDefault()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            zIndex: 2147483647,
            padding: 14,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.62)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            style={{
              width: 'min(420px, 100%)',
              maxHeight: '100%',
              filter:
                'drop-shadow(0 20px 30px rgba(0,0,0,.55)) drop-shadow(0 6px 10px rgba(0,0,0,.5))',
            }}
          >
            {/* wood frame */}
            <div
              style={{
                position: 'relative',
                padding: 12,
                borderRadius: 20,
                background:
                  'repeating-linear-gradient(92deg, rgba(0,0,0,0) 0px, rgba(0,0,0,.08) 2px, rgba(0,0,0,0) 5px, rgba(255,220,170,.04) 7px, rgba(0,0,0,.06) 10px), ' +
                  'linear-gradient(180deg, #6a3a1c 0%, #4a2410 40%, #3a1c0a 70%, #2a1204 100%)',
                boxShadow:
                  'inset 0 0 0 2px #1a0a03, inset 0 0 0 3px rgba(255,180,100,.15), inset 0 2px 0 rgba(255,210,150,.22), inset 0 -3px 0 rgba(0,0,0,.55)',
              }}
            >
              {/* parchment inner */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  padding: '14px 14px 16px',
                  background:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\"), " +
                    'radial-gradient(120% 80% at 50% 0%, #f5e4bd 0%, #e9d19c 45%, #d4b578 100%)',
                  boxShadow:
                    'inset 0 2px 0 rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.3), inset 0 -2px 0 rgba(255,240,200,.35)',
                }}
              >
                {/* header */}
                <div style={{ textAlign: 'center', paddingBottom: 10, position: 'relative' }}>
                  <button
                    onClick={onClose}
                    aria-label="Sluiten"
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 32, height: 32, borderRadius: '50%',
                      border: 'none', cursor: 'pointer',
                      background:
                        'radial-gradient(ellipse 70% 40% at 50% 15%, rgba(255,250,210,.85), transparent 70%), linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
                      boxShadow: 'inset 0 0 0 2px #4a2a08, 0 2px 0 rgba(0,0,0,.5), 0 4px 8px rgba(0,0,0,.35)',
                      display: 'grid', placeItems: 'center',
                      color: '#2a1608',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2 L12 12 M12 2 L2 12" stroke="#2a1608" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: cinzel,
                      fontWeight: 900,
                      fontSize: 'clamp(20px, 5.5vw, 24px)',
                      color: '#2a1608',
                      letterSpacing: '0.02em',
                      textShadow: '0 1px 0 rgba(255,240,200,.45)',
                    }}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <div
                      style={{
                        marginTop: 2,
                        fontFamily: philosopher,
                        fontStyle: 'italic',
                        fontSize: 12,
                        color: '#5a3a22',
                        opacity: 0.85,
                      }}
                    >
                      {subtitle}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      height: 2,
                      background: `linear-gradient(90deg, transparent, ${accent} 20%, ${accent} 80%, transparent)`,
                      opacity: 0.7,
                    }}
                  />
                </div>

                {/* body */}
                <div>{children}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
