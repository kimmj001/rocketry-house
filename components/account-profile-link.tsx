"use client";

import { useState, type ReactNode } from "react";
import { MessageCircle, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openDmDock, type DmTargetProfile } from "@/components/dm-dock";
import { cn } from "@/lib/utils";

type AccountProfileLinkProps = {
  profile: DmTargetProfile & {
    role?: string;
    team?: string;
    badge?: string;
    profileType?: string;
    rating?: number;
    projectCount?: number;
  };
  children?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function AccountProfileLink({ profile, children, className, compact }: AccountProfileLinkProps) {
  const [open, setOpen] = useState(false);
  const displayType = profile.profileType ?? profile.accountType ?? "Account";
  const role = profile.headline ?? profile.role;
  const team = profile.organizationName ?? profile.team;

  function sendDm() {
    setOpen(false);
    openDmDock(profile);
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          compact
            ? "inline-flex min-w-0 items-center gap-2 rounded-md text-left transition hover:text-orange-600"
            : "flex min-w-0 items-center gap-3 rounded-md text-left transition hover:bg-slate-50",
          className
        )}
        aria-label={`Open ${profile.name} profile`}
      >
        {children ?? (
          <>
            <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{profile.name}</span>
              {team ? <span className="block truncate text-xs opacity-70">{team}</span> : null}
            </span>
          </>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${profile.name} profile`}>
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} large />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">{profile.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">{team || "Rocketry House account"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close profile">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{displayType}</span>
                {profile.badge ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{profile.badge}</span> : null}
                {profile.rating ? <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{profile.rating} rating</span> : null}
              </div>

              {role ? <p className="text-sm leading-6 text-slate-600">{role}</p> : null}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <ProfileMetric label="Profile" value={String(displayType)} />
                <ProfileMetric label="Projects" value={profile.projectCount ? String(profile.projectCount) : "Public"} />
              </div>

              <Button onClick={sendDm} className="w-full bg-slate-950 text-white hover:bg-orange-500">
                <MessageCircle className="h-4 w-4" />
                Send DM
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProfileAvatar({ name, avatarUrl, large }: { name: string; avatarUrl?: string; large?: boolean }) {
  const size = large ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  if (avatarUrl) return <img src={avatarUrl} alt="" className={cn(size, "shrink-0 rounded-full object-cover ring-1 ring-slate-200")} />;
  return (
    <span className={cn(size, "grid shrink-0 place-items-center rounded-full bg-slate-950 font-bold uppercase text-white ring-1 ring-slate-200")}>
      {initials(name) || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RH";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
