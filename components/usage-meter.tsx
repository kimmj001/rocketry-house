import Link from "next/link";
import { AlertCircle, Lock, TrendingUp } from "lucide-react";
import { checkoutHref } from "@/lib/checkout";
import { usageCounterText, type AccountType, type UsageStatus } from "@/lib/usage-limits";
import { cn } from "@/lib/utils";

export function UsageCounter({
  label,
  status,
  periodText = "",
  loading,
  error
}: {
  label: string;
  status?: UsageStatus | null;
  periodText?: string;
  loading?: boolean;
  error?: string;
}) {
  const blocked = Boolean(status?.blocked);
  const nearLimit = Boolean(status?.nearLimit);
  const percent = status?.limit === null ? 18 : status?.percentUsed ?? 0;

  return (
    <div className={cn(
      "rounded-xl border px-3 py-2 text-sm font-semibold",
      blocked ? "border-slate-300 bg-slate-100 text-slate-800" : nearLimit ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"
    )}>
      <div className="flex items-center justify-between gap-3">
        <span>{loading ? `${label}: loading usage...` : status ? usageCounterText(label, status, periodText) : error || `${label}: cloud usage sync required`}</span>
        {blocked ? <Lock className="h-4 w-4 text-slate-600" /> : nearLimit ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
      </div>
      {status ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className={cn("h-full rounded-full", blocked ? "bg-slate-600" : nearLimit ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function UpgradeLimitCard({
  accountType = "personal",
  title = "You've reached your Standard plan limit.",
  description,
  onDismiss
}: {
  accountType?: AccountType;
  title?: string;
  description: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-950">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={checkoutHref(accountType)} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-white hover:bg-orange-600">
          Upgrade to Pro
        </Link>
        <Link href="/pricing" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-100">
          View plans
        </Link>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="rounded-md px-4 py-2 text-sm font-black text-slate-500 hover:bg-white">
            Maybe later
          </button>
        ) : null}
      </div>
    </div>
  );
}
