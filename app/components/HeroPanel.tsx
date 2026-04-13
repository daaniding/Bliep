'use client';

import { ReactNode } from 'react';

interface Props {
  ribbonText: string;
  children: ReactNode;
}

// Wrap content in a Kenney brown wooden panel with an inset beige panel
// inside, plus a heraldic ribbon on top. Real game UI chrome.
export default function HeroPanel({ ribbonText, children }: Props) {
  return (
    <div className="relative pt-5">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 z-20 pointer-events-none">
        <span className="ribbon">{ribbonText}</span>
      </div>

      <div className="kenney-panel-brown mt-3" style={{ padding: 6 }}>
        <div className="kenney-panel-inset" style={{ padding: '18px 14px 14px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
