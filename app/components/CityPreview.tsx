'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { loadCity, processBuildQueue, CITY_CHANGED_EVENT, type CityState } from '@/lib/cityStore';

const CityCanvas = dynamic(() => import('../stad/CityCanvas'), { ssr: false });

/**
 * Mini, non-interactive replica of the city. Renders the same CityCanvas
 * in preview mode so home and /stad never drift.
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

  if (!state) {
    return <div className="absolute inset-0 bg-gradient-to-b from-[#3b2410] to-[#0d0a06]" />;
  }
  return (
    <Link href="/stad" className="absolute inset-0 block group" aria-label="Open je stad">
      <div className="absolute inset-0 bg-gradient-to-b from-[#3b2410] via-[#2a180a] to-[#0d0a06]" />
      <CityCanvas state={state} mode="preview" showBuildZone={false} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a06]/80 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 font-display text-[11px] uppercase tracking-widest text-[#fdd069]/70 group-hover:text-[#fdd069] transition-colors">
        je rijk · tap om te bouwen
      </div>
    </Link>
  );
}
