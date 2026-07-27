"use client";

import { useEffect, useState } from "react";
import { Award, BadgeCheck, Flame, Globe, MapPin, Pencil, RadioTower, Rocket, Save, UserRoundCheck, X } from "lucide-react";
import { AccountFeatureConsole } from "@/components/account-feature-console";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UsageCounter } from "@/components/usage-meter";
import { readMockUser, restoreAuthUserFromCloud, saveAuthUserProfileToCloud, type AuthUser, updateLocalAccountUser, writeMockUser } from "@/lib/auth";
import { loadPersistentRecords, savePersistentRecord, uploadPersistentFiles } from "@/lib/cloud-persistence";
import { useCloudUsage } from "@/lib/use-cloud-usage";
import { usageFieldsForAccount } from "@/lib/usage-limits";
import type { SavedMotor } from "@/types/motor";

type StoredRocketProject = {
  id?: string;
  slug?: string;
  name?: string;
  status?: string;
  source?: string;
  summary?: {
    predictedAltitudeM?: number;
    motorClass?: string;
    propellantFamily?: string;
    evidenceFileCount?: number;
  };
  updatedAt?: string;
  publishedAt?: string;
};

export function ProfileAccount() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [editing, setEditing] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [savedMotors, setSavedMotors] = useState<SavedMotor[]>([]);
  const [rocketProjects, setRocketProjects] = useState<StoredRocketProject[]>([]);
  const { usage, statuses, loading: usageLoading, error: usageError, claimUsage, refreshUsage } = useCloudUsage();
  const [draft, setDraft] = useState({
    name: "",
    headline: "",
    bio: "",
    location: "",
    website: "",
    specialties: "",
    accountType: "personal" as AuthUser["accountType"],
    organizationName: ""
  });

  useEffect(() => {
    const sync = () => {
      const nextUser = readMockUser();
      setUser(nextUser);
      if (nextUser) setDraftFromUser(nextUser);
    };
    sync();
    void restoreAuthUserFromCloud().then((cloudUser) => {
      setUser(cloudUser);
      if (cloudUser) setDraftFromUser(cloudUser);
    });
    setChecked(true);
    window.addEventListener("rocketry-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rocketry-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedMotors([]);
      setRocketProjects([]);
      return;
    }

    void Promise.all([
      loadPersistentRecords<SavedMotor>("saved_motors"),
      loadPersistentRecords<StoredRocketProject>("rocket_projects")
    ]).then(([motorRecords, projectRecords]) => {
      setSavedMotors(motorRecords.map((record) => record.payload));
      setRocketProjects(projectRecords.map((record) => record.payload));
    });
  }, [user]);

  function setDraftFromUser(nextUser: AuthUser) {
    setDraft({
      name: nextUser.name ?? "",
      headline: nextUser.headline ?? "",
      bio: nextUser.bio ?? "",
      location: nextUser.location ?? "",
      website: nextUser.website ?? "",
      specialties: nextUser.specialties ?? "",
      accountType: nextUser.accountType,
      organizationName: nextUser.organizationName ?? ""
    });
  }

  if (!checked) return null;

  if (!user) {
    return (
      <main className="min-h-screen bg-space-radial px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Card className="p-8">
            <UserRoundCheck className="h-9 w-9 text-orange-300" />
            <h1 className="mt-4 text-4xl font-semibold">Sign in to open your workshop.</h1>
            <p className="mt-3 max-w-2xl text-orange-50/68">Your saved motors, rocket CAD drafts, forks, upload archives, and profile activity live under your Rocketry House account.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/auth/sign-in" asChild>Sign in</Button>
              <Button href="/auth/sign-up" asChild variant="outline">Create account</Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const publishedProjects = rocketProjects.filter((project) => project.status === "published");
  const draftProjects = rocketProjects.filter((project) => project.status !== "published");
  const importedMotorProjects = rocketProjects.filter((project) => project.summary?.motorClass || project.summary?.propellantFamily);
  const aerospaceScore = publishedProjects.length * 120 + savedMotors.length * 35 + importedMotorProjects.length * 45;
  const badges = user.specialties
    ? user.specialties.split(",").map((badge) => badge.trim()).filter(Boolean).slice(0, 7)
    : ["New builder profile"];
  const stats = [
    `${rocketProjects.length} projects`,
    `${savedMotors.length} motors`,
    "No rating yet",
    publishedProjects.length ? "Published" : "Not verified"
  ];
  const planUser: AuthUser = usage
    ? { ...user, accountType: usage.accountType, subscriptionTier: usage.subscriptionTier }
    : { ...user, subscriptionTier: user.subscriptionTier ?? "standard" };
  const planUsageFields = usageFieldsForAccount(planUser.accountType);

  async function updateProfilePhoto(file: File | undefined) {
    if (!file || !user) return;
    setPhotoStatus("Saving profile photo...");

    const reader = new FileReader();
    reader.onload = () => {
      const localPreview = typeof reader.result === "string" ? reader.result : undefined;
      if (!localPreview) return;
      const previewUser = { ...user, avatarUrl: localPreview };
      writeMockUser(previewUser);
      updateLocalAccountUser(previewUser);
      setUser(previewUser);
    };
    reader.readAsDataURL(file);

    try {
      const records = await uploadPersistentFiles("profile-photo", [file]);
      const publicUrl = records[0]?.publicUrl;
      const nextUser = { ...readMockUser(), ...user, avatarUrl: publicUrl ?? readMockUser()?.avatarUrl ?? user.avatarUrl } as AuthUser;
      writeMockUser(nextUser);
      updateLocalAccountUser(nextUser);
      setUser(nextUser);
      const cloudResult = await saveAuthUserProfileToCloud(nextUser);
      await savePersistentRecord("profiles", nextUser.id, nextUser);
      setPhotoStatus(publicUrl || cloudResult.cloud ? "Profile photo synced to account." : "Profile photo saved locally. Cloud file storage will sync when Supabase Storage accepts uploads.");
    } catch {
      const fallback = readMockUser() ?? user;
      await savePersistentRecord("profiles", fallback.id, fallback);
      setPhotoStatus("Profile photo saved locally. Cloud sync could not complete.");
    }
  }

  async function saveProfileEdits() {
    if (!user) return;
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setProfileStatus("Name is required.");
      return;
    }

    const nextUser: AuthUser = {
      ...user,
      name: trimmedName,
      headline: draft.headline.trim() || undefined,
      bio: draft.bio.trim() || undefined,
      location: draft.location.trim() || undefined,
      website: draft.website.trim() || undefined,
      specialties: draft.specialties.trim() || undefined,
      accountType: draft.accountType,
      organizationName: draft.accountType === "personal" ? undefined : draft.organizationName.trim() || undefined,
      organizationApprovalStatus:
        draft.accountType === "organization"
          ? "approved"
          : draft.accountType === "team"
            ? user.organizationApprovalStatus ?? "requested"
            : "none"
    };

    writeMockUser(nextUser);
    updateLocalAccountUser(nextUser);
    setUser(nextUser);
    setDraftFromUser(nextUser);
    setEditing(false);
    setProfileStatus("Profile updated across Rocketry House.");

    try {
      await saveAuthUserProfileToCloud(nextUser);
      await savePersistentRecord("profiles", nextUser.id, nextUser);
    } catch {
      setProfileStatus("Profile updated locally. Cloud sync could not complete.");
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
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <UserRoundCheck className="h-7 w-7 text-orange-300" />
                <p className="text-sm uppercase tracking-[0.18em] text-orange-100/55">{planUser.accountType} {planUser.subscriptionTier ?? "standard"} account</p>
                <Button variant="outline" onClick={() => { setDraftFromUser(user); setEditing(true); setProfileStatus(""); }} className="ml-auto">
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </Button>
              </div>
              <h1 className="mt-2 text-4xl font-semibold">{user.name}</h1>
              <p className="mt-3 max-w-2xl text-orange-50/68">{user.headline || "Aerospace engineering dossier for launches, simulations, motors, rankings, badges, telemetry, and published project repositories."}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-orange-50/55">
                <span>{user.email}</span>
                {user.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{user.location}</span> : null}
                {user.website ? <a className="inline-flex items-center gap-1 text-cyan-100 hover:text-cyan-50" href={user.website.startsWith("http") ? user.website : `https://${user.website}`} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" />{user.website}</a> : null}
              </div>
              {user.bio ? <p className="mt-4 max-w-3xl text-sm leading-6 text-orange-50/62">{user.bio}</p> : null}
              <p className="mt-3 text-sm text-orange-50/52">Profile photo appears across account navigation, community posts, and comments.</p>
              {photoStatus ? <p className="mt-2 text-sm text-emerald-100/80">{photoStatus}</p> : null}
              {profileStatus ? <p className="mt-2 text-sm text-emerald-100/80">{profileStatus}</p> : null}
            </div>
          </div>
          {editing ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Edit profile</h2>
                  <p className="mt-1 text-sm text-orange-50/55">These details appear on Profile, Account navigation, and community author cards.</p>
                </div>
                <button onClick={() => { setEditing(false); setDraftFromUser(user); }} className="rounded-full p-2 text-orange-50/55 hover:bg-white/10 hover:text-orange-50" aria-label="Cancel editing">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ProfileField label="Display name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                <ProfileField label="Headline / role" value={draft.headline} onChange={(value) => setDraft({ ...draft, headline: value })} placeholder="Flight systems lead, propulsion analyst..." />
                <label className="block text-sm text-orange-50/65">
                  Account type
                  <select value={draft.accountType} onChange={(event) => setDraft({ ...draft, accountType: event.target.value as AuthUser["accountType"] })} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-3 text-orange-50 outline-none">
                    <option value="personal">Personal</option>
                    <option value="team">Team</option>
                    <option value="organization">Organization</option>
                  </select>
                </label>
                <ProfileField label={draft.accountType === "organization" ? "Organization name" : "Team / organization"} value={draft.organizationName} onChange={(value) => setDraft({ ...draft, organizationName: value })} disabled={draft.accountType === "personal"} placeholder="Optional for team or organization accounts" />
                <ProfileField label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} placeholder="City, campus, launch region" />
                <ProfileField label="Website" value={draft.website} onChange={(value) => setDraft({ ...draft, website: value })} placeholder="https://..." />
                <label className="block text-sm text-orange-50/65 md:col-span-2">
                  Bio
                  <textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className="mt-1 min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-3 text-orange-50 outline-none placeholder:text-orange-50/30" placeholder="Short engineering profile, project interests, or team mission." />
                </label>
                <ProfileField label="Specialties" value={draft.specialties} onChange={(value) => setDraft({ ...draft, specialties: value })} className="md:col-span-2" placeholder="Propulsion, CAD, telemetry, recovery, avionics..." />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => { setEditing(false); setDraftFromUser(user); }}>Cancel</Button>
                <Button onClick={saveProfileEdits}>
                  <Save className="h-4 w-4" />
                  Save profile
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-4">{stats.map((item) => <div key={item} className="rounded-lg bg-white/[0.05] p-3 text-sm">{item}</div>)}</div>
        </Card>
        <Card className="mt-8 p-5">
          <h2 className="font-semibold">Plan usage</h2>
          <p className="mt-2 text-sm text-orange-50/58">Standard limits are checked against cloud usage before limited actions run.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {planUsageFields.map((item) => (
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
        </Card>
        <AccountFeatureConsole
          user={planUser}
          statuses={statuses}
          usageLoading={usageLoading}
          usageError={usageError}
          claimUsage={claimUsage}
          refreshUsage={refreshUsage}
        />
        <RoleWorkspace user={planUser} />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <Card className="p-5">
            <Award className="h-6 w-6 text-orange-200" />
            <h2 className="mt-4 font-semibold">Engineer level</h2>
            <p className="mt-2 text-2xl font-semibold">Level {Math.max(1, Math.floor(aerospaceScore / 500) + 1)}</p>
            <p className="mt-1 text-sm text-orange-50/55">Aerospace score {aerospaceScore}. Publish verified work to climb rankings.</p>
          </Card>
          <Card className="p-5">
            <RadioTower className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Telemetry achievements</h2>
            <p className="mt-2 text-sm text-orange-50/58">No telemetry has been attached yet. Upload flight data from a project or launch log.</p>
          </Card>
          <Card className="p-5">
            <BadgeCheck className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 font-semibold">Specialties</h2>
            <p className="mt-2 text-sm text-orange-50/58">{user.specialties || "Specialties appear after your saved motors, rocket projects, and verified evidence accumulate."}</p>
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
            <p className="mt-2 text-sm text-orange-50/62">Rocket projects stay project-first: CAD, simulation, files, forks, discussions, and access settings remain attached to the rocket repository.</p>
            <div className="mt-4 grid gap-2 text-sm text-orange-50/68">
              <p>Draft rocket CAD: {draftProjects.length}</p>
              <p>Published rocket repositories: {publishedProjects.length}</p>
              <p>Motors imported into rocket designs: {importedMotorProjects.length}</p>
            </div>
            {rocketProjects.length ? (
              <div className="mt-4 space-y-3">
                {rocketProjects.slice(0, 4).map((project, index) => (
                  <div key={project.id ?? project.slug ?? index} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{project.name || "Untitled rocket project"}</span>
                      <span className="text-orange-100">{project.status ?? "draft"}</span>
                    </div>
                    <p className="mt-1 text-orange-50/55">{project.source ?? "builder"} / updated {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "recently"}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <Button href="/build/rocket" asChild variant="outline" className="mt-4 w-full">Open rocket builder</Button>
          </Card>
        </div>
        {publishedProjects.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {publishedProjects.slice(0, 3).map((project, index) => (
              <Card key={project.id ?? project.slug ?? index} className="p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-orange-100/50">Published project</p>
                <h2 className="mt-3 text-xl font-semibold">{project.name || "Untitled rocket project"}</h2>
                <p className="mt-2 text-sm text-orange-50/58">
                  {project.summary?.predictedAltitudeM ? `${project.summary.predictedAltitudeM} m predicted apogee` : "No flight summary attached yet."}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-8 p-6">
            <h2 className="font-semibold">No public projects yet</h2>
            <p className="mt-2 text-sm text-orange-50/58">Your published rockets, motors, launch logs, and public references will appear here after upload.</p>
            <Button href="/upload" asChild variant="outline" className="mt-4">Prepare first upload</Button>
          </Card>
        )}
      </div>
    </main>
  );
}

function RoleWorkspace({ user }: { user: AuthUser }) {
  if (user.accountType === "organization") {
    return (
      <Card className="mt-8 p-5">
        <h2 className="font-semibold">Organization command center</h2>
        <p className="mt-2 text-sm text-orange-50/62">Approve team membership requests, monitor organization score, and manage team-level project portfolios.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Approved teams" value="0" />
          <Metric label="Organization score" value="0" />
          <Metric label="Ranking" value="Unranked" />
        </div>
        <EmptyState title="No teams approved yet" body="Team approval requests will appear here after teams request membership in this organization." />
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
          <Metric label="Team ranking" value="Unranked" />
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

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-orange-50/65 ${className}`}>
      {label}
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-3 text-orange-50 outline-none placeholder:text-orange-50/30 disabled:cursor-not-allowed disabled:opacity-45"
      />
    </label>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm">
      <p className="font-semibold text-orange-50">{title}</p>
      <p className="mt-1 text-orange-50/55">{body}</p>
    </div>
  );
}
