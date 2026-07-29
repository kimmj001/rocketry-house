"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DmDock } from "@/components/dm-dock";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

const fixedWorkspaceRoutes = ["/upload"];
const immersiveRoutes = ["/logo-reveal"];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFixedWorkspace = fixedWorkspaceRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isImmersive = immersiveRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <div className="site-scroll-root" data-site-scroll-root data-fixed-workspace={isFixedWorkspace ? "true" : "false"} tabIndex={-1}>
      {!isImmersive && <SiteNav />}
      {children}
      {!isFixedWorkspace && !isImmersive && <SiteFooter />}
      {!isImmersive && <DmDock />}
    </div>
  );
}
