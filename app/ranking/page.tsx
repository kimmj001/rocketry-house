import { Award, BarChart3, Rocket, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { prestigeBadges, rankingCategories } from "@/lib/platform-content";

export default function RankingPage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/60">Rankings</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Rankings will open when real public activity exists.</h1>
        <p className="mt-4 max-w-3xl text-orange-50/68">
          Rocketry House no longer shows seeded leaderboard data. Accounts, teams, organizations, and projects will rank only from real
          posts, uploads, verified evidence, purchases, forks, reviews, and launch records.
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
