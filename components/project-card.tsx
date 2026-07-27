import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

export function ProjectCard({ project }: { project: RocketProject }) {
  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-slate-200 bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/[0.03] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg">
        <div className="relative m-3 aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
          <Image src={project.image} alt={project.title} fill className="object-contain p-3 transition duration-500 group-hover:scale-105" />
        </div>
        <div className="px-5 pb-5 pt-2">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug">{project.title}</h3>
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <AccountAvatar name={project.creator} avatarUrl={project.creatorAvatarUrl} />
            <p className="min-w-0 truncate text-sm font-medium text-slate-600">{project.creator}</p>
          </div>
          <div className="mt-5 grid gap-2">
            <Metric label="Apogee" value={apogeeLabel(project)} />
            <Metric label="Motor class" value={project.motorClass} />
            <Metric label="Mass" value={formatMass(project.specs.massG)} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function AccountAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-semibold uppercase text-white ring-1 ring-slate-200">
      {initials(name)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-h-11 grid-cols-[88px_1fr] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="min-w-0 truncate text-sm font-semibold text-slate-900" title={value}>{value}</p>
    </div>
  );
}

function apogeeLabel(project: RocketProject) {
  const value = project.actualAltitudeM ?? project.predictedAltitudeM;
  const suffix = project.actualAltitudeM ? "flown" : "est.";
  return `${formatNumber(value)} m ${suffix}`;
}

function formatMass(value: number) {
  return value >= 1000 ? `${formatNumber(value / 1000)} kg` : `${formatNumber(value)} g`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RH";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
