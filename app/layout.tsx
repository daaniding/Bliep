import type { Metadata, Viewport } from "next";
import { Cinzel, Cinzel_Decorative, Manrope } from "next/font/google";
import "./globals.css";

// Display: Cinzel — Roman classical caps, used heavily in fantasy & medieval games.
// Body: Manrope — clean modern sans for legibility.
// Headline accent: Cinzel Decorative — flourished version for hero titles.

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  themeColor: "#0d1426",
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
    <html lang="nl" className={`${cinzel.variable} ${cinzelDecorative.variable} ${manrope.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
