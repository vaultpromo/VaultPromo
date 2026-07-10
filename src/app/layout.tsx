import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AudioPlayerProvider } from "@/components/promo/audio-player-context";
import { PersistentAudioBar } from "@/components/promo/persistent-audio-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PromoVault — Audio Promotion Platform",
  description:
    "Secure, trackable audio promo distribution for independent labels, PR agencies and producers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        {/*
          AudioPlayerProvider wraps the entire app so the audio element and
          state persist across client-side navigations. The hidden <audio> tag
          inside the provider is what enables music to keep playing while the
          user scrolls or reads press release notes.

          PersistentAudioBar is conditionally visible (only when a track is loaded).
        */}
        <AudioPlayerProvider>
          {children}
          <PersistentAudioBar />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
