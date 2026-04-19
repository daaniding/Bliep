'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getDailyQuests,
  claimQuest,
  submitQuestPhoto,
  removeQuestPhoto,
  compressPhotoFile,
  QUESTS_CHANGED_EVENT,
  type DailyQuest,
  type QuestReward,
} from '@/lib/dailyQuests';
import { loadCity, saveCity, addCoins, addXp } from '@/lib/cityStore';
import { grantChest, loadInventory, type ChestKind } from '@/lib/chests';
import { sfxClaim, sfxTap } from '@/lib/sound';
import { vibrate } from '@/lib/juice';

interface Props {
  /** Called after a claim applies. Parent can use this to trigger level-up modal. */
  onAfterClaim?: (info: { leveledUp: boolean; newLevel: number; chestKind: ChestKind | null }) => void;
}

const cinzel = "var(--font-cinzel), 'Cinzel', serif";
const philosopher = "var(--font-philosopher), 'Philosopher', serif";

export default function QuestPanel({ onAfterClaim }: Props) {
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ questId: string; dataUrl: string; title: string } | null>(null);

  const refresh = useCallback(() => {
    setQuests(getDailyQuests());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const id = window.setInterval(refresh, 3000);
    window.addEventListener(QUESTS_CHANGED_EVENT, onChange);
    window.addEventListener('bliep:city-changed', onChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(QUESTS_CHANGED_EVENT, onChange);
      window.removeEventListener('bliep:city-changed', onChange);
    };
  }, [refresh]);

  const applyReward = useCallback((reward: QuestReward) => {
    const city = loadCity();
    const withCoins = addCoins(city, reward.coins);
    const xpRes = addXp(withCoins, reward.xp);
    saveCity(xpRes.state);
    if (reward.chest) grantChest(loadInventory(), reward.chest);
    return {
      leveledUp: xpRes.leveledUp,
      newLevel: xpRes.newLevel,
      chestKind: reward.chest ?? null,
    };
  }, []);

  const handleClaim = useCallback((q: DailyQuest) => {
    if (!q.done || q.claimed) return;
    const reward = claimQuest(q.id);
    if (!reward) return;
    sfxClaim();
    vibrate(20);
    const info = applyReward(reward);
    setBurstId(q.id);
    window.setTimeout(() => setBurstId(null), 900);
    refresh();
    onAfterClaim?.(info);
  }, [applyReward, refresh, onAfterClaim]);

  const handlePhotoUpload = useCallback(async (questId: string, file: File) => {
    try {
      const dataUrl = await compressPhotoFile(file);
      submitQuestPhoto(questId, dataUrl);
      sfxTap();
      vibrate(15);
      refresh();
    } catch {
      alert('Kon de foto niet laden — probeer een andere.');
    }
  }, [refresh]);

  const handleRemovePhoto = useCallback((questId: string) => {
    removeQuestPhoto(questId);
    refresh();
  }, [refresh]);

  const doneCount = quests.filter(q => q.done).length;
  const claimableCount = quests.filter(q => q.done && !q.claimed).length;

  return (
    <>
      <div
        className="relative"
        style={{
          padding: 14,
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(26,15,5,0.94) 0%, rgba(13,10,6,0.98) 100%)',
          border: '3px solid #0d0a06',
          boxShadow:
            'inset 0 2px 0 rgba(240,184,64,0.28), ' +
            'inset 0 -2px 0 rgba(0,0,0,0.5), ' +
            '0 4px 0 #0d0a06, 0 10px 24px rgba(0,0,0,0.55), ' +
            '0 0 22px rgba(253,208,105,0.08)',
        }}
      >
        <div aria-hidden className="absolute pointer-events-none" style={{ top: 6, left: 6, width: 10, height: 10, borderLeft: '2px solid #fdd069', borderTop: '2px solid #fdd069', opacity: 0.5 }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: 6, right: 6, width: 10, height: 10, borderRight: '2px solid #fdd069', borderTop: '2px solid #fdd069', opacity: 0.5 }} />

        {/* Header */}
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div>
            <div
              style={{
                fontFamily: cinzel,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#b69560',
                textTransform: 'uppercase',
              }}
            >
              Dagelijkse queesten
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 22,
                color: '#fdd069',
                textShadow: '0 2px 0 #0d0a06',
                lineHeight: 1,
                marginTop: 3,
              }}
            >
              Sidequests
            </div>
          </div>
          <div
            className="flex items-center gap-2"
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              background: claimableCount > 0
                ? 'linear-gradient(180deg, #ffe58a 0%, #fdd069 50%, #a3701a 100%)'
                : 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
              border: '2px solid #0d0a06',
              boxShadow: claimableCount > 0
                ? 'inset 0 2px 0 rgba(255,255,255,0.45), 0 3px 0 #6e4c10, 0 0 14px rgba(253,208,105,0.6)'
                : 'inset 0 2px 0 rgba(255,230,160,0.18), 0 3px 0 #0d0a06',
            }}
          >
            <span
              className="font-display tabular-nums"
              style={{
                fontSize: 12,
                color: claimableCount > 0 ? '#0d0a06' : '#fdd069',
                letterSpacing: '0.05em',
                textShadow: claimableCount > 0 ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 0 #0d0a06',
              }}
            >
              {doneCount}/{quests.length}
            </span>
          </div>
        </div>

        {/* Quest rows */}
        <div className="flex flex-col gap-2">
          {quests.map((q, idx) => (
            <QuestRow
              key={q.id}
              quest={q}
              onClaim={() => handleClaim(q)}
              onPhotoUpload={file => handlePhotoUpload(q.id, file)}
              onPhotoRemove={() => handleRemovePhoto(q.id)}
              onPreviewPhoto={() => q.photoDataUrl && setPreviewPhoto({ questId: q.id, dataUrl: q.photoDataUrl, title: q.title })}
              burst={burstId === q.id}
              index={idx}
            />
          ))}
        </div>
      </div>

      {/* Photo preview overlay */}
      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: 8,
                  borderRadius: 14,
                  background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
                  border: '3px solid #0d0a06',
                  boxShadow: 'inset 0 2px 0 rgba(255,230,160,0.3), 0 10px 30px rgba(0,0,0,0.7)',
                }}
              >
                <img
                  src={previewPhoto.dataUrl}
                  alt={previewPhoto.title}
                  style={{ width: '100%', borderRadius: 8, display: 'block' }}
                />
                <div className="mt-2 flex items-center justify-between px-2 pb-1">
                  <div
                    className="font-display truncate"
                    style={{ fontSize: 13, color: '#fdd069', textShadow: '0 1px 0 #0d0a06' }}
                  >
                    {previewPhoto.title}
                  </div>
                  <button
                    onClick={() => setPreviewPhoto(null)}
                    className="font-display"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      color: '#fdd069',
                      background: 'transparent',
                      border: '1.5px solid rgba(253,208,105,0.5)',
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}
                  >
                    SLUITEN
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ------------------------------------------------------------------

interface RowProps {
  quest: DailyQuest;
  onClaim: () => void;
  onPhotoUpload: (file: File) => void;
  onPhotoRemove: () => void;
  onPreviewPhoto: () => void;
  burst: boolean;
  index: number;
}

function QuestRow({ quest, onClaim, onPhotoUpload, onPhotoRemove, onPreviewPhoto, burst, index }: RowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const claimable = quest.done && !quest.claimed;
  const finished = quest.claimed;
  const needsPhoto = quest.proof === 'photo' && !quest.done;

  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.04, duration: 0.32 }}
      className="relative flex items-start gap-3"
      style={{
        padding: '10px 10px',
        borderRadius: 12,
        background: finished
          ? 'linear-gradient(180deg, rgba(40,70,40,0.55) 0%, rgba(20,40,24,0.75) 100%)'
          : claimable
            ? 'linear-gradient(180deg, rgba(60,45,20,0.8) 0%, rgba(40,28,10,0.9) 100%)'
            : 'linear-gradient(180deg, rgba(40,28,16,0.55) 0%, rgba(26,16,8,0.75) 100%)',
        border: finished
          ? '2px solid #2a6a3a'
          : claimable
            ? '2px solid #fdd069'
            : '2px solid rgba(253,208,105,0.22)',
        boxShadow: claimable
          ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 18px rgba(253,208,105,0.45)'
          : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 240ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Icon / photo thumb */}
      {quest.photoDataUrl ? (
        <button
          onClick={onPreviewPhoto}
          className="flex-shrink-0 overflow-hidden relative"
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            border: '2.5px solid #0d0a06',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.25), 0 2px 0 #0d0a06',
            padding: 0,
            background: '#0d0a06',
            cursor: 'pointer',
          }}
          aria-label="Bekijk foto"
        >
          <img
            src={quest.photoDataUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </button>
      ) : (
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            background: finished
              ? 'radial-gradient(circle at 30% 28%, #a8e4b4 0%, #3d7a3f 50%, #1a2a18 100%)'
              : 'radial-gradient(circle at 30% 28%, #fff6dc 0%, #fdd069 40%, #5a3a10 100%)',
            border: '2.5px solid #0d0a06',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), 0 2px 0 #0d0a06',
            fontSize: 26,
            lineHeight: 1,
          }}
        >
          {finished ? '✓' : quest.icon}
        </div>
      )}

      {/* Middle column */}
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: philosopher,
            fontSize: 14,
            fontWeight: 700,
            color: finished ? '#c9e6cf' : '#fff6dc',
            lineHeight: 1.2,
            letterSpacing: '0.01em',
          }}
        >
          {quest.title}
        </div>
        <div
          className="truncate mt-0.5"
          style={{
            fontSize: 11,
            color: finished ? '#8ab49a' : '#a38c66',
            fontStyle: 'italic',
            fontFamily: philosopher,
            lineHeight: 1.25,
          }}
        >
          {quest.description}
        </div>
        <RewardLine reward={quest.reward} dim={finished} />
      </div>

      {/* Right column — claim / upload / status */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {claimable ? (
          <motion.button
            type="button"
            onClick={onClaim}
            whileTap={{ scale: 0.94 }}
            className="font-display active:translate-y-[2px]"
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 14,
              letterSpacing: '0.06em',
              color: '#0d0a06',
              background: 'linear-gradient(180deg, #ffe58a 0%, #fdd069 50%, #a3701a 100%)',
              border: '2.5px solid #0d0a06',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), 0 3px 0 #6e4c10, 0 0 14px rgba(253,208,105,0.6)',
              textShadow: '0 1px 0 rgba(255,255,255,0.45)',
              cursor: 'pointer',
            }}
          >
            CLAIM
          </motion.button>
        ) : finished ? (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              fontFamily: cinzel,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#c9e6cf',
              background: 'rgba(60,100,70,0.35)',
              border: '1.5px solid rgba(180,220,190,0.4)',
              textTransform: 'uppercase',
            }}
          >
            Geclaimd
          </div>
        ) : needsPhoto ? (
          <motion.button
            type="button"
            onClick={() => fileRef.current?.click()}
            whileTap={{ scale: 0.94 }}
            className="font-display active:translate-y-[2px] flex items-center gap-1.5"
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 11,
              letterSpacing: '0.08em',
              color: '#fdd069',
              background: 'linear-gradient(180deg, #3a2718 0%, #1c0f06 100%)',
              border: '2px solid #fdd069',
              boxShadow: 'inset 0 2px 0 rgba(253,208,105,0.25), 0 3px 0 #0d0a06',
              textShadow: '0 1px 0 #0d0a06',
              cursor: 'pointer',
            }}
          >
            📸 BEWIJS
          </motion.button>
        ) : (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              fontFamily: cinzel,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#b69560',
              background: 'rgba(60,40,20,0.35)',
              border: '1.5px solid rgba(253,208,105,0.22)',
              textTransform: 'uppercase',
            }}
          >
            Bezig
          </div>
        )}

        {/* Secondary: replace photo if present and not claimed */}
        {quest.proof === 'photo' && quest.photoDataUrl && !finished && (
          <button
            type="button"
            onClick={onPhotoRemove}
            style={{
              padding: '2px 6px',
              fontSize: 9,
              color: '#a08560',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              letterSpacing: '0.03em',
            }}
          >
            opnieuw
          </button>
        )}
      </div>

      {/* Hidden file input for camera/gallery */}
      {quest.proof === 'photo' && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onPhotoUpload(f);
            e.target.value = ''; // allow re-selecting same file
          }}
        />
      )}

      {/* Burst on claim */}
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1.05 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 12,
              boxShadow: '0 0 30px 6px rgba(253,208,105,0.9)',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RewardLine({ reward, dim }: { reward: QuestReward; dim: boolean }) {
  const opacity = dim ? 0.55 : 1;
  const chestIcon = reward.chest === 'magic' ? '🪄' : '📦';
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" style={{ opacity }}>
      <RewardPill icon="🪙" label={`+${reward.coins}`} tint="#fdd069" />
      <RewardPill icon="⚡" label={`+${reward.xp}`} tint="#c0e8ff" />
      {reward.chest && <RewardPill icon={chestIcon} label={reward.chest} tint="#e5b57a" />}
    </div>
  );
}

function RewardPill({ icon, label, tint }: { icon: string; label: string; tint: string }) {
  return (
    <div
      className="flex items-center gap-1 font-display tabular-nums"
      style={{
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10,
        color: tint,
        background: 'rgba(13,10,6,0.7)',
        border: '1px solid rgba(255,255,255,0.1)',
        letterSpacing: '0.04em',
        lineHeight: 1.2,
      }}
    >
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
