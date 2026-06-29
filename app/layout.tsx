import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ScrollNormalizer } from "@/components/scroll-normalizer";
import { SiteShell } from "@/components/site-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Rocketry House",
  description: "Build, simulate, fork, and fly what comes next."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ScrollNormalizer />
        <SiteShell>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
