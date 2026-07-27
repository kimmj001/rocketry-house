import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Box,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  GitFork,
  Layers,
  ListChecks,
  MessageSquare,
  Ruler,
  ShieldCheck,
  Upload
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProjectTabs } from "@/components/project-tabs";
import { VerificationBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MultiTelemetryChart, TelemetryChart } from "@/components/charts";
import { RawDataPreview } from "@/components/raw-data-preview";
import { archivedProjectToRocketProject } from "@/lib/project-archive";
import { discussions, mockProjects } from "@/lib/mock-data";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import type { RocketComponent, RocketProject, UploadedFileSummary } from "@/lib/types";
import { bySlug, canonicalSlug, cn } from "@/lib/utils";

const projectMetadataKeys = ["category", "publishGoal", "visibility", "difficulty", "motorClass", "referenceUrl"];
const flightMetadataKeys = [
  "propellantFamily",
  "motorEvidenceSource",
  "disclosureLevel",
  "motorDesignation",
  "motorClass",
  "caseDiameter",
  "totalImpulse",
  "avgPeakThrust",
  "burnTime",
  "predictedApogee",
  "measuredApogee",
  "maxVelocity"
];
const releaseMetadataKeys = ["releaseType", "usageRights", "forkPolicy", "dataAccess", "articleRequest", "citation", "reviewState"];

const labelOverrides: Record<string, string> = {
  avgPeakThrust: "Avg / peak thrust",
  burnTime: "Burn time",
  caseDiameter: "Case diameter",
  dataAccess: "Data access",
  disclosureLevel: "Disclosure level",
  measuredApogee: "Measured apogee",
  maxVelocity: "Max velocity",
  motorClass: "Motor class",
  motorDesignation: "Motor designation",
  motorEvidenceSource: "Motor evidence source",
  predictedApogee: "Predicted apogee",
  propellantFamily: "Propellant family",
  publishGoal: "Publish goal",
  referenceUrl: "Reference URL",
  releaseType: "Release type",
  reviewState: "Review state",
  totalImpulse: "Total impulse",
  usageRights: "Usage rights"
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/projects/${canonicalSlug(slug)}`);
  const project = bySlug(mockProjects, slug) ?? await loadArchivedProject(slug);
  if (!project) notFound();

  const originalProject = project.originalProjectId ? mockProjects.find((candidate) => candidate.id === project.originalProjectId) : undefined;
  const projectDiscussions = discussions.filter((discussion) => discussion.projectId === project.id);
  const evidenceEntries = Object.entries(project.evidence ?? {});
  const uploadedFiles = normalizedUploadedFiles(project);
  const peakThrust = maxMetric(project, "thrust") ?? project.summary?.maxThrustN;
  const maxVelocity = maxMetric(project, "velocity") ?? project.summary?.maxVelocityMps;
  const projectUploadRecord = project.uploadProject ?? fallbackProjectRecord(project);
  const flightRecord = project.flight ?? fallbackFlightRecord(project, peakThrust, maxVelocity);
  const releaseRecord = project.release ?? fallbackReleaseRecord(project);
  const metadataGroups = [
    { title: "Project upload", entries: safeRecordEntries(projectUploadRecord, projectMetadataKeys) },
    { title: "Flight metadata", entries: safeRecordEntries(flightRecord, flightMetadataKeys) },
    { title: "Release settings", entries: safeRecordEntries(releaseRecord, releaseMetadataKeys) }
  ].filter((group) => group.entries.length > 0);
  const narrativeCards = buildNarrativeCards(project, uploadedFiles, evidenceEntries.length);
  const coverage = buildCoverage(project, uploadedFiles);

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-4 py-24 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <ProjectTabs slug={project.slug} active="overview" tone="light" />

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={project.verificationStatus} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{project.difficulty}</span>
              {project.visibility ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">{project.visibility}</span> : null}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">{project.title}</h1>
            <p className="mt-4 max-w-4xl text-base font-medium leading-7 text-slate-600">{project.description}</p>
            {project.narrative?.highlights ? <p className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold leading-6 text-orange-950">{project.narrative.highlights}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {project.publicReference ? (
                <a href={project.publicReference.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <BookOpen className="h-4 w-4" />
                  Public source
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {originalProject ? <span className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">Based on {originalProject.title}</span> : null}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Predicted apogee" value={formatMeters(project.predictedAltitudeM)} />
              <MetricTile label="Measured apogee" value={project.actualAltitudeM ? formatMeters(project.actualAltitudeM) : "Not claimed"} />
              <MetricTile label="Motor class" value={project.summary?.motorClass ?? project.motorClass} />
              <MetricTile label="Dry mass" value={formatMass(project.specs.massG)} />
            </div>
          </Card>

          <aside className="space-y-4">
            <Card className="overflow-hidden border-slate-200 bg-white p-0 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <div className="relative aspect-[16/11] bg-slate-100">
                <Image src={project.image} alt={project.title} fill className="object-contain p-4" />
              </div>
            </Card>
            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Database} title="Data Coverage" detail={`${uploadedFiles.length} files, ${project.components.length} CAD parts, ${project.telemetry.points.length} telemetry rows`} />
              <div className="mt-4 space-y-2">
                {coverage.map((item) => <CoverageRow key={item.label} label={item.label} value={item.value} complete={item.complete} />)}
              </div>
            </Card>
          </aside>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={ListChecks} title="Reader Notes" detail="What to inspect first, what can be reused, and where the record is limited." />
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {narrativeCards.map((card) => <NarrativeCard key={card.title} title={card.title} body={card.body} tone={card.tone} />)}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Gauge} title="Performance" detail="Simulation, reported flight outcome, and non-hazardous motor performance metadata." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Predicted apogee" value={formatMeters(project.predictedAltitudeM)} />
                <MetricTile label="Measured apogee" value={project.actualAltitudeM ? formatMeters(project.actualAltitudeM) : "Not claimed"} />
                <MetricTile label="Peak thrust" value={peakThrust ? `${formatNumber(peakThrust)} N` : project.hasThrustData ? "Attached" : "Not attached"} />
                <MetricTile label="Max velocity" value={maxVelocity ? `${formatNumber(maxVelocity)} m/s` : "Not attached"} />
                <MetricTile label="Total impulse" value={project.summary?.totalImpulseNs ? `${formatNumber(project.summary.totalImpulseNs)} Ns` : "Not attached"} />
                <MetricTile label="Burn time" value={project.summary?.burnTimeS ? `${formatNumber(project.summary.burnTimeS)} s` : "Not attached"} />
                <MetricTile label="CG / CP" value={project.summary?.cgMm && project.summary?.cpMm ? `${formatNumber(project.summary.cgMm)} / ${formatNumber(project.summary.cpMm)} mm` : "Not attached"} />
                <MetricTile label="Stability" value={`${project.specs.stabilityCalibers} calibers`} />
              </div>
            </Card>

            {metadataGroups.length ? (
              <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
                <SectionHeading icon={FileText} title="Upload Metadata" detail="Structured fields captured during publishing and filtered for public readability." />
                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  {metadataGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-sm font-black text-slate-900">{group.title}</h3>
                      <dl className="mt-3 space-y-3">
                        {group.entries.map((entry) => <KeyValue key={`${group.title}-${entry.label}`} label={entry.label} value={entry.value} />)}
                      </dl>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Archive} title="Evidence" detail="Uploaded proof groups, source references, notes, and traceability attachments." />
              <div className="mt-5 grid gap-3">
                {evidenceEntries.length ? evidenceEntries.map(([label, value]) => <EvidenceRow key={label} label={label} value={value} />) : <EmptyState>No evidence notes attached.</EmptyState>}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Box} title="CAD And Components" detail="Inspectable public component envelope for search, comparison, and forks." />
              {project.scaffoldNotice ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">{project.scaffoldNotice}</p> : null}
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Part</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Length</th>
                      <th className="px-3 py-3">Diameter</th>
                      <th className="px-3 py-3">Mass</th>
                      <th className="px-3 py-3">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.components.length ? project.components.map((component) => <ComponentRow key={component.id} component={component} />) : (
                      <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>No public component model attached.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Layers} title="Telemetry Preview" detail="Time-series data rendered from attached telemetry or project simulation metadata." />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <MultiTelemetryChart data={project.telemetry.points} tone="light" />
                <TelemetryChart data={project.telemetry.points} type="thrust" tone="light" />
              </div>
              <div className="mt-4">
                <RawDataPreview data={project.telemetry.points} tone="light" />
              </div>
            </Card>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Upload} title="Files" detail={`${uploadedFiles.length} public file records`} />
              <div className="mt-4 space-y-2">
                {uploadedFiles.length ? uploadedFiles.map((file) => <FileRow key={`${file.name}-${file.storagePath ?? file.signedUrl ?? ""}`} file={file} />) : <EmptyState>No uploaded files attached.</EmptyState>}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={ShieldCheck} title="Disclosure" detail="Public safety and restricted-content handling." />
              <div className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>{project.moderation?.restrictedContentHandling ?? project.narrative?.safetyScope ?? "No additional moderation scope declared."}</p>
                {project.moderation?.rawSourcePublished === false ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900">Raw source is not published in this public archive.</p> : null}
                {project.moderation?.omittedDetails?.length ? (
                  <div>
                    <p className="font-black text-slate-900">Omitted from public view</p>
                    <ul className="mt-2 space-y-1">
                      {project.moderation.omittedDetails.map((detail) => <li key={detail} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{detail}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={Ruler} title="Archive" detail="Publication and reuse settings." />
              <dl className="mt-4 space-y-3">
                <KeyValue label="Usage rights" value={project.accessPolicy?.usageRights ?? "Open reference"} />
                <KeyValue label="Fork policy" value={project.accessPolicy?.forkPolicy ?? "Allowed where source permits"} />
                <KeyValue label="Published" value={formatDate(project.publishedAt ?? project.uploadedAt)} />
                <KeyValue label="Forks" value={String(project.forkCount)} />
                <KeyValue label="Downloads" value={String(project.downloadCount)} />
              </dl>
              <div className="mt-5 grid gap-2">
                <Button asChild href={`/forks/${project.slug}`} className="bg-orange-500 text-slate-950 hover:bg-orange-400">
                  <GitFork className="h-4 w-4" />
                  Fork tree
                </Button>
                <Button asChild href="/upload" variant="outline" className="border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  Publish project
                </Button>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm shadow-black/0 backdrop-blur-0">
              <SectionHeading icon={MessageSquare} title="Discussions" detail={`${projectDiscussions.length} linked threads`} />
              <div className="mt-4 space-y-3">
                {projectDiscussions.length ? projectDiscussions.map((discussion) => (
                  <div key={discussion.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-black text-orange-700">{discussion.type}</p>
                    <p className="mt-1 font-semibold text-slate-700">{discussion.title}</p>
                  </div>
                )) : <EmptyState>No discussions yet.</EmptyState>}
              </div>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-950 text-orange-300">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-0.5 text-sm font-medium leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-base font-black text-slate-950">{value}</p>
    </div>
  );
}

function NarrativeCard({ title, body, tone }: { title: string; body: string; tone: "neutral" | "success" | "warning" }) {
  return (
    <div className={cn("rounded-md border p-4", tone === "success" && "border-emerald-200 bg-emerald-50", tone === "warning" && "border-amber-200 bg-amber-50", tone === "neutral" && "border-slate-200 bg-slate-50")}>
      <h3 className={cn("text-sm font-black", tone === "success" ? "text-emerald-950" : tone === "warning" ? "text-amber-950" : "text-slate-950")}>{title}</h3>
      <p className={cn("mt-2 whitespace-pre-wrap text-sm font-medium leading-6", tone === "success" ? "text-emerald-900" : tone === "warning" ? "text-amber-900" : "text-slate-600")}>{body}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-6 text-slate-700">{value}</dd>
    </div>
  );
}

function CoverageRow({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p className="mt-0.5 break-words text-xs font-semibold text-slate-500">{value}</p>
      </div>
      <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", complete ? "text-emerald-600" : "text-slate-300")} />
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: unknown }) {
  const evidence = summarizeEvidence(label, value);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black text-slate-950">{evidence.title}</p>
        {evidence.count ? <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{evidence.count}</span> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-600">{evidence.body}</p>
    </div>
  );
}

function FileRow({ file }: { file: UploadedFileSummary }) {
  const href = file.signedUrl ?? file.publicUrl;
  const details = [file.title, file.contentType ?? file.type, file.sizeBytes ?? file.size ? formatBytes((file.sizeBytes ?? file.size) as number) : undefined].filter(Boolean).join(" / ");
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all font-black text-slate-950 hover:text-orange-700">
          {file.name}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <p className="break-all font-black text-slate-950">{file.name}</p>
      )}
      <p className="mt-1 break-words text-xs font-semibold text-slate-500">{details || "metadata file"}</p>
    </div>
  );
}

function ComponentRow({ component }: { component: RocketComponent }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-3 font-bold text-slate-900">{component.name}</td>
      <td className="px-3 py-3 text-slate-600">{formatLabel(component.type)}</td>
      <td className="px-3 py-3 text-slate-600">{formatNumber(component.length)} mm</td>
      <td className="px-3 py-3 text-slate-600">{formatNumber(component.diameter)} mm</td>
      <td className="px-3 py-3 text-slate-600">{formatMass(component.mass)}</td>
      <td className="px-3 py-3 text-slate-600">{component.material}</td>
    </tr>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500">{children}</p>;
}

function normalizedUploadedFiles(project: RocketProject): UploadedFileSummary[] {
  if (project.uploadedFiles?.length) return project.uploadedFiles;
  return project.files.map((name) => ({ name }));
}

function maxMetric(project: RocketProject, key: "thrust" | "velocity") {
  const values = project.telemetry.points
    .map((point) => point[key])
    .filter((value): value is number => typeof value === "number");
  return values.length ? Math.max(...values) : undefined;
}

function buildNarrativeCards(project: RocketProject, files: UploadedFileSummary[], evidenceCount: number) {
  const fallbackReuse = [
    project.components.length ? `${project.components.length} public CAD components` : undefined,
    project.telemetry.points.length ? `${project.telemetry.points.length} telemetry or simulation rows` : undefined,
    files.length ? `${files.length} uploaded file records` : undefined,
    evidenceCount ? `${evidenceCount} evidence groups` : undefined
  ].filter(Boolean).join(", ");
  const omitted = project.moderation?.omittedDetails?.length ? `Public view omits: ${project.moderation.omittedDetails.join(", ")}.` : undefined;

  return [
    {
      title: "Why It Matters",
      body: project.narrative?.highlights ?? project.description,
      tone: "neutral" as const
    },
    {
      title: "Reusable Data",
      body: project.narrative?.reuseNotes ?? (fallbackReuse || "No reusable project data has been declared yet."),
      tone: "success" as const
    },
    {
      title: "Known Limits",
      body: project.narrative?.limitations ?? omitted ?? project.scaffoldNotice ?? "No limitations have been declared for the public project package.",
      tone: "warning" as const
    }
  ];
}

function buildCoverage(project: RocketProject, files: UploadedFileSummary[]) {
  return [
    { label: "Web CAD", value: project.components.length ? `${project.components.length} components` : "No public model", complete: project.hasWebCad },
    { label: "Telemetry", value: project.hasTelemetry ? `${project.telemetry.points.length} rows` : project.telemetry.points.length ? "Simulation preview" : "Not attached", complete: project.hasTelemetry },
    { label: "Thrust data", value: project.hasThrustData ? "Performance source attached" : "Not attached", complete: project.hasThrustData },
    { label: "Flight log", value: project.hasFlightLog ? "Flight evidence present" : "No flight log", complete: project.hasFlightLog },
    { label: "Files", value: files.length ? `${files.length} records` : "No file records", complete: files.length > 0 },
    { label: "Public source", value: project.publicReference ? project.publicReference.name : "No external source", complete: Boolean(project.publicReference) }
  ];
}

function fallbackProjectRecord(project: RocketProject): Record<string, unknown> {
  return {
    category: project.tags[0],
    publishGoal: project.tags.find((tag) => /share|archive|article/i.test(tag)),
    visibility: project.visibility,
    difficulty: project.difficulty,
    motorClass: project.summary?.motorClass ?? project.motorClass,
    referenceUrl: project.publicReference?.url
  };
}

function fallbackFlightRecord(project: RocketProject, peakThrust: number | undefined, maxVelocity: number | undefined): Record<string, unknown> {
  return {
    propellantFamily: project.summary?.propellantFamily,
    motorEvidenceSource: project.hasThrustData ? "Attached performance metadata" : undefined,
    disclosureLevel: project.narrative?.safetyScope,
    motorClass: project.summary?.motorClass ?? project.motorClass,
    totalImpulse: project.summary?.totalImpulseNs ? `${formatNumber(project.summary.totalImpulseNs)} Ns` : undefined,
    avgPeakThrust: peakThrust ? `${formatNumber(peakThrust)} N peak` : undefined,
    burnTime: project.summary?.burnTimeS ? `${formatNumber(project.summary.burnTimeS)} s` : undefined,
    predictedApogee: formatMeters(project.predictedAltitudeM),
    measuredApogee: project.actualAltitudeM ? formatMeters(project.actualAltitudeM) : undefined,
    maxVelocity: maxVelocity ? `${formatNumber(maxVelocity)} m/s` : undefined
  };
}

function fallbackReleaseRecord(project: RocketProject): Record<string, unknown> {
  return {
    releaseType: project.visibility,
    usageRights: project.accessPolicy?.usageRights,
    forkPolicy: project.accessPolicy?.forkPolicy,
    dataAccess: project.uploadedFiles?.length ? "Files visible" : undefined,
    reviewState: project.verificationStatus
  };
}

function safeRecordEntries(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return [] as Array<{ label: string; value: string }>;
  return keys.flatMap((key) => {
    const value = record[key];
    if (value === undefined || value === null || value === "") return [];
    return [{ label: labelOverrides[key] ?? formatLabel(key), value: formatRecordValue(value) }];
  });
}

function summarizeEvidence(label: string, value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : formatLabel(label);
    const names = Array.isArray(record.names) ? record.names.filter((item): item is string => typeof item === "string") : [];
    const records = Array.isArray(record.records) ? record.records : [];
    const body = names.length ? names.join("\n") : records.length ? `${records.length} uploaded records attached.` : trimText(formatRecordValue(record));
    return { title, body, count: names.length ? `${names.length} files` : records.length ? `${records.length} records` : undefined };
  }
  return { title: formatLabel(label), body: trimText(formatRecordValue(value)), count: undefined };
}

function formatRecordValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatRecordValue(item)).join("\n");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const entries: string[] = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
      .slice(0, 8)
      .map(([entryKey, entryValue]) => `${formatLabel(entryKey)}: ${formatRecordValue(entryValue)}`);
    return entries.join("\n") || "Attached";
  }
  return String(value);
}

function trimText(value: string, maxLength = 420) {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMeters(value: number) {
  return `${formatNumber(value)} m`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatMass(value: number) {
  return value >= 1000 ? `${formatNumber(value / 1000)} kg` : `${formatNumber(value)} g`;
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${formatNumber(value / 1024 / 1024)} MB`;
  if (value >= 1024) return `${formatNumber(value / 1024)} KB`;
  return `${formatNumber(value)} B`;
}

function formatDate(value: string | undefined) {
  if (!value) return "Not attached";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(timestamp);
}

async function loadArchivedProject(slug: string): Promise<RocketProject | undefined> {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return undefined;

  const { data, error } = await supabase
    .from("user_data_records")
    .select("collection, record_key, payload, updated_at")
    .eq("owner_key", "public:projects")
    .eq("collection", "projects")
    .eq("record_key", slug)
    .maybeSingle();

  if (error || !data) return undefined;
  return archivedProjectToRocketProject(data);
}
