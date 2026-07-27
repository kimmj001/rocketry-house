import Link from "next/link";
import { CheckCircle2, Mail, Sparkles } from "lucide-react";
import { checkoutHref } from "@/lib/checkout";
import { ARTICLE_COVERAGE_COPY, PRO_PRICES, type AccountType } from "@/lib/usage-limits";

const planGroups: Array<{
  accountType: AccountType;
  title: string;
  standard: string[];
  pro: string[];
}> = [
  {
    accountType: "personal",
    title: "Personal",
    standard: [
      "Up to 3 projects",
      "3 CFD runs / month",
      "10 DMs / month",
      "Public profile",
      "Basic portfolio"
    ],
    pro: [
      "Unlimited projects",
      "Unlimited CFD runs",
      "Unlimited DMs to Teams and Organizations",
      "Verified Builder badge",
      "Article requests by email",
      "Launch log",
      "Portfolio PDF export"
    ]
  },
  {
    accountType: "team",
    title: "Team",
    standard: [
      "Up to 3 projects",
      "10 CFD runs / month",
      "Up to 10 team members",
      "30 DMs / month",
      "Basic team page"
    ],
    pro: [
      "Unlimited projects",
      "Unlimited CFD runs",
      "Unlimited team members",
      "Unlimited DMs",
      "Verified Team badge",
      "Article requests by email",
      "Custom team page",
      "Sponsor display",
      "Launch record management"
    ]
  },
  {
    accountType: "organization",
    title: "Organization",
    standard: [
      "Up to 5 member teams",
      "3 broadcasts / month",
      "1 active event or competition page",
      "50 DMs / month",
      "Basic organization page"
    ],
    pro: [
      "Unlimited member teams",
      "Unlimited broadcasts",
      "Unlimited event and competition pages",
      "Unlimited DMs",
      "Verified Organization badge",
      "Analytics dashboard",
      "Sponsor page",
      "Annual report generation",
      "Article requests by email"
    ]
  }
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] px-4 py-24 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-orange-600">Pricing</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Subscription access with exact Standard limits.</h1>
          <p className="mt-5 text-lg font-medium leading-8 text-slate-600">
            Rocketry House projects are free to view or share according to their visibility and license settings. Pro subscriptions expand web access, usage quota, and account features.
          </p>
        </section>

        <section className="mt-10 grid gap-6">
          {planGroups.map((group) => (
            <div key={group.accountType} className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Account type</p>
                <h2 className="mt-3 text-2xl font-black">{group.title}</h2>
              </div>
              <PlanCard
                name={`${group.title} Standard`}
                price="Free"
                features={group.standard}
                badge="Exact Standard quota"
                href={`/auth/sign-up?type=${group.accountType}`}
                cta="Start free"
              />
              <PlanCard
                name={`${group.title} Pro`}
                price={PRO_PRICES[group.accountType]}
                features={group.pro}
                badge="Tracked unlimited access"
                href={checkoutHref(group.accountType)}
                cta="Upgrade to Pro"
                highlighted
              />
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-600" />
              <h2 className="text-xl font-black">Article coverage</h2>
            </div>
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              {ARTICLE_COVERAGE_COPY}
            </p>
          </div>
          <Link href="mailto:rocketryhouse@gmail.com?subject=ICANEWS%20Global%20Research%20article%20request" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800">
            Request coverage
          </Link>
        </section>
      </div>
    </main>
  );
}

function PlanCard({
  name,
  price,
  features,
  badge,
  href,
  cta,
  highlighted = false
}: {
  name: string;
  price: string;
  features: string[];
  badge: string;
  href: string;
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${highlighted ? "border-orange-300 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-black">{name}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${highlighted ? "bg-orange-400 text-slate-950" : "bg-slate-100 text-slate-600"}`}>{badge}</span>
      </div>
      <p className="mt-4 text-3xl font-black">{price}</p>
      <ul className={`mt-5 space-y-3 text-sm font-semibold leading-6 ${highlighted ? "text-white/78" : "text-slate-600"}`}>
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            {highlighted ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
            {feature}
          </li>
        ))}
      </ul>
      <Link href={href} className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-black ${highlighted ? "bg-orange-400 text-slate-950 hover:bg-orange-300" : "bg-slate-950 text-white hover:bg-slate-800"}`}>
        {cta}
      </Link>
    </div>
  );
}
