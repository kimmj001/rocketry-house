import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { ScrollNormalizer } from "@/components/scroll-normalizer";
import { ProductionDataReset } from "@/components/production-data-reset";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Rocketry House",
  description: "Build, simulate, fork, and fly what comes next."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ProductionDataReset />
        <ScrollNormalizer />
        <div className="site-scroll-root" data-site-scroll-root tabIndex={-1}>
          <SiteNav />
          {children}
        </div>
      </body>
    </html>
  );
}
