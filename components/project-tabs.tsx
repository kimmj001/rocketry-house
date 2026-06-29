import Link from "next/link";
import { Boxes, GitFork, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: (slug: string) => `/projects/${slug}`, value: "overview", icon: ScrollText },
  { label: "CAD", href: (slug: string) => `/cad/${slug}`, value: "cad", icon: Boxes },
  { label: "Forks", href: (slug: string) => `/forks/${slug}`, value: "forks", icon: GitFork }
];

export function ProjectTabs({ slug, active = "overview" }: { slug: string; active?: "overview" | "cad" | "forks" }) {
  return (
    <nav aria-label="Project workspace" className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href(slug)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm transition",
              selected ? "bg-orange-300 text-[#16100b]" : "bg-white/[0.04] text-orange-50/72 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
