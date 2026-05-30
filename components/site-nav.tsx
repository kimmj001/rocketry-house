import Link from "next/link";
import { Rocket, ShieldCheck } from "lucide-react";
import { AccountNav } from "@/components/account-nav";
import { platformNav } from "@/lib/platform-content";

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/18 bg-[#263246]/90 shadow-sm shadow-black/10 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Rocket className="h-5 w-5 text-orange-300" />
          Rocketry House
        </Link>
        <div className="hidden max-w-[780px] flex-wrap items-center justify-center gap-1 lg:flex">
          {platformNav.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-md px-2 py-1.5 text-xs text-orange-50/72 hover:bg-white/10 hover:text-white xl:px-3 xl:text-sm">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" aria-label="Admin moderation" className="hidden rounded-md p-2 hover:bg-white/10 sm:inline-flex">
            <ShieldCheck className="h-4 w-4" />
          </Link>
          <AccountNav />
        </div>
      </nav>
    </header>
  );
}
