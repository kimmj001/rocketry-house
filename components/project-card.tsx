import Image from "next/image";
import Link from "next/link";
import { AccountProfileLink } from "@/components/account-profile-link";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

const impulseClasses = [
  { label: "1/4A", maxNs: 0.625 },
  { label: "1/2A", maxNs: 1.25 },
  { label: "A", maxNs: 2.5 },
  { label: "B", maxNs: 5 },
  { label: "C", maxNs: 10 },
  { label: "D", maxNs: 20 },
  { label: "E", maxNs: 40 },
  { label: "F", maxNs: 80 },
  { label: "G", maxNs: 160 },
  { label: "H", maxNs: 320 },
  { label: "I", maxNs: 640 },
  { label: "J", maxNs: 1280 },
  { label: "K", maxNs: 2560 },
  { label: "L", maxNs: 5120 },
  { label: "M", maxNs: 10240 },
  { label: "N", maxNs: 20480 },
  { label: "O", maxNs: 40960 },
  { label: "P", maxNs: 81920 },
  { label: "Q", maxNs: 163840 },
  { label: "R", maxNs: 327680 },
  { label: "S", maxNs: 655360 },
  { label: "T", maxNs: 1310720 }
];

export function ProjectCard({ project }: { project: RocketProject }) {
  return (
    <Card className="h-full overflow-hidden border-slate-200 bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/[0.03] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg">
      <Link href={`/projects/${project.slug}`} className="group block">
        <div className="relative m-3 aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
          <Image src={project.image} alt={project.title} fill className="object-contain p-3 transition duration-500 group-hover:scale-105" />
        </div>
      </Link>
      <div className="px-5 pb-5 pt-2">
        <Link href={`/projects/${project.slug}`} className="group/title block">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug group-hover/title:text-orange-600">{project.title}</h3>
        </Link>
        <AccountProfileLink
          profile={{
            name: project.creator,
            avatarUrl: project.creatorAvatarUrl,
            accountType: "team",
            role: `${project.motorClass} publisher`,
            team: project.creator,
            badge: project.verifiedFlight ? "Flight verified" : project.verificationStatus,
            rating: project.creatorRating,
            projectCount: project.forkCount + 1
          }}
          className="mt-3 w-full p-0"
        >
          <AccountAvatar name={project.creator} avatarUrl={project.creatorAvatarUrl} />
          <p className="min-w-0 truncate text-sm font-medium text-slate-600">{project.creator}</p>
        </AccountProfileLink>
        <div className="mt-5 grid gap-2">
          <Metric label="Apogee" value={apogeeLabel(project)} />
          <Metric label="Motor class" value={motorClassLabel(project)} />
          <Metric label="Mass" value={formatMass(project.specs.massG)} />
        </div>
      </div>
    </Card>
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

function motorClassLabel(project: RocketProject) {
  const impulseClass = project.summary?.totalImpulseNs ? classFromImpulse(project.summary.totalImpulseNs) : undefined;
  const parsedClass = classFromText(project.motorClass);
  const label = impulseClass ?? parsedClass;
  return label ? `${label} class` : "Class not stated";
}

function classFromImpulse(totalImpulseNs: number) {
  const match = impulseClasses.find((item) => totalImpulseNs <= item.maxNs);
  return match?.label ?? `>${impulseClasses[impulseClasses.length - 1].label}`;
}

function classFromText(value: string) {
  const text = value.toUpperCase();
  const range = text.match(/\b([A-T])\s*\/\s*([A-T])\b/);
  if (range) return `${range[1]}/${range[2]}`;

  const explicit = text.match(/\b(1\/4A|1\/2A|[A-T])\s*CLASS\b/);
  if (explicit) return explicit[1];

  const motorCode = text.match(/(?:^|[^A-Z0-9])([A-T])\s*[-]?\s*\d{1,5}\b/);
  if (motorCode) return motorCode[1];

  return undefined;
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
