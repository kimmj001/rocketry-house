import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, Box, FileText, GitFork, Gauge, Ruler, ShieldCheck, Star } from "lucide-react";
import { VerificationBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

export function ProjectCard({ project }: { project: RocketProject }) {
  const evidenceEntries = Object.entries(project.evidence ?? {});
  const uploadedFileCount = project.uploadedFiles?.length ?? project.files.length;
  const peakThrust = maxMetric(project, "thrust");
  const maxVelocity = maxMetric(project, "velocity");
  const detailScore = detailCompleteness(project);
  const visibleEvidence = evidenceEntries.slice(0, 3);

  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-slate-200 bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/[0.03] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg">
        <div className="relative m-3 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
          <Image src={project.image} alt={project.title} fill className="object-contain p-3 transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-5 px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold leading-tight">{project.title}</h3>
              <p className="mt-1 text-sm text-slate-500">by {project.creator}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{detailScore}% detailed</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={project.verificationStatus} />
            {project.publicReference && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"><BookOpen className="h-3 w-3" />source</span>}
            {project.moderation?.restrictedContentHandling && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">disclosure scoped</span>}
          </div>

          <p className="text-sm leading-6 text-slate-600">{project.description}</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric icon={Gauge} label="Apogee" value={project.actualAltitudeM ? `${formatNumber(project.actualAltitudeM)} m flown` : `${formatNumber(project.predictedAltitudeM)} m est.`} />
            <Metric icon={Activity} label="Peak thrust" value={peakThrust ? `${formatNumber(peakThrust)} N` : project.hasThrustData ? "attached" : "not attached"} />
            <Metric icon={Ruler} label="Envelope" value={`${formatNumber(project.specs.lengthMm)} x ${formatNumber(project.specs.diameterMm)} mm`} />
            <Metric icon={Box} label="Mass / stability" value={`${formatMass(project.specs.massG)} / ${project.specs.stabilityCalibers} cal`} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Inspectable data</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{uploadedFileCount} files</span>
              <span>{evidenceEntries.length} evidence notes</span>
              <span>{project.components.length} CAD parts</span>
              <span>{project.telemetry.points.length} data points</span>
              {maxVelocity ? <span>{formatNumber(maxVelocity)} m/s max velocity</span> : null}
              <span>{project.motorClass}</span>
            </div>
          </div>

          {visibleEvidence.length ? (
            <div className="space-y-2">
              {visibleEvidence.map(([label, value]) => (
                <div key={label} className="text-xs leading-5 text-slate-600">
                  <span className="font-semibold text-slate-900">{label}: </span>
                  {valueToSnippet(value)}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{project.forkCount}</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{project.verifiedFlight ? "verified" : "reference"}</span>
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{project.creatorRating}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="min-h-16 rounded-lg border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 text-sm font-semibold leading-tight text-slate-900">{value}</p>
    </div>
  );
}

function maxMetric(project: RocketProject, key: "thrust" | "velocity") {
  const values = project.telemetry.points
    .map((point) => point[key])
    .filter((value): value is number => typeof value === "number");
  return values.length ? Math.max(...values) : undefined;
}

function detailCompleteness(project: RocketProject) {
  const checks = [
    project.hasWebCad,
    project.hasThrustData,
    project.hasTelemetry || project.hasFlightLog,
    Boolean(project.publicReference),
    Boolean(Object.keys(project.evidence ?? {}).length),
    Boolean(project.files.length),
    Boolean(project.components.length),
    Boolean(project.telemetry.points.length)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatMass(value: number) {
  return value >= 1000 ? `${formatNumber(value / 1000)} kg` : `${formatNumber(value)} g`;
}

function valueToSnippet(value: unknown) {
  const text = Array.isArray(value)
    ? value.map(String).join(", ")
    : typeof value === "object" && value
      ? JSON.stringify(value)
      : String(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
