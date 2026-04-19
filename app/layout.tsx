import type { Metadata, Viewport } from "next";
import { Lilita_One, Manrope, Cinzel, Philosopher } from "next/font/google";
import "./globals.css";

// Display: Lilita One — chunky round cartoon display font used by many
// mobile games. Clash-like feel, high readability, works at any size.
// Body: Manrope — clean modern sans.

const lilita = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: ["400"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const philosopher = Philosopher({
  variable: "--font-philosopher",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Bliep",
  description: "De productivity game waar volhouden iets oplevert.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bliep",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0a06",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${lilita.variable} ${manrope.variable} ${cinzel.variable} ${philosopher.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
