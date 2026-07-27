"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BarChart3, FileDown, Mail, Megaphone, Newspaper, Plus, Send, ShieldCheck, Sparkles, Trophy, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeLimitCard, UsageCounter } from "@/components/usage-meter";
import { savePersistentRecord, loadPersistentRecords } from "@/lib/cloud-persistence";
import { checkoutHref } from "@/lib/checkout";
import {
  ARTICLE_COVERAGE_COPY,
  usageFieldsForAccount,
  type AccountType,
  type LimitedUsageField,
  type UsageStatus
} from "@/lib/usage-limits";
import type { AuthUser } from "@/lib/auth";

type FeatureRecord = {
  id: string;
  title: string;
  body?: string;
  accountId: string;
  accountType: AccountType;
  createdAt: string;
  status?: string;
};

type UsageClaimResult = {
  ok: boolean;
  data: {
    prompt?: { title: string; description: string };
    message?: string;
    error?: string;
  };
  status: number;
};

type AccountFeatureConsoleProps = {
  user: AuthUser;
  statuses: Record<LimitedUsageField, UsageStatus> | null;
  usageLoading: boolean;
  usageError: string;
  claimUsage: (field: LimitedUsageField) => Promise<UsageClaimResult>;
  refreshUsage: () => Promise<unknown>;
};

const collections = [
  "direct_messages",
  "team_members",
  "organization_member_teams",
  "broadcasts",
  "event_pages",
  "launch_logs",
  "sponsors",
  "custom_pages",
  "annual_reports",
  "article_requests"
] as const;

export function AccountFeatureConsole({ user, statuses, usageLoading, usageError, claimUsage, refreshUsage }: AccountFeatureConsoleProps) {
  const accountType = user.accountType;
  const tier = user.subscriptionTier ?? "standard";
  const isPro = tier === "pro";
  const [records, setRecords] = useState<Record<string, FeatureRecord[]>>({});
  const [notice, setNotice] = useState("");
  const [limitPrompt, setLimitPrompt] = useState<{ title: string; description: string } | null>(null);
  const [messageText, setMessageText] = useState("Could we compare recovery data after your next launch?");
  const [teamName, setTeamName] = useState(accountType === "team" ? "New avionics member" : "North Star Rocketry Team");
  const [broadcastText, setBroadcastText] = useState("Registration is open for the next static-fire review window.");
  const [eventTitle, setEventTitle] = useState("Regional Rocketry Design Review");
  const [launchTitle, setLaunchTitle] = useState("Launch log T+0");
  const [sponsorName, setSponsorName] = useState("Aero Materials Lab");
  const [customPageTitle, setCustomPageTitle] = useState(`${user.name} public page`);

  const usageFields = useMemo(() => usageFieldsForAccount(accountType), [accountType]);
  const verifiedLabel = accountType === "organization" ? "Verified Organization badge" : accountType === "team" ? "Verified Team badge" : "Verified Builder badge";
  const articleHref = articleMailto(user);

  const refreshRecords = useCallback(async () => {
    const entries = await Promise.all(collections.map(async (collection) => {
      const loaded = await loadPersistentRecords<FeatureRecord>(collection);
      return [collection, loaded.map((record) => record.payload).filter((record) => record.accountId === user.id)] as const;
    }));
    setRecords(Object.fromEntries(entries));
  }, [user.id]);

  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  async function saveFeatureRecord(collection: typeof collections[number], title: string, body?: string, status = "active") {
    const now = new Date().toISOString();
    const record: FeatureRecord = {
      id: `${collection}-${Date.now()}`,
      title,
      body,
      accountId: user.id,
      accountType,
      createdAt: now,
      status
    };
    await savePersistentRecord(collection, record.id, record);
    await refreshRecords();
    setNotice(`${title} saved.`);
  }

  async function claimThenSave(field: LimitedUsageField, collection: typeof collections[number], title: string, body?: string) {
    setLimitPrompt(null);
    const claim = await claimUsage(field);
    if (!claim.ok) {
      const prompt = claim.data.prompt ?? {
        title: claim.data.message ?? "Cloud usage sync required.",
        description: claim.data.error ?? "Sign in with a cloud account before using limited plan features."
      };
      setLimitPrompt(prompt);
      setNotice(prompt.title);
      return;
    }

    await saveFeatureRecord(collection, title, body);
    await refreshUsage();
  }

  function requirePro(action: () => void, description: string) {
    if (isPro) {
      action();
      return;
    }
    setLimitPrompt({ title: "This feature is included with Pro.", description });
    setNotice("Upgrade to Pro to use this feature.");
  }

  function exportPortfolioPdf() {
    requirePro(() => {
      downloadPdf("rocketry-house-portfolio.pdf", "Rocketry House Portfolio", [
        `Account: ${user.name}`,
        `Type: ${accountType}`,
        `Plan: ${tier}`,
        `Profile: ${user.headline ?? "Builder profile"}`,
        `Projects used: ${statuses?.projectsCreatedCount?.used ?? 0}`,
        `CFD runs used: ${statuses?.cfdRunsUsed?.used ?? 0}`,
        `Messages used: ${statuses?.dmSentCount?.used ?? 0}`,
        `Launch logs: ${records.launch_logs?.length ?? 0}`,
        `Sponsors: ${records.sponsors?.length ?? 0}`
      ]);
      setNotice("Portfolio PDF generated.");
    }, "Upgrade to Personal Pro to export a portfolio PDF.");
  }

  function exportAnnualReport() {
    requirePro(() => {
      const year = new Date().getFullYear();
      downloadPdf(`rocketry-house-annual-report-${year}.pdf`, `${year} Organization Report`, [
        `Organization: ${user.name}`,
        `Member teams: ${records.organization_member_teams?.length ?? 0}`,
        `Broadcasts: ${records.broadcasts?.length ?? 0}`,
        `Event pages: ${records.event_pages?.length ?? 0}`,
        `Sponsors: ${records.sponsors?.length ?? 0}`,
        `Messages used: ${statuses?.dmSentCount?.used ?? 0}`,
        `Generated for ICANEWS-ready reporting and internal review.`
      ]);
      void saveFeatureRecord("annual_reports", `${year} annual report`, "Generated PDF report.", "generated");
    }, "Upgrade to Organization Pro to generate annual reports.");
  }

  return (
    <Card className="mt-8 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-100/58">Plan capabilities</p>
          <h2 className="mt-2 text-2xl font-semibold">{accountTitle(accountType)} {titleCase(tier)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-50/62">
            Every limited action checks cloud usage first. Pro accounts keep analytics counts while removing Standard quota blocks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-orange-50">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            {verifiedLabel}: {isPro ? "active" : "Pro only"}
          </span>
          {!isPro ? (
            <Link href={checkoutHref(accountType)} className="inline-flex h-10 items-center rounded-md bg-orange-400 px-4 text-sm font-bold text-slate-950 hover:bg-orange-300">
              Upgrade to Pro
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {usageFields.map((item) => (
          <UsageCounter
            key={item.field}
            label={item.label}
            status={statuses?.[item.field]}
            periodText={item.periodText}
            loading={usageLoading}
            error={usageError}
          />
        ))}
      </div>

      {limitPrompt ? (
        <div className="mt-4">
          <UpgradeLimitCard accountType={accountType} title={limitPrompt.title} description={limitPrompt.description} onDismiss={() => setLimitPrompt(null)} />
        </div>
      ) : null}
      {notice ? <p className="mt-3 text-sm font-semibold text-emerald-100/80">{notice}</p> : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <FeatureCard icon={Send} title="Direct messaging" detail="Send tracked account messages. Standard plans stop at the exact monthly quota.">
          <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} className="min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
          <Button className="mt-3 w-full" onClick={() => void claimThenSave("dmSentCount", "direct_messages", "Direct message", messageText)}>
            <Send className="h-4 w-4" />
            Send message
          </Button>
        </FeatureCard>

        {accountType === "personal" ? (
          <>
            <FeatureCard icon={BadgeCheck} title="Public profile and portfolio" detail="Standard accounts publish a profile and basic portfolio from saved public work.">
              <Button href="/profile" asChild variant="outline" className="w-full">Open public profile</Button>
              <Button className="mt-3 w-full" onClick={exportPortfolioPdf} variant={isPro ? "default" : "outline"}>
                <FileDown className="h-4 w-4" />
                Export portfolio PDF
              </Button>
            </FeatureCard>
            <FeatureCard icon={Trophy} title="Launch log" detail="Personal Pro keeps launch logs attached to the builder profile.">
              <input value={launchTitle} onChange={(event) => setLaunchTitle(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => requirePro(() => void saveFeatureRecord("launch_logs", launchTitle, "Personal launch log"), "Upgrade to Personal Pro to keep launch logs.")}>
                <Plus className="h-4 w-4" />
                Add launch log
              </Button>
            </FeatureCard>
          </>
        ) : null}

        {accountType === "team" ? (
          <>
            <FeatureCard icon={Users} title="Team members" detail="Team Standard includes up to 10 members; Team Pro removes the member limit.">
              <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => void claimThenSave("memberTeamsCount", "team_members", teamName, "Team member")}>
                <Plus className="h-4 w-4" />
                Add member
              </Button>
            </FeatureCard>
            <FeatureCard icon={Sparkles} title="Custom team page" detail="Team Pro can save a custom public page and sponsor-ready presentation.">
              <input value={customPageTitle} onChange={(event) => setCustomPageTitle(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => requirePro(() => void saveFeatureRecord("custom_pages", customPageTitle, "Custom team page"), "Upgrade to Team Pro to save a custom team page.")}>
                <Sparkles className="h-4 w-4" />
                Save custom page
              </Button>
            </FeatureCard>
            <FeatureCard icon={Trophy} title="Sponsor and launch records" detail="Team Pro manages sponsors and launch records from one workspace.">
              <input value={sponsorName} onChange={(event) => setSponsorName(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => requirePro(() => void saveFeatureRecord("sponsors", sponsorName, "Team sponsor"), "Upgrade to Team Pro to display sponsors.")}>Add sponsor</Button>
              <Button className="mt-2 w-full" variant="outline" onClick={() => requirePro(() => void saveFeatureRecord("launch_logs", launchTitle, "Team launch record"), "Upgrade to Team Pro for launch record management.")}>Add launch record</Button>
            </FeatureCard>
          </>
        ) : null}

        {accountType === "organization" ? (
          <>
            <FeatureCard icon={Users} title="Member teams" detail="Organization Standard includes 5 member teams; Organization Pro removes the limit.">
              <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => void claimThenSave("memberTeamsCount", "organization_member_teams", teamName, "Approved member team")}>
                <Plus className="h-4 w-4" />
                Add member team
              </Button>
            </FeatureCard>
            <FeatureCard icon={Megaphone} title="Broadcast announcements" detail="Organization Standard includes 3 broadcasts per month.">
              <textarea value={broadcastText} onChange={(event) => setBroadcastText(event.target.value)} className="min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => void claimThenSave("broadcastCount", "broadcasts", "Broadcast announcement", broadcastText)}>
                <Megaphone className="h-4 w-4" />
                Publish broadcast
              </Button>
            </FeatureCard>
            <FeatureCard icon={Trophy} title="Event and competition pages" detail="Organization Standard includes 1 active event or competition page.">
              <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => void claimThenSave("activeEventPagesCount", "event_pages", eventTitle, "Active event page")}>
                <Plus className="h-4 w-4" />
                Create event page
              </Button>
            </FeatureCard>
            <FeatureCard icon={BarChart3} title="Analytics and annual report" detail="Organization Pro unlocks analytics, sponsor pages, and annual report generation.">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Teams" value={(records.organization_member_teams?.length ?? 0).toString()} />
                <Metric label="Broadcasts" value={(records.broadcasts?.length ?? 0).toString()} />
                <Metric label="Events" value={(records.event_pages?.length ?? 0).toString()} />
                <Metric label="Sponsors" value={(records.sponsors?.length ?? 0).toString()} />
              </div>
              <input value={sponsorName} onChange={(event) => setSponsorName(event.target.value)} className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none" />
              <Button className="mt-3 w-full" onClick={() => requirePro(() => void saveFeatureRecord("sponsors", sponsorName, "Organization sponsor page"), "Upgrade to Organization Pro to manage sponsor pages.")}>Add sponsor</Button>
              <Button className="mt-2 w-full" variant="outline" onClick={exportAnnualReport}>Generate annual report</Button>
            </FeatureCard>
          </>
        ) : null}

        <FeatureCard icon={Newspaper} title="Article request by email" detail={ARTICLE_COVERAGE_COPY}>
          {isPro ? (
            <Button href={articleHref} asChild className="w-full">
              Request ICANEWS coverage
            </Button>
          ) : (
            <Link href={checkoutHref(accountType)} className="inline-flex h-10 w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 text-sm font-medium hover:bg-white/10">
              Upgrade for article requests
            </Link>
          )}
          <Button variant="outline" className="mt-3 w-full" onClick={() => requirePro(() => void saveFeatureRecord("article_requests", "ICANEWS Global Research article request", ARTICLE_COVERAGE_COPY, "requested"), "Article requests are included with Pro plans.")}>
            <Mail className="h-4 w-4" />
            Log article request
          </Button>
        </FeatureCard>
      </div>
    </Card>
  );
}

function FeatureCard({ icon: Icon, title, detail, children }: { icon: LucideIcon; title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-orange-200">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-orange-50">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-orange-50/58">{detail}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.05] p-2">
      <p className="text-xs text-orange-50/45">{label}</p>
      <p className="font-semibold text-orange-50">{value}</p>
    </div>
  );
}

function articleMailto(user: AuthUser) {
  const subject = encodeURIComponent("ICANEWS Global Research article request");
  const body = encodeURIComponent([
    "Hello Rocketry House team,",
    "",
    "Please forward this completed project, launch, event, or competition coverage request to the partner journalists at ICANEWS Global Research.",
    "",
    `Requester: ${user.name}`,
    `Account type: ${user.accountType}`,
    `Email: ${user.email}`,
    "",
    "Coverage notes:"
  ].join("\n"));
  return `mailto:rocketryhouse@gmail.com?subject=${subject}&body=${body}`;
}

function accountTitle(accountType: AccountType) {
  return accountType === "organization" ? "Organization" : accountType === "team" ? "Team" : "Personal";
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function downloadPdf(filename: string, title: string, lines: string[]) {
  const textLines = [title, "", ...lines].flatMap((line) => wrapLine(line, 78)).slice(0, 44);
  const escapedLines = textLines.map((line) => `(${escapePdfText(line)}) Tj T*`).join("\n");
  const stream = `BT\n/F1 14 Tf\n18 TL\n72 760 Td\n${escapedLines}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n");
  pdf += `\ntrailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapePdfText(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function wrapLine(value: string, width: number) {
  if (value.length <= width) return [value];
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}
