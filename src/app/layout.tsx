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
  title: {
    default: "VaultPromo — Audio Promotion Platform",
    template: "%s | VaultPromo",
  },
  description:
    "Secure, trackable audio promo distribution for independent labels, PR agencies and producers.",
  icons: {
    icon: "/logo-vaultpromo.png",
    shortcut: "/logo-vaultpromo.png",
    apple: "/logo-vaultpromo.png",
  },
  openGraph: {
    title: "VaultPromo",
    description:
      "Secure audio promo distribution for independent labels.",
    siteName: "VaultPromo",
    images: [{ url: "/logo-vaultpromo.png" }],
  },
  twitter: {
    card: "summary",
    title: "VaultPromo",
    description: "Secure audio promo distribution for independent labels.",
    images: ["/logo-vaultpromo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <AudioPlayerProvider>
          {children}
          <PersistentAudioBar />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
