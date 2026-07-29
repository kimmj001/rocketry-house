"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountNav } from "@/components/account-nav";
import { RocketryHouseLogoReveal } from "@/components/rocketry-house-logo-reveal";
import { platformNav } from "@/lib/platform-content";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black bg-black text-white shadow-sm">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Rocketry House home" className="flex shrink-0 items-center">
          <RocketryHouseLogoReveal mode="loop" style={{ width: "clamp(132px, 24vw, 184px)" }} />
        </Link>
        <div className="hidden h-full max-w-[780px] items-center justify-center gap-5 lg:flex">
          {platformNav.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`flex h-full items-center border-b-2 px-1 text-sm font-bold transition ${
                pathname === href || pathname.startsWith(href)
                  ? "border-orange-500 text-white"
                  : "border-transparent text-white/78 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <AccountNav />
      </nav>
    </header>
  );
}
