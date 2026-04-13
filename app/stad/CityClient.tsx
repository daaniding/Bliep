'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const CityCanvas = dynamic(() => import('./CityCanvas'), { ssr: false });

export default function CityClient() {
  return (
    <div className="min-h-dvh bg-[#F4E9D1] relative overflow-hidden">
      <Link
        href="/"
        className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-[#6B4520] hover:bg-white transition-colors active:scale-95 shadow-md"
        aria-label="Terug naar home"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>
      <CityCanvas />
    </div>
  );
}
