import Image from "next/image";
import Link from "next/link";
import { Award, Download, GitFork, Heart, Rocket, Star, Trophy, Users } from "lucide-react";
import { VerificationBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock-data";
import { prestigeBadges, rankingCategories } from "@/lib/platform-content";
import { sampleOrganizations, sampleTeams } from "@/lib/team-data";

type RankedProject = (typeof mockProjects)[number] & {
  likes: number;
  rating: number;
  score: number;
};

type RankedCreator = {
  creator: string;
  projects: RankedProject[];
  likes: number;
  forks: number;
  downloads: number;
  avgRating: number;
  verified: number;
  score: number;
};

function projectLikes(project: (typeof mockProjects)[number], index: number) {
  return Math.round(project.downloadCount * 0.18 + project.forkCount * 8 + (project.actualAltitudeM ?? project.predictedAltitudeM) / 180 + 120 - index * 9);
}

function projectRating(project: (typeof mockProjects)[number], index: number) {
  const evidenceBonus = project.verifiedFlight || project.hasTelemetry ? 0.18 : project.hasThrustData ? 0.1 : 0;
  return Number(Math.min(5, project.creatorRating + evidenceBonus + (index % 3) * 0.04).toFixed(2));
}

const rankedProjects: RankedProject[] = mockProjects
  .map((project, index) => {
    const likes = projectLikes(project, index);
    const rating = projectRating(project, index);
    const score = Math.round(likes * 2.4 + rating * 420 + project.forkCount * 18 + project.downloadCount * 0.35 + (project.verifiedFlight ? 900 : 0));
    return { ...project, likes, rating, score };
  })
  .sort((a, b) => b.score - a.score);

const rankedCreators: RankedCreator[] = Object.values(
  rankedProjects.reduce<Record<string, RankedCreator>>((acc, project) => {
    acc[project.creator] ??= { creator: project.creator, projects: [], likes: 0, forks: 0, downloads: 0, avgRating: 0, verified: 0, score: 0 };
    acc[project.creator].projects.push(project);
    acc[project.creator].likes += project.likes;
    acc[project.creator].forks += project.forkCount;
    acc[project.creator].downloads += project.downloadCount;
    acc[project.creator].verified += project.verifiedFlight || project.verificationStatus === "Telemetry attached" || project.verificationStatus === "Media proof" ? 1 : 0;
    return acc;
  }, {})
)
  .map((creator) => {
    const avgRating = creator.projects.reduce((sum, project) => sum + project.rating, 0) / creator.projects.length;
    const score = Math.round(creator.likes * 2.4 + creator.forks * 22 + creator.downloads * 0.45 + avgRating * 520 + creator.verified * 850);
    return { ...creator, avgRating: Number(avgRating.toFixed(2)), score };
  })
  .sort((a, b) => b.score - a.score);

function formatNumber(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function RankingPage() {
  const leader = rankedCreators[0];
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/60">Rankings</p>
            <h1 className="mt-3 text-4xl font-semibold">Prestige ranking for builders, teams, schools, and organizations</h1>
            <p className="mt-4 max-w-3xl text-orange-50/68">
              Accounts compete through engineering output: likes, star ratings, verified launches, simulation accuracy, motor datasets, forks, downloads, telemetry quality, and public project impact.
            </p>
          </div>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-orange-300 p-2 text-[#16100b]"><Trophy className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-orange-50/50">Current leader</p>
                <h2 className="font-semibold">{leader.creator}</h2>
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold">{formatNumber(leader.score)}</p>
            <p className="mt-1 text-sm text-orange-50/58">combined account score</p>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat icon={Users} label="Ranked accounts" value={rankedCreators.length.toString()} />
          <Stat icon={Rocket} label="Ranked projects" value={rankedProjects.length.toString()} />
          <Stat icon={Heart} label="Total likes" value={formatNumber(rankedCreators.reduce((sum, creator) => sum + creator.likes, 0))} />
          <Stat icon={Star} label="Top average rating" value={Math.max(...rankedCreators.map((creator) => creator.avgRating)).toFixed(2)} />
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Award className="h-5 w-5 text-orange-200" />Account leaderboard</h2>
            <div className="mt-5 space-y-3">
              {rankedCreators.map((creator, index) => (
                <Link key={creator.creator} href={`/profile?creator=${encodeURIComponent(creator.creator)}`} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07] sm:grid-cols-[44px_1fr_auto]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 font-semibold">#{index + 1}</div>
                  <div>
                    <h3 className="font-semibold">{creator.creator}</h3>
                    <p className="mt-1 text-sm text-orange-50/58">{creator.projects.length} project{creator.projects.length > 1 ? "s" : ""} / {creator.verified} evidence-backed</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-orange-50/64">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatNumber(creator.likes)}</span>
                      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{creator.avgRating}</span>
                      <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{formatNumber(creator.forks)}</span>
                      <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" />{formatNumber(creator.downloads)}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold">{formatNumber(creator.score)}</p>
                    <p className="text-xs text-orange-50/50">score</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5 text-cyan-200" />Project ranking</h2>
            <div className="mt-5 space-y-3">
              {rankedProjects.map((project, index) => (
                <Link key={project.id} href={`/projects/${project.slug}`} className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07] sm:grid-cols-[72px_1fr_auto]">
                  <div className="relative h-16 overflow-hidden rounded-md bg-white/[0.03]">
                    <Image src={project.image} alt={project.title} fill className="object-contain p-1" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs">#{index + 1}</span>
                      <VerificationBadge status={project.verificationStatus} />
                    </div>
                    <h3 className="mt-2 font-semibold">{project.title}</h3>
                    <p className="mt-1 text-sm text-orange-50/58">by {project.creator}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-orange-50/64">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatNumber(project.likes)}</span>
                      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{project.rating}</span>
                      <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{formatNumber(project.forkCount)}</span>
                      <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" />{formatNumber(project.downloadCount)}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold">{formatNumber(project.score)}</p>
                    <p className="text-xs text-orange-50/50">project score</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-cyan-200" />Team ranking</h2>
            <div className="mt-5 space-y-3">
              {sampleTeams.map(([team, organization, projects, status], index) => (
                <div key={team} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[44px_1fr_auto]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 font-semibold">#{index + 1}</div>
                  <div>
                    <h3 className="font-semibold">{team}</h3>
                    <p className="mt-1 text-sm text-orange-50/58">{organization}</p>
                    <p className="mt-2 text-xs text-orange-50/45">{projects} / {status}</p>
                  </div>
                  <p className="text-lg font-semibold sm:text-right">{formatNumber(42000 - index * 2310)}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5 text-orange-200" />Organization ranking</h2>
            <div className="mt-5 space-y-3">
              {sampleOrganizations.map((organization) => (
                <div key={organization.name} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{organization.name}</h3>
                      <p className="mt-1 text-sm text-orange-50/58">{organization.focus}</p>
                    </div>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-sm text-orange-50/68">{organization.ranking}</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MetricText label="Teams" value={String(organization.teams.length)} />
                    <MetricText label="Score" value={organization.score} />
                    <MetricText label="Status" value="approved" />
                  </div>
                </div>
              ))}
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

function MetricText({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-white/[0.04] p-3"><p className="text-xs text-orange-50/45">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
