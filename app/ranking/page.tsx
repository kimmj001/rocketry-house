import { Award, BarChart3, Database, Rocket, Sigma, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { prestigeBadges, rankingCategories } from "@/lib/platform-content";
import { RANKING_CATEGORY_RULES, RANKING_EVENT_TYPES, RANKING_WEIGHT_GROUPS } from "@/lib/ranking";

export default function RankingPage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/60">Rankings</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Rankings will open when real public activity exists.</h1>
        <p className="mt-4 max-w-3xl text-orange-50/68">
          Rocketry House no longer shows seeded leaderboard data. Accounts, teams, organizations, and projects will rank only from real
          posts, uploads, verified evidence, forks, reviews, and launch records.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat icon={Users} label="Ranked accounts" value="0" />
          <Stat icon={Rocket} label="Ranked projects" value="0" />
          <Stat icon={Trophy} label="Team rankings" value="Pending" />
          <Stat icon={BarChart3} label="Organization rankings" value="Pending" />
        </div>

        <Card className="mt-8 p-8 text-center">
          <Award className="mx-auto h-10 w-10 text-orange-200" />
          <h2 className="mt-4 text-2xl font-semibold">No verified ranking records yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-orange-50/60">
            The leaderboard starts empty for public launch. Scores will be generated from real user projects and evidence after users publish
            work through Upload, Build, Community, and Profile activity.
          </p>
        </Card>

        <Card className="mt-8 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-cyan-100/60"><Sigma className="h-4 w-4" />Scoring engine</p>
              <h2 className="mt-3 text-2xl font-semibold">Project score is weighted, normalized, and evidence-first.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/62">
                Raw likes, forks, and downloads are log-scaled so popularity cannot overpower engineering evidence. Altitude is ranked as its
                own category, while the overall score balances evidence, performance, accuracy, reuse, community quality, and safety signals.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-orange-50/68">
              <p className="font-semibold text-orange-50">Overall score</p>
              <p className="mt-2">30% evidence + 20% engineering + 15% accuracy + 15% community + 10% reuse + 10% reliability - penalties</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RANKING_WEIGHT_GROUPS.map((group) => (
              <div key={group.key} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{group.label}</h3>
                  <span className="rounded-full bg-orange-200 px-2.5 py-1 text-xs font-semibold text-slate-950">{Math.round(group.weight * 100)}%</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-orange-50/58">{group.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-5 w-5 text-cyan-200" />Category rules</h2>
            <div className="mt-4 grid gap-3">
              {RANKING_CATEGORY_RULES.map((rule) => (
                <div key={rule.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{rule.label}</p>
                    <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs text-orange-50/62">{rule.scope}</span>
                  </div>
                  <p className="mt-2 text-sm text-orange-50/62">Primary: {rule.primaryMetric}</p>
                  <p className="mt-1 text-sm text-orange-50/45">Tiebreaker: {rule.tiebreaker}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Database className="h-5 w-5 text-cyan-200" />Signals captured</h2>
            <p className="mt-3 text-sm leading-6 text-orange-50/58">
              These events are the durable inputs the ranking engine expects from Supabase or local fallback persistence.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {RANKING_EVENT_TYPES.map((eventType) => (
                <span key={eventType} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-orange-50/62">{eventType.replaceAll("_", " ")}</span>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Ranking categories</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {rankingCategories.map((category) => <p key={category} className="rounded-md bg-white/[0.04] p-3 text-sm text-orange-50/68">{category}</p>)}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Prestige badges</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {prestigeBadges.map((badge) => <p key={badge} className="rounded-md bg-white/[0.04] p-3 text-sm text-orange-50/68">{badge}</p>)}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="p-5">
      <Icon className="h-5 w-5 text-orange-200" />
      <p className="mt-3 text-sm text-orange-50/58">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
