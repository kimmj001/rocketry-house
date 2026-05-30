import type { VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const strong = status === "Flight verified" || status === "Telemetry attached" || status === "Static fire data";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", strong ? "bg-cyan-300/15 text-cyan-100" : "bg-orange-300/15 text-orange-100")}>
      {status}
    </span>
  );
}

export function StabilityBadge({ margin }: { margin: number }) {
  const state = margin >= 1.5 ? "Stable" : margin >= 1 ? "Review" : "Unstable";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", state === "Stable" && "bg-emerald-300/15 text-emerald-100", state === "Review" && "bg-amber-300/15 text-amber-100", state === "Unstable" && "bg-red-300/15 text-red-100")}>
      {state} - {margin} cal
    </span>
  );
}

export function PriceTag({ cents }: { cents: number }) {
  return <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">{cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}`}</span>;
}
