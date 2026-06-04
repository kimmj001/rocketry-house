"use client";

import { useEffect, useState } from "react";
import { Award, BadgeCheck, Flame, RadioTower, Rocket, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectCard } from "@/components/project-card";
import { mockSavedMotors } from "@/lib/motor-library";
import { mockProjects } from "@/lib/mock-data";
import { isDemoAccount, readMockUser, type AuthUser, writeMockUser } from "@/lib/auth";
import { prestigeBadges } from "@/lib/platform-content";
import { sampleOrganizations } from "@/lib/team-data";
import { savePersistentRecord, uploadPersistentFiles } from "@/lib/cloud-persistence";

export function ProfileAccount() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");

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

  const demoProfile = isDemoAccount(user);
  const stats = demoProfile
    ? ["14 projects", "4.8 rating", "212 forks", "Flight verified"]
    : ["0 projects", "No rating yet", "0 forks", "Not verified"];
  const savedMotors = demoProfile ? mockSavedMotors : [];
  const visibleProjects = demoProfile ? mockProjects.slice(0, 3) : [];
  const badges = demoProfile ? prestigeBadges : ["New builder profile"];

  async function updateProfilePhoto(file: File | undefined) {
    if (!file || !user) return;
    setPhotoStatus("Saving profile photo...");

    const reader = new FileReader();
    reader.onload = () => {
      const localPreview = typeof reader.result === "string" ? reader.result : undefined;
      if (!localPreview) return;
      const previewUser = { ...user, avatarUrl: localPreview };
      writeMockUser(previewUser);
      setUser(previewUser);
    };
    reader.readAsDataURL(file);

    try {
      const records = await uploadPersistentFiles("profile-photo", [file]);
      const publicUrl = records[0]?.publicUrl;
      const nextUser = { ...readMockUser(), ...user, avatarUrl: publicUrl ?? readMockUser()?.avatarUrl ?? user.avatarUrl } as AuthUser;
      writeMockUser(nextUser);
      setUser(nextUser);
      await savePersistentRecord("profiles", nextUser.id, nextUser);
      setPhotoStatus(publicUrl ? "Profile photo synced to cloud storage." : "Profile photo saved locally. Cloud file storage will sync when Supabase Storage accepts uploads.");
    } catch {
      const fallback = readMockUser() ?? user;
      await savePersistentRecord("profiles", fallback.id, fallback);
      setPhotoStatus("Profile photo saved locally. Cloud sync could not complete.");
    }
  }

  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Card className="p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <label className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`${user.name} profile`} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-4xl font-bold text-orange-100">{user.name[0] ?? "R"}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">Change photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void updateProfilePhoto(event.target.files?.[0])} />
            </label>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <UserRoundCheck className="h-7 w-7 text-orange-300" />
                <p className="text-sm uppercase tracking-[0.18em] text-orange-100/55">{user.accountType} account</p>
              </div>
              <h1 className="mt-2 text-4xl font-semibold">{user.name}</h1>
              <p className="mt-3 max-w-2xl text-orange-50/68">{user.email} / Aerospace engineering dossier for launches, simulations, motors, rankings, badges, telemetry, and published project repositories.</p>
              <p className="mt-3 text-sm text-orange-50/52">Profile photo appears across account navigation, community posts, and comments.</p>
              {photoStatus ? <p className="mt-2 text-sm text-emerald-100/80">{photoStatus}</p> : null}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">{stats.map((item) => <div key={item} className="rounded-lg bg-white/[0.05] p-3 text-sm">{item}</div>)}</div>
        </Card>
        <RoleWorkspace user={user} demoProfile={demoProfile} />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <Card className="p-5">
            <Award className="h-6 w-6 text-orange-200" />
            <h2 className="mt-4 font-semibold">Engineer level</h2>
            <p className="mt-2 text-2xl font-semibold">{demoProfile ? "Level 18" : "Level 1"}</p>
            <p className="mt-1 text-sm text-orange-50/55">{demoProfile ? "Aerospace score 42,880" : "Aerospace score 0. Publish verified work to start ranking."}</p>
          </Card>
          <Card className="p-5">
            <RadioTower className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Telemetry achievements</h2>
            <p className="mt-2 text-sm text-orange-50/58">{demoProfile ? "18 mapped datasets, 7 verified altitude traces, 4 public launch dossiers." : "No telemetry has been attached yet. Upload flight data from a project or launch log."}</p>
          </Card>
          <Card className="p-5">
            <BadgeCheck className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Specialties</h2>
            <p className="mt-2 text-sm text-orange-50/58">{demoProfile ? "Propulsion analysis, flight systems, recovery design, telemetry review." : "Specialties appear after your saved motors, rocket projects, and verified evidence accumulate."}</p>
          </Card>
        </div>
        <Card className="mt-8 p-5">
          <h2 className="font-semibold">Badges and certifications</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {badges.map((badge) => <p key={badge} className="rounded-md bg-white/[0.04] p-3 text-xs text-orange-50/68">{badge}</p>)}
          </div>
        </Card>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Flame className="h-5 w-5 text-orange-200" />My saved motors</h2>
            <p className="mt-2 text-sm text-orange-50/62">Motors are personal account assets. Save them from Build &gt; Motor, then import them inside Build &gt; Rocket.</p>
            <div className="mt-4 space-y-3">
              {savedMotors.length ? savedMotors.map((motor) => (
                <div key={motor.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{motor.name}</span>
                    <span className="text-orange-100">{motor.estimatedClass}{motor.averageThrustN}</span>
                  </div>
                  <p className="mt-1 text-orange-50/55">{motor.totalImpulseNs} N-s total impulse, {motor.burnTimeS}s burn</p>
                </div>
              )) : <EmptyState title="No saved motors yet" body="Build and simulate a motor, then save it to make it available in your rocket designs." />}
            </div>
            <Button href={savedMotors.length ? "/motors" : "/build/motor"} asChild className="mt-4 w-full">{savedMotors.length ? "Open motor library" : "Build first motor"}</Button>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5 text-cyan-200" />My rocket builds</h2>
            <p className="mt-2 text-sm text-orange-50/62">Rocket projects stay project-first: CAD, simulation, files, forks, discussions, and marketplace data remain attached to the rocket repository.</p>
            <div className="mt-4 grid gap-2 text-sm text-orange-50/68">
              <p>Draft rocket CAD: {demoProfile ? "2" : "0"}</p>
              <p>Published rocket repositories: {demoProfile ? "14" : "0"}</p>
              <p>Motors imported into rocket designs: {demoProfile ? "5" : "0"}</p>
            </div>
            <Button href="/build/rocket" asChild variant="outline" className="mt-4 w-full">Open rocket builder</Button>
          </Card>
        </div>
        {visibleProjects.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
        ) : (
          <Card className="mt-8 p-6">
            <h2 className="font-semibold">No public projects yet</h2>
            <p className="mt-2 text-sm text-orange-50/58">Your published rockets, motors, launch logs, and marketplace releases will appear here after upload.</p>
            <Button href="/upload" asChild variant="outline" className="mt-4">Prepare first upload</Button>
          </Card>
        )}
      </div>
    </main>
  );
}

function RoleWorkspace({ user, demoProfile }: { user: AuthUser; demoProfile: boolean }) {
  if (user.accountType === "organization") {
    const organization = sampleOrganizations.find((item) => item.name === user.organizationName);
    return (
      <Card className="mt-8 p-5">
        <h2 className="font-semibold">Organization command center</h2>
        <p className="mt-2 text-sm text-orange-50/62">Approve team membership requests, monitor organization score, and manage team-level project portfolios.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Approved teams" value={demoProfile && organization ? String(organization.teams.length) : "0"} />
          <Metric label="Organization score" value={demoProfile && organization ? organization.score : "0"} />
          <Metric label="Ranking" value={demoProfile && organization ? organization.ranking : "Unranked"} />
        </div>
        {demoProfile && organization ? <div className="mt-4 flex flex-wrap gap-2">
          {organization.teams.map((team) => <span key={team} className="rounded-md bg-white/[0.04] px-3 py-2 text-sm text-orange-50/64">{team}</span>)}
        </div> : <EmptyState title="No teams approved yet" body="Team approval requests will appear here after teams request membership in this organization." />}
        <Button href="/ranking" asChild variant="outline" className="mt-5">Open organization ranking</Button>
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
          <Metric label="Team ranking" value={demoProfile ? "#12" : "Unranked"} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/upload" asChild>Publish team project</Button>
          <Button href="/profile" asChild variant="outline">Manage organization request</Button>
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
        <Button href="/ranking" asChild variant="outline">View team rankings</Button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-orange-50/45">{label}</p><p className="mt-1 font-semibold text-orange-50">{value}</p></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm">
      <p className="font-semibold text-orange-50">{title}</p>
      <p className="mt-1 text-orange-50/55">{body}</p>
    </div>
  );
}
