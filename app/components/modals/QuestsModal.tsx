'use client';

import BHModal from '../BHModal';
import QuestPanel from '../QuestPanel';
import type { ChestKind } from '@/lib/chests';

interface Props {
  open: boolean;
  onClose: () => void;
  onAfterClaim?: (info: { leveledUp: boolean; newLevel: number; chestKind: ChestKind | null }) => void;
}

export default function QuestsModal({ open, onClose, onAfterClaim }: Props) {
  return (
    <BHModal open={open} onClose={onClose} title="Sidequests" accent="#fdd069">
      <div style={{ padding: 4 }}>
        <QuestPanel onAfterClaim={onAfterClaim} />
      </div>
    </BHModal>
  );
}
