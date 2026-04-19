'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import QuestPanel from '../QuestPanel';
import type { ChestKind } from '@/lib/chests';

interface Props {
  open: boolean;
  onClose: () => void;
  onAfterClaim?: (info: { leveledUp: boolean; newLevel: number; chestKind: ChestKind | null }) => void;
}

export default function QuestsModal({ open, onClose, onAfterClaim }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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

  const content: ReactNode = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 flex items-center justify-center"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            zIndex: 2147483647,
            padding: 14,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            overflowY: 'auto',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            onClick={e => e.stopPropagation()}
            className="relative"
            style={{
              width: 'min(460px, 100%)',
              margin: 'auto',
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Sluiten"
              className="absolute z-10"
              style={{
                top: -14,
                right: -4,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '2.5px solid #0d0a06',
                cursor: 'pointer',
                background: 'radial-gradient(ellipse 70% 40% at 50% 15%, rgba(255,250,210,0.85), transparent 70%), linear-gradient(180deg, #ffe07a 0%, #d99b22 45%, #a86a10 100%)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 3px 0 #4a2a08, 0 4px 10px rgba(0,0,0,0.5)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2 L12 12 M12 2 L2 12" stroke="#2a1608" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
            </button>

            <QuestPanel onAfterClaim={onAfterClaim} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
