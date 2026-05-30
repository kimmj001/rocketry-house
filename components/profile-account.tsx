"use client";

import { useEffect, useState } from "react";
import { Award, BadgeCheck, Flame, RadioTower, Rocket, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectCard } from "@/components/project-card";
import { mockSavedMotors } from "@/lib/motor-library";
import { mockProjects } from "@/lib/mock-data";
import { readMockUser, type AuthUser } from "@/lib/auth";
import { prestigeBadges } from "@/lib/platform-content";
import { sampleOrganizations } from "@/lib/team-data";

export function ProfileAccount() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const sync = () => setUser(readMockUser());
    sync();
    setChecked(true);
    window.addEventListener("rocketry-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rocketry-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!checked) return null;

  if (!user) {
    return (
      <main className="min-h-screen bg-space-radial px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Card className="p-8">
            <UserRoundCheck className="h-9 w-9 text-orange-300" />
            <h1 className="mt-4 text-4xl font-semibold">Sign in to open your workshop.</h1>
            <p className="mt-3 max-w-2xl text-orange-50/68">Your saved motors, rocket CAD drafts, purchases, forks, and marketplace listings live under your Rocketry House account.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/auth/sign-in" asChild>Sign in</Button>
              <Button href="/auth/sign-up" asChild variant="outline">Create account</Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Card className="p-8">
          <UserRoundCheck className="h-9 w-9 text-orange-300" />
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-orange-100/55">{user.accountType} account</p>
          <h1 className="mt-2 text-4xl font-semibold">{user.name}</h1>
          <p className="mt-3 max-w-2xl text-orange-50/68">{user.email} / Aerospace engineering dossier for launches, simulations, motors, rankings, badges, telemetry, and published project repositories.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">{["14 projects", "4.8 rating", "212 forks", "Flight verified"].map((item) => <div key={item} className="rounded-lg bg-white/[0.05] p-3 text-sm">{item}</div>)}</div>
        </Card>
        <RoleWorkspace user={user} />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <Card className="p-5">
            <Award className="h-6 w-6 text-orange-200" />
            <h2 className="mt-4 font-semibold">Engineer level</h2>
            <p className="mt-2 text-2xl font-semibold">Level 18</p>
            <p className="mt-1 text-sm text-orange-50/55">Aerospace score 42,880</p>
          </Card>
          <Card className="p-5">
            <RadioTower className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Telemetry achievements</h2>
            <p className="mt-2 text-sm text-orange-50/58">18 mapped datasets, 7 verified altitude traces, 4 public launch dossiers.</p>
          </Card>
          <Card className="p-5">
            <BadgeCheck className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Specialties</h2>
            <p className="mt-2 text-sm text-orange-50/58">Propulsion analysis, flight systems, recovery design, telemetry review.</p>
          </Card>
        </div>
        <Card className="mt-8 p-5">
          <h2 className="font-semibold">Badges and certifications</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {prestigeBadges.map((badge) => <p key={badge} className="rounded-md bg-white/[0.04] p-3 text-xs text-orange-50/68">{badge}</p>)}
          </div>
        </Card>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Flame className="h-5 w-5 text-orange-200" />My saved motors</h2>
            <p className="mt-2 text-sm text-orange-50/62">Motors are personal account assets. Save them from Build &gt; Motor, then import them inside Build &gt; Rocket.</p>
            <div className="mt-4 space-y-3">
              {mockSavedMotors.map((motor) => (
                <div key={motor.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{motor.name}</span>
                    <span className="text-orange-100">{motor.estimatedClass}{motor.averageThrustN}</span>
                  </div>
                  <p className="mt-1 text-orange-50/55">{motor.totalImpulseNs} N-s total impulse, {motor.burnTimeS}s burn</p>
                </div>
              ))}
            </div>
            <Button href="/motors" asChild className="mt-4 w-full">Open motor library</Button>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5 text-cyan-200" />My rocket builds</h2>
            <p className="mt-2 text-sm text-orange-50/62">Rocket projects stay project-first: CAD, simulation, files, forks, discussions, and marketplace data remain attached to the rocket repository.</p>
            <div className="mt-4 grid gap-2 text-sm text-orange-50/68">
              <p>Draft rocket CAD: 2</p>
              <p>Published rocket repositories: 14</p>
              <p>Motors imported into rocket designs: 5</p>
            </div>
            <Button href="/build/rocket" asChild variant="outline" className="mt-4 w-full">Open rocket builder</Button>
          </Card>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">{mockProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} />)}</div>
      </div>
    </main>
  );
}

function RoleWorkspace({ user }: { user: AuthUser }) {
  if (user.accountType === "organization") {
    const organization = sampleOrganizations.find((item) => item.name === user.organizationName) ?? sampleOrganizations[0];
    return (
      <Card className="mt-8 p-5">
        <h2 className="font-semibold">Organization command center</h2>
        <p className="mt-2 text-sm text-orange-50/62">Approve team membership requests, monitor organization score, and manage team-level project portfolios.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Approved teams" value={String(organization.teams.length)} />
          <Metric label="Organization score" value={organization.score} />
          <Metric label="Ranking" value={organization.ranking} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {organization.teams.map((team) => <span key={team} className="rounded-md bg-white/[0.04] px-3 py-2 text-sm text-orange-50/64">{team}</span>)}
        </div>
        <Button href="/team" asChild variant="outline" className="mt-5">Open team directory</Button>
      </Card>
    );
  }

  if (user.accountType === "team") {
    return (
      <Card className="mt-8 p-5">
        <h2 className="font-semibold">Team workspace</h2>
        <p className="mt-2 text-sm text-orange-50/62">Shared rocket projects, motor libraries, upload releases, and organization membership status live here.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Parent organization" value={user.organizationName ?? "Independent"} />
          <Metric label="Approval status" value={user.organizationApprovalStatus ?? "none"} />
          <Metric label="Team ranking" value="#12" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/upload" asChild>Publish team project</Button>
          <Button href="/team" asChild variant="outline">Manage organization request</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-8 p-5">
      <h2 className="font-semibold">Personal workshop</h2>
      <p className="mt-2 text-sm text-orange-50/62">Save motors, build rockets, fork public projects, and request to join or create a team when collaboration starts.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button href="/build" asChild>Open Build</Button>
        <Button href="/team" asChild variant="outline">Find teams</Button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-orange-50/45">{label}</p><p className="mt-1 font-semibold text-orange-50">{value}</p></div>;
}
