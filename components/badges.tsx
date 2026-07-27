import type { VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const strong = status === "Flight verified" || status === "Telemetry attached" || status === "Static fire data";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", strong ? "bg-cyan-100 text-cyan-800" : "bg-orange-100 text-orange-800")}>
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
