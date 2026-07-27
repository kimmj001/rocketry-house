import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Box, ExternalLink, FileText, Gauge, GitFork, MessageSquare, Ruler, ShieldCheck, Upload } from "lucide-react";
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
import { bySlug, canonicalSlug } from "@/lib/utils";

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
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <ProjectTabs slug={project.slug} active="overview" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <VerificationBadge status={project.verificationStatus} />
            <h1 className="mt-4 text-4xl font-semibold">{project.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-orange-50/70">{project.description}</p>
            {project.publicReference && (
              <a href={project.publicReference.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-orange-300/10 px-3 py-2 text-sm text-orange-100 hover:bg-orange-300/15">
                <BookOpen className="h-4 w-4" />
                Public source: {project.publicReference.name}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {originalProject && <p className="mt-3 text-sm text-cyan-100">Based on {originalProject.title}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <Stat label="Predicted apogee" value={formatMeters(project.predictedAltitudeM)} />
              <Stat label="Actual apogee" value={project.actualAltitudeM ? formatMeters(project.actualAltitudeM) : "Not claimed"} />
              <Stat label="Peak thrust" value={peakThrust ? `${formatNumber(peakThrust)} N` : project.hasThrustData ? "Attached" : "Not attached"} />
              <Stat label="Max velocity" value={maxVelocity ? `${formatNumber(maxVelocity)} m/s` : "Not attached"} />
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-orange-200" />Performance</h2>
                <div className="mt-4 grid gap-3 text-sm text-orange-50/72">
                  <KeyValue label="Motor" value={project.motorClass} />
                  <KeyValue label="Difficulty" value={project.difficulty} />
                  <KeyValue label="Total impulse" value={project.summary?.totalImpulseNs ? `${formatNumber(project.summary.totalImpulseNs)} Ns` : "Not attached"} />
                  <KeyValue label="Burn time" value={project.summary?.burnTimeS ? `${formatNumber(project.summary.burnTimeS)} s` : "Not attached"} />
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold"><Ruler className="h-5 w-5 text-cyan-200" />Envelope</h2>
                <div className="mt-4 grid gap-3 text-sm text-orange-50/72">
                  <KeyValue label="Length" value={`${formatNumber(project.specs.lengthMm)} mm`} />
                  <KeyValue label="Diameter" value={`${formatNumber(project.specs.diameterMm)} mm`} />
                  <KeyValue label="Mass" value={formatMass(project.specs.massG)} />
                  <KeyValue label="Stability" value={`${project.specs.stabilityCalibers} calibers`} />
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-200" />Verification</h2>
                <div className="mt-4"><VerificationBadge status={project.verificationStatus} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-orange-50/72">
                  <Flag label="CAD" enabled={project.hasWebCad} />
                  <Flag label="Telemetry" enabled={project.hasTelemetry} />
                  <Flag label="Flight log" enabled={project.hasFlightLog} />
                  <Flag label="Thrust data" enabled={project.hasThrustData} />
                </div>
              </Card>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.8fr]">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold"><BookOpen className="h-5 w-5 text-orange-200" />Evidence map</h2>
                <div className="mt-4 space-y-3">
                  {evidenceEntries.length ? evidenceEntries.map(([label, value]) => (
                    <div key={label} className="rounded-md bg-white/[0.04] p-3">
                      <p className="text-sm font-semibold text-orange-100">{label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-orange-50/68">{formatEvidenceValue(value)}</p>
                    </div>
                  )) : <p className="text-sm text-orange-50/62">No evidence notes attached.</p>}
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-cyan-200" />Files and rights</h2>
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file) => <FileRow key={file.name} file={file} />)}
                </div>
                <div className="mt-5 grid gap-3 text-sm text-orange-50/72">
                  <KeyValue label="Usage rights" value={project.accessPolicy?.usageRights ?? "Open reference"} />
                  <KeyValue label="Fork policy" value={project.accessPolicy?.forkPolicy ?? "Allowed where source permits"} />
                  <KeyValue label="Published" value={formatDate(project.publishedAt ?? project.uploadedAt)} />
                </div>
              </Card>
            </div>

            <Card className="mt-8 p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Box className="h-5 w-5 text-orange-200" />Component disclosure</h2>
              {project.scaffoldNotice ? <p className="mt-3 text-sm text-orange-50/62">{project.scaffoldNotice}</p> : null}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-orange-50/48">
                    <tr>
                      <th className="border-b border-white/10 px-3 py-2">Part</th>
                      <th className="border-b border-white/10 px-3 py-2">Type</th>
                      <th className="border-b border-white/10 px-3 py-2">Length</th>
                      <th className="border-b border-white/10 px-3 py-2">Diameter</th>
                      <th className="border-b border-white/10 px-3 py-2">Mass</th>
                      <th className="border-b border-white/10 px-3 py-2">Material / note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.components.map((component) => <ComponentRow key={component.id} component={component} />)}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <MultiTelemetryChart data={project.telemetry.points} />
              <TelemetryChart data={project.telemetry.points} type="thrust" />
            </div>
            <div className="mt-5"><RawDataPreview data={project.telemetry.points} /></div>
          </div>
          <aside className="space-y-5">
            <div className="relative aspect-[16/11] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"><Image src={project.image} alt={project.title} fill className="object-contain p-4" /></div>
            <Card className="p-5">
              <h2 className="font-semibold">Archive metadata</h2>
              <div className="mt-4 grid gap-3 text-sm text-orange-50/72">
                <KeyValue label="Visibility" value={project.visibility ?? "Public project"} />
                <KeyValue label="Source type" value={project.source ?? "Public archive"} />
                <KeyValue label="Evidence files" value={String(uploadedFiles.length)} />
                <KeyValue label="Forks" value={String(project.forkCount)} />
              </div>
              <div className="mt-4 flex gap-2"><Button asChild href={`/forks/${project.slug}`}><GitFork className="h-4 w-4" />Fork tree</Button><Button asChild href={`/upload`} variant="outline">Publish your project</Button></div>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-200" />Disclosure scope</h2>
              <div className="mt-4 space-y-3 text-sm text-orange-50/68">
                <p>{project.moderation?.restrictedContentHandling ?? "No additional moderation scope declared."}</p>
                {project.moderation?.rawSourcePublished === false ? <p>Raw source is not published in this public archive.</p> : null}
                {project.moderation?.omittedDetails?.length ? (
                  <div>
                    <p className="font-semibold text-orange-100">Omitted from public view</p>
                    <ul className="mt-2 space-y-1">
                      {project.moderation.omittedDetails.map((detail) => <li key={detail}>- {detail}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5 text-cyan-200" />Project discussions</h2>
              <div className="mt-4 space-y-3">{projectDiscussions.length ? projectDiscussions.map((discussion) => <p key={discussion.id} className="rounded-md bg-white/[0.04] p-3 text-sm"><span className="text-orange-200">{discussion.type}</span><br />{discussion.title}</p>) : <p className="text-sm text-orange-50/62">No discussions yet.</p>}</div>
            </Card>
            <Card className="p-5"><h2 className="flex items-center gap-2 font-semibold"><Upload className="h-5 w-5 text-orange-200" />Report and moderation</h2><p className="mt-3 text-sm text-orange-50/64">Report projects or files for admin review, policy checks, and restricted-content handling.</p></Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-orange-50/55">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-[0.14em] text-orange-50/45">{label}</p><p className="mt-1 text-orange-50/78">{value}</p></div>;
}

function Flag({ label, enabled }: { label: string; enabled: boolean }) {
  return <span className={`rounded-md px-2 py-1 ${enabled ? "bg-emerald-300/12 text-emerald-100" : "bg-white/[0.04] text-orange-50/45"}`}>{label}: {enabled ? "yes" : "no"}</span>;
}

function FileRow({ file }: { file: UploadedFileSummary }) {
  return (
    <div className="rounded-md bg-white/[0.04] px-3 py-2 text-sm text-orange-50/70">
      <p className="font-medium text-orange-50">{file.name}</p>
      <p className="mt-1 text-xs text-orange-50/52">{[file.contentType, file.sizeBytes ? formatBytes(file.sizeBytes) : undefined].filter(Boolean).join(" / ") || "metadata file"}</p>
    </div>
  );
}

function ComponentRow({ component }: { component: RocketComponent }) {
  return (
    <tr className="border-b border-white/10 last:border-0">
      <td className="px-3 py-3 text-orange-50/80">{component.name}</td>
      <td className="px-3 py-3 text-orange-50/62">{component.type}</td>
      <td className="px-3 py-3 text-orange-50/62">{formatNumber(component.length)} mm</td>
      <td className="px-3 py-3 text-orange-50/62">{formatNumber(component.diameter)} mm</td>
      <td className="px-3 py-3 text-orange-50/62">{formatMass(component.mass)}</td>
      <td className="px-3 py-3 text-orange-50/62">{component.material}</td>
    </tr>
  );
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

function formatEvidenceValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "object" && value) return JSON.stringify(value, null, 2);
  return String(value);
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
