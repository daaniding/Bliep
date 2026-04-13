'use client';

import { ReactNode } from 'react';

interface Props {
  ribbonText: string;
  children: ReactNode;
}

// The signature centerpiece: thick gold frame + parchment panel inside,
// with a ribbon banner at the top. Used as the home dashboard hero.
export default function HeroPanel({ ribbonText, children }: Props) {
  return (
    <div className="relative pt-4">
      {/* Ribbon sits on top of the frame border */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
        <span className="ribbon">{ribbonText}</span>
      </div>
      <div className="gold-frame-xl mt-2">
        <div className="parchment-panel p-5 pt-7">
          {children}
        </div>
      </div>
    </div>
  );
}
