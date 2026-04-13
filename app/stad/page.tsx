import { Suspense } from 'react';
import CityClient from './CityClient';

export const metadata = {
  title: 'Je stad — Bliep',
};

export default function StadPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F4E9D1]" />}>
      <CityClient />
    </Suspense>
  );
}
