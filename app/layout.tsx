import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fraunces — variable serif with a soft, slightly traditional feel.
// Used for display headlines (the "Hidden Siam" wordmark and section titles).
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Hidden Siam — multi-agent AI for off-the-beaten-path Thailand",
  description:
    "Seven specialized AI agents collaborate to find authentic, less-crowded Thai destinations curated from local sources — built against overtourism.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#faf6ef] text-[#1c1917]">
        {children}
      </body>
    </html>
  );
}
