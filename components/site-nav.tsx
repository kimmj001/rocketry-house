"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket } from "lucide-react";
import { AccountNav } from "@/components/account-nav";
import { platformNav } from "@/lib/platform-content";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black bg-black text-white shadow-sm">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-[15px] font-bold">
          <Rocket className="h-5 w-5 text-orange-400" />
          <span className="truncate">Rocketry House</span>
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
