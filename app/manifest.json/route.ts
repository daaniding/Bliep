import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'Bliep',
    short_name: 'Bliep',
    description: 'Je dagelijkse dosis positiviteit',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF7ED',
    theme_color: '#F97316',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  });
}
