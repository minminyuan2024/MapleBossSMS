import type { Metadata } from "next";
import { IBM_Plex_Sans, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maple Boss Notify",
  description:
    "Subscribe to weekly SMS reminders for MapleStory major bosses (wiki-aligned list).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plex.variable} ${outfit.variable} min-h-screen font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
