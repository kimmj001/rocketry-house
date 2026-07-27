import Link from "next/link";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { PRO_PLAN_IDS, PRO_PRICES, normalizeAccountType, type AccountType } from "@/lib/usage-limits";

export default async function CheckoutPreparePage({
  searchParams
}: {
  searchParams: Promise<{ accountType?: string; planId?: string; tier?: string }>;
}) {
  const params = await searchParams;
  const accountType = normalizeAccountType(params.accountType);
  const planId = params.planId || PRO_PLAN_IDS[accountType];
  const planName = `${accountTitle(accountType)} Pro`;
  const activationHref = `mailto:rocketryhouse@gmail.com?subject=${encodeURIComponent(`${planName} activation request`)}&body=${encodeURIComponent(`Hello Rocketry House team,\n\nPlease prepare ${planName} activation for this account.\n\nPlan ID: ${planId}\nBilling: ${PRO_PRICES[accountType]}\n\nAccount email:\n`)}`;

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-4 py-24 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </Link>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-slate-950 text-orange-300">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-600">Checkout preparation</p>
              <h1 className="mt-1 text-3xl font-black">{planName}</h1>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 sm:grid-cols-4">
            <Info label="Plan" value={planName} />
            <Info label="Plan ID" value={planId} />
            <Info label="Billing" value={PRO_PRICES[accountType]} />
            <Info label="Tier" value="Pro" />
          </div>

          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Stripe checkout is not connected yet. This page is the prepared conversion step for createCheckoutSession(accountType, &quot;pro&quot;) and keeps the plan ID mapping ready for payment integration. Until Stripe is connected, Rocketry House can review activation requests and set the account plan from Unified account management.
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-100">
              View plans
            </Link>
            <Link href={activationHref} className="inline-flex h-10 items-center justify-center rounded-md bg-orange-500 px-4 text-sm font-black text-white hover:bg-orange-600">
              Request Pro activation
            </Link>
          </div>
        </section>
        <section className="mt-4 flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-600 shadow-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          Pro-level access is still tracked for analytics and abuse prevention while removing Standard quota blocks.
        </section>
      </div>
    </main>
  );
}

function accountTitle(accountType: AccountType) {
  return accountType === "organization" ? "Organization" : accountType === "team" ? "Team" : "Personal";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-950">{value}</p>
    </div>
  );
}
