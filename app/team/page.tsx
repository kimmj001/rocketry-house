import { Building2, CheckCircle2, Clock, GraduationCap, Rocket, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sampleOrganizations, sampleTeams } from "@/lib/team-data";

const approvalRequests = [
  ["DARE Propulsion Archive", "Global Student Rocketry Alliance", "Pending organization approval"],
  ["MIT Recovery Lab", "Global Student Rocketry Alliance", "Approved and ranking-linked"],
  ["PSAS Telemetry Crew", "Open Aerospace Systems Network", "Pending organization approval"]
] as const;

export default function TeamPage() {
  return (
    <main className="bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.22em] text-cyan-100/60">Team</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Personal builders, teams, and organizations in one engineering hierarchy</h1>
        <p className="mt-4 max-w-3xl text-orange-50/68">
          Rocketry House supports individual accounts, team accounts, and organization accounts. Organizations can contain multiple teams, approve membership requests, and compete on organization rankings.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            ["Personal", "Individual builders publish projects, save motors, join discussions, and contribute to team work.", Users],
            ["Team", "Rocket teams own shared projects and can request approval to belong to an organization.", Rocket],
            ["Organization", "Organizations contain two or more teams, approve team membership, and aggregate ranking score.", Building2]
          ].map(([title, copy, Icon]) => (
            <Card key={title as string} className="p-5">
              <Icon className="h-6 w-6 text-cyan-200" />
              <h2 className="mt-5 font-semibold">{title as string}</h2>
              <p className="mt-3 text-sm leading-6 text-orange-50/62">{copy as string}</p>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Teams</h2>
                <p className="mt-1 text-sm text-orange-50/58">Teams can be independent or approved under a parent organization.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button href="/auth/sign-up?type=team" asChild variant="outline">Create team</Button>
                <Button href="/auth/sign-up?type=organization" asChild variant="outline">Create organization</Button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {sampleTeams.map(([name, organization, projects, status]) => (
                <div key={name} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <Rocket className="h-5 w-5 text-cyan-200" />
                  <h3 className="mt-4 font-semibold">{name}</h3>
                  <p className="mt-1 text-sm text-orange-50/50">Organization: {organization}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <p className="rounded-md bg-white/[0.04] p-2">{projects}</p>
                    <p className="rounded-md bg-white/[0.04] p-2">{status}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Clock className="h-6 w-6 text-orange-200" />Organization approval</h2>
            <p className="mt-2 text-sm leading-6 text-orange-50/58">When a team says it is already part of an organization during signup, the organization receives an approval request. Approved teams become visible under that organization and contribute ranking points.</p>
            <div className="mt-5 space-y-3">
              {approvalRequests.map(([team, organization, status]) => (
                <div key={team} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{team}</p>
                      <p className="mt-1 text-sm text-orange-50/50">{organization}</p>
                    </div>
                    {status.startsWith("Approved") ? <CheckCircle2 className="h-5 w-5 text-cyan-200" /> : <Clock className="h-5 w-5 text-orange-200" />}
                  </div>
                  <p className="mt-3 text-xs text-orange-50/58">{status}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[380px_1fr]">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Trophy className="h-6 w-6 text-orange-200" />Organization ranking</h2>
            <p className="mt-2 text-sm leading-6 text-orange-50/58">Organization score aggregates approved teams: projects, verified launches, telemetry quality, downloads, reviews, and research publications.</p>
            <Button href="/ranking" asChild className="mt-5 w-full">View full rankings</Button>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {sampleOrganizations.map((organization, index) => (
              <Card key={organization.name} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <Building2 className="h-6 w-6 text-cyan-200" />
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-orange-50/62">{organization.ranking}</span>
                </div>
                <h3 className="mt-5 font-semibold">{organization.name}</h3>
                <p className="mt-2 text-sm text-orange-50/52">{organization.focus}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <p className="rounded-md bg-white/[0.04] p-2">{organization.teams.length} teams</p>
                  <p className="rounded-md bg-white/[0.04] p-2">{organization.score} score</p>
                  <p className="rounded-md bg-white/[0.04] p-2">approved</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {organization.teams.map((team) => <span key={team} className="rounded-md bg-white/[0.04] px-2 py-1 text-xs text-orange-50/58">{team}</span>)}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-4">
          {[
            ["Members", "Roles, specialties, verified builders, mentors", Users],
            ["Projects", "Rockets, motors, components, datasets", Rocket],
            ["Launch records", "Outcomes, telemetry, photos, recovery", GraduationCap],
            ["Rankings", "Team and organization scoreboards", Trophy]
          ].map(([title, copy, Icon]) => (
            <Card key={title as string} className="p-5">
              <Icon className="h-6 w-6 text-orange-200" />
              <h2 className="mt-5 font-semibold">{title as string}</h2>
              <p className="mt-3 text-sm leading-6 text-orange-50/62">{copy as string}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
