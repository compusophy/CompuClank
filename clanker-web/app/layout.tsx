import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Base URL for the app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://compu-cabal.vercel.app";

// Farcaster Mini App embed metadata
const miniAppEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/image.gif`,
  button: {
    title: "OPEN",
    action: {
      type: "launch_frame",
      name: "CABAL",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/icon.gif`,
      splashBackgroundColor: "#000000"
    }
  }
};

export const metadata: Metadata = {
  title: "CABAL - Composable DAO Framework",
  description: "Create and manage decentralized group wallets with Clanker tokens",
  openGraph: {
    title: "CABAL - Composable DAO Framework",
    description: "Create and manage decentralized group wallets with Clanker tokens",
    images: [`${APP_URL}/image.png`],
  },
  other: {
    // Farcaster Mini App embed meta tag
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    // Legacy support
    "fc:frame": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Farcaster Quick Auth server for better performance */}
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Web3Provider>
            {children}
            <Toaster />
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
