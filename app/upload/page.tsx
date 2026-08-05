"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  BadgeCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid3X3,
  Rocket,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ComponentConfigurationPanel,
  RocketComponentTree,
  RocketSideProfile,
  createRocketComponent,
} from "@/components/build-workspace";
import { FileUploadBox } from "@/components/file-upload-box";
import { UpgradeLimitCard, UsageCounter } from "@/components/usage-meter";
import { Button } from "@/components/ui/button";
import { readMockUser, restoreAuthUserFromCloud, type AuthUser } from "@/lib/auth";
import { totalLength as calculateRocketLength } from "@/lib/cad/geometry";
import { PUBLIC_PROJECTS_OWNER_KEY, savePersistentRecord, type PersistentFileRecord } from "@/lib/cloud-persistence";
import { runRocketEstimateWithMotor } from "@/lib/rocket-simulation";
import { useCloudUsage } from "@/lib/use-cloud-usage";
import type { Difficulty, RocketComponent, RocketComponentType, VerificationStatus } from "@/lib/types";
import { ARTICLE_COVERAGE_COPY, type AccountType, type UsageStatus } from "@/lib/usage-limits";

type Step = { title: string; label: string; Icon: LucideIcon };

const steps: Step[] = [
  { title: "Project", label: "Identity", Icon: FileText },
  { title: "CAD", label: "Web model", Icon: Grid3X3 },
  { title: "Flight", label: "Motor data", Icon: Calculator },
  { title: "Evidence", label: "Proof files", Icon: UploadCloud },
  { title: "Release", label: "Access", Icon: BadgeCheck },
];

const initialParts: RocketComponent[] = [
  {
    id: "upload-nose",
    type: "nose_cone",
    name: "Ogive nose cone",
    length: 210,
    diameter: 70,
    wallThickness: 2,
    material: "Fiberglass",
    mass: 180,
    position: 0,
    noseShape: "Ogive",
    shapeParameter: 1,
    finish: "Regular paint",
  },
  {
    id: "upload-payload",
    type: "payload_section",
    name: "Avionics payload bay",
    length: 180,
    diameter: 70,
    wallThickness: 2,
    material: "Fiberglass",
    mass: 320,
    position: 210,
  },
  {
    id: "upload-body",
    type: "body_tube",
    name: "Main airframe",
    length: 620,
    diameter: 70,
    wallThickness: 2,
    material: "Cardboard",
    mass: 560,
    position: 390,
    automaticDiameter: true,
    finish: "Regular paint",
  },
  {
    id: "upload-recovery",
    type: "recovery_bay",
    name: "Recovery bay",
    length: 150,
    diameter: 70,
    wallThickness: 2,
    material: "Nylon and cardboard",
    mass: 220,
    position: 640,
  },
  {
    id: "upload-motor",
    type: "motor_mount",
    name: "29 mm motor mount",
    length: 280,
    diameter: 29,
    wallThickness: 2,
    material: "Phenolic",
    mass: 180,
    position: 780,
  },
  {
    id: "upload-fins",
    type: "fins",
    name: "Freeform fin set",
    length: 170,
    diameter: 70,
    wallThickness: 4,
    material: "Plywood",
    mass: 260,
    position: 870,
    finPlanform: "Freeform",
    finRootChord: 170,
    finTipChord: 64,
    finSpan: 82,
    finSweep: 36,
    finCount: 4,
    finCrossSection: "Airfoil",
    finFreeformPoints: [
      { x: 0, y: 0 },
      { x: 34, y: 82 },
      { x: 116, y: 82 },
      { x: 170, y: 0 },
    ],
  },
];

type EvidenceUploadItem = {
  key: string;
  title: string;
  description: string;
  formats: string;
  status: "required" | "recommended" | "optional";
  acceptedSpecifiers: string[];
};

type ProjectFormState = {
  title: string;
  ownerAccount: string;
  visibility: "Private project" | "Public project" | "Unlisted reference";
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "High Power";
  category: string;
  motorClass: string;
  referenceUrl: string;
  publishGoal: string;
  description: string;
  highlights: string;
  reuseNotes: string;
  limitations: string;
};

type FlightFormState = {
  propellantFamily: string;
  grainGeometry: string;
  motorEvidenceSource: string;
  disclosureLevel: string;
  motorDesignation: string;
  motorClass: string;
  caseDiameter: string;
  totalImpulse: string;
  avgPeakThrust: string;
  burnTime: string;
  predictedApogee: string;
  measuredApogee: string;
};

type ReleaseFormState = {
  releaseType: "Private archive" | "Public project" | "Unlisted reference";
  usageRights: string;
  forkPolicy: string;
  dataAccess: string;
  articleRequest: string;
  contactEmail: string;
  citation: string;
  reviewState: string;
};

type EvidenceSelection = {
  names: string[];
  records: PersistentFileRecord[];
};

const defaultProjectForm: ProjectFormState = {
  title: "",
  ownerAccount: "",
  visibility: "Private project",
  difficulty: "Advanced",
  category: "Sport model rocket",
  motorClass: "",
  referenceUrl: "",
  publishGoal: "Share project",
  description: "",
  highlights: "",
  reuseNotes: "",
  limitations: "",
};

const defaultFlightForm: FlightFormState = {
  propellantFamily: "Commercial certified motor",
  grainGeometry: "Unknown / not published",
  motorEvidenceSource: "Manufacturer thrust curve",
  disclosureLevel: "Public performance metadata",
  motorDesignation: "",
  motorClass: "",
  caseDiameter: "",
  totalImpulse: "",
  avgPeakThrust: "",
  burnTime: "",
  predictedApogee: "",
  measuredApogee: "",
};

const defaultReleaseForm: ReleaseFormState = {
  releaseType: "Private archive",
  usageRights: "Educational reference",
  forkPolicy: "Allow attributed forks",
  dataAccess: "Summary only",
  articleRequest: "Not requested",
  contactEmail: "",
  citation: "",
  reviewState: "Draft",
};

function slugFrom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "uploaded-rocket-project";
}

function parseNumber(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function parseNumbers(value: string) {
  return Array.from(value.replace(/,/g, "").matchAll(/-?\d+(\.\d+)?/g)).map((match) => Number(match[0]));
}

function referenceNameFromUrl(value: string) {
  if (!value.trim()) return undefined;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Public reference";
  }
}

function resolveVisibility(projectVisibility: ProjectFormState["visibility"], releaseType: ReleaseFormState["releaseType"]) {
  if (projectVisibility === "Public project" || releaseType === "Public project") return "public";
  if (projectVisibility === "Unlisted reference" || releaseType === "Unlisted reference") return "unlisted";
  return "private";
}

function verificationFromEvidence(files: Record<string, EvidenceSelection>, actualAltitude?: number): VerificationStatus {
  if (files["telemetry-logs"]?.names.length) return "Telemetry attached";
  if (files["media-proof"]?.names.length || actualAltitude) return "Media proof";
  if (files["motor-thrust-source"]?.names.length) return "Static fire data";
  if (files["cad-source"]?.names.length) return "Design reviewed";
  return "Design uploaded";
}

function evidenceRecordCount(files: Record<string, EvidenceSelection>) {
  return Object.values(files).reduce((sum, group) => sum + group.names.length, 0);
}

function flattenEvidenceRecords(files: Record<string, EvidenceSelection>) {
  return Object.values(files).flatMap((group) => group.records);
}

const imageFilePattern = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function representativeImageFromRecords(records: Array<{ name: string; contentType?: string; type?: string; signedUrl?: string | null; publicUrl?: string }>) {
  const image = records.find((record) => {
    const type = record.contentType ?? record.type ?? "";
    return /^image\//i.test(type) || imageFilePattern.test(record.name);
  });
  return image?.publicUrl ?? image?.signedUrl ?? undefined;
}

const evidence: EvidenceUploadItem[] = [
  {
    key: "cad-source",
    title: "CAD source",
    description: "Attach the source model or export that reviewers should compare against the editable Web CAD record.",
    formats: ".ork/.ork.gz, STEP/STP, STL, JSON/XML, ZIP",
    status: "recommended",
    acceptedSpecifiers: [".ork", ".ork.gz", ".xml", ".step", ".stp", ".stl", ".json", ".zip"],
  },
  {
    key: "motor-thrust-source",
    title: "Motor and thrust source",
    description: "Use interoperable motor data or measured static-fire files for simulation traceability.",
    formats: ".eng, .rse, CSV, JSON, TXT, PDF",
    status: "recommended",
    acceptedSpecifiers: [".eng", ".rse", ".csv", ".json", ".txt", ".pdf"],
  },
  {
    key: "telemetry-logs",
    title: "Telemetry logs",
    description: "Upload raw flight data so altitude, velocity, acceleration, pressure, and GPS channels can be mapped.",
    formats: "CSV, JSON, TXT, ZIP",
    status: "recommended",
    acceptedSpecifiers: [".csv", ".json", ".txt", ".zip"],
  },
  {
    key: "media-proof",
    title: "Proof media",
    description: "Add launch, recovery, inspection, or bench-test media for visual verification.",
    formats: "Images, videos, PDF, ZIP",
    status: "optional",
    acceptedSpecifiers: ["image/*", "video/*", ".pdf", ".zip"],
  },
  {
    key: "inspection-notes",
    title: "Inspection notes",
    description: "Keep post-test findings, anomalies, recovery notes, and failure observations with the project.",
    formats: "TXT, PDF, CSV, JSON, images, ZIP",
    status: "optional",
    acceptedSpecifiers: [".txt", ".pdf", ".csv", ".json", "image/*", ".zip"],
  },
  {
    key: "build-package",
    title: "Build package",
    description: "Attach BOMs, drawings, guides, safe handling notes, or packaged source files.",
    formats: "ZIP, PDF, JSON, CSV, TXT, STEP/STP, STL, images",
    status: "optional",
    acceptedSpecifiers: [".zip", ".pdf", ".json", ".csv", ".txt", ".step", ".stp", ".stl", "image/*"],
  },
];

export default function UploadPage() {
  const publishingRef = useRef(false);
  const [active, setActive] = useState(0);
  const [parts, setParts] = useState(initialParts);
  const [selectedId, setSelectedId] = useState("upload-body");
  const [status, setStatus] = useState("Draft is local until cloud sync is available.");
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [projectLimitPrompt, setProjectLimitPrompt] = useState<{ title: string; description: string } | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [flightForm, setFlightForm] = useState<FlightFormState>(defaultFlightForm);
  const [releaseForm, setReleaseForm] = useState<ReleaseFormState>(defaultReleaseForm);
  const [files, setFiles] = useState<Record<string, EvidenceSelection>>({});
  const { statuses, loading: usageLoading, error: usageError, claimUsage, refreshUsage } = useCloudUsage();

  useEffect(() => {
    let mounted = true;

    function applyUser(user: AuthUser | null) {
      if (!mounted) return;
      setCurrentUser(user);
      if (user) {
        setProjectForm((current) => current.ownerAccount ? current : { ...current, ownerAccount: user.name });
        setReleaseForm((current) => current.contactEmail ? current : { ...current, contactEmail: user.email });
      }
    }

    applyUser(readMockUser());
    void restoreAuthUserFromCloud().then(applyUser);

    const handleAuthChange = () => applyUser(readMockUser());
    window.addEventListener("rocketry-auth-change", handleAuthChange);
    return () => {
      mounted = false;
      window.removeEventListener("rocketry-auth-change", handleAuthChange);
    };
  }, []);

  const selected = parts.find((part) => part.id === selectedId) ?? parts[0];
  const simulationResult = useMemo(() => runRocketEstimateWithMotor(parts, undefined, { windSpeedMps: 0 }), [parts]);
  const totalLength = Math.round(calculateRocketLength(parts));
  const totalMass = parts.reduce((sum, part) => sum + part.mass, 0);
  const cg = Math.round(simulationResult.cgMm);
  const cp = Math.round(simulationResult.cpMm);
  const stability = simulationResult.stabilityMargin.toFixed(2);
  const requestedVisibility = resolveVisibility(projectForm.visibility, releaseForm.releaseType);
  const evidenceFiles = useMemo(() => flattenEvidenceRecords(files), [files]);
  const evidenceFileCount = evidenceRecordCount(files);

  const payload = useMemo(
    () => ({
      version: "upload-workspace-v3",
      updatedAt: new Date().toISOString(),
      activeStep: active + 1,
      project: projectForm,
      flight: flightForm,
      release: releaseForm,
      cad: { components: parts, totalLength, totalMass, cg, cp, stability, simulationResult },
      evidence: Object.fromEntries(
        evidence.map((item) => [
          item.key,
          {
            title: item.title,
            names: files[item.key]?.names ?? [],
            records: files[item.key]?.records ?? [],
          },
        ])
      ),
      evidenceFiles,
    }),
    [active, cg, cp, evidenceFiles, files, flightForm, parts, projectForm, releaseForm, simulationResult, stability, totalLength, totalMass],
  );

  async function saveDraft() {
    const result = await savePersistentRecord("upload-drafts", "active-upload-draft", payload);
    setStatus(result.error ? `Saved locally. Cloud sync needs sign-in.` : result.cloud ? "Saved upload draft to Supabase." : "Saved upload draft locally.");
  }

  async function publishProject() {
    if (publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    try {
      setProjectLimitPrompt(null);
    const usageClaim = await claimUsage("projectsCreatedCount");
    if (!usageClaim.ok) {
      const prompt = usageClaim.data.prompt ?? {
        title: usageClaim.data.message ?? "Cloud usage sync required.",
        description: usageClaim.data.error ?? "Sign in with a cloud account before publishing projects so Standard plan usage can be tracked."
      };
      setProjectLimitPrompt({ title: prompt.title, description: prompt.description });
      setStatus(prompt.title);
      setSafetyOpen(false);
      return;
    }

    const now = new Date().toISOString();
    const title = projectForm.title.trim() || "Untitled Rocket Project";
    const projectKey = `${slugFrom(title)}-${Date.now()}`;
    const referenceUrl = projectForm.referenceUrl.trim();
    const predictedAltitudeM = Math.round(parseNumber(flightForm.predictedApogee) ?? simulationResult.predictedAltitudeM ?? 0);
    const actualAltitudeM = parseNumber(flightForm.measuredApogee);
    const verificationStatus = verificationFromEvidence(files, actualAltitudeM);
    const motorClass = flightForm.motorClass.trim() || projectForm.motorClass.trim() || flightForm.motorDesignation.trim() || "Unspecified solid motor";
    const evidenceFileNames = Object.values(files).flatMap((group) => group.names);
    const totalImpulseNs = parseNumber(flightForm.totalImpulse);
    const thrustValues = parseNumbers(flightForm.avgPeakThrust);
    const maxThrustN = thrustValues.length ? Math.max(...thrustValues) : undefined;
    const burnTimeS = parseNumber(flightForm.burnTime);
    const uploadedFiles = evidenceFiles.map((file) => ({
      name: file.name,
      title: file.title,
      sizeBytes: file.size,
      contentType: file.type,
      storagePath: file.storagePath,
      signedUrl: file.publicUrl ?? null,
      signedUrlCreated: Boolean(file.publicUrl),
      uploadedAt: file.uploadedAt,
    }));
    const representativeImage = representativeImageFromRecords(uploadedFiles) ?? "/project-art-1.svg";
    const projectPackage = {
      ...payload,
      id: projectKey,
      slug: projectKey,
      name: title,
      title,
      creator: projectForm.ownerAccount.trim() || currentUser?.name || "Rocketry House builder",
      creatorId: currentUser?.id,
      creatorEmail: currentUser?.email,
      description:
        projectForm.description.trim() ||
        "A Rocketry House upload package with project metadata, editable Web CAD, motor context, evidence attachments, and release settings.",
      status: "published",
      source: "upload-workspace",
      visibility: requestedVisibility,
      difficulty: projectForm.difficulty as Difficulty,
      motorClass,
      predictedAltitudeM,
      actualAltitudeM,
      verificationStatus,
      hasWebCad: parts.length > 0,
      hasFlightLog: Boolean(actualAltitudeM || files["inspection-notes"]?.names.length || files["media-proof"]?.names.length),
      hasTelemetry: Boolean(files["telemetry-logs"]?.names.length),
      hasThrustData: Boolean(files["motor-thrust-source"]?.names.length || flightForm.motorEvidenceSource !== "No motor attached"),
      hasStlStep: Boolean(files["cad-source"]?.names.some((name) => /\.(stl|step|stp)$/i.test(name))),
      verifiedFlight: verificationStatus === "Telemetry attached" || Boolean(actualAltitudeM && files["media-proof"]?.names.length),
      priceCents: 0,
      tags: [projectForm.category, flightForm.propellantFamily, motorClass, requestedVisibility, projectForm.publishGoal].filter(Boolean),
      image: representativeImage,
      specs: {
        lengthMm: totalLength,
        diameterMm: Math.round(Math.max(...parts.map((part) => part.diameter), 1)),
        massG: totalMass,
        stabilityCalibers: Number(stability),
      },
      files: evidenceFileNames.length ? evidenceFileNames : ["design.rh.json", "project-summary.json", "evidence-index.json"],
      components: parts,
      uploadProject: projectForm,
      publicReference: referenceUrl ? { name: referenceNameFromUrl(referenceUrl) ?? "Public reference", url: referenceUrl } : undefined,
      referenceName: referenceUrl ? referenceNameFromUrl(referenceUrl) : undefined,
      referenceUrl: referenceUrl || undefined,
      accessPolicy: {
        priceCents: 0,
        usageRights: releaseForm.usageRights,
        forkPolicy: releaseForm.forkPolicy,
      },
      summary: {
        predictedAltitudeM,
        actualAltitudeM,
        motorClass,
        propellantFamily: flightForm.propellantFamily,
        evidenceFileCount,
        lengthMm: totalLength,
        dryMassG: totalMass,
        cgMm: cg,
        cpMm: cp,
        stabilityMargin: Number(stability),
        maxVelocityMps: simulationResult.maxVelocityMps,
        maxThrustN,
        totalImpulseNs,
        burnTimeS,
      },
      narrative: {
        highlights: projectForm.highlights.trim() || undefined,
        reuseNotes: projectForm.reuseNotes.trim() || undefined,
        limitations: projectForm.limitations.trim() || undefined,
        safetyScope: flightForm.disclosureLevel,
        dataNotes: `${evidenceFileCount} evidence files, ${parts.length} CAD components, ${simulationResult.timeSeries.length} simulation points`,
      },
      release: releaseForm,
      flight: flightForm,
      evidenceFiles,
      uploadedFiles,
      publishedAt: now,
      updatedAt: now,
    };
    const persistenceOptions = requestedVisibility === "public" ? { ownerKey: PUBLIC_PROJECTS_OWNER_KEY } : undefined;
    const [projectResult, rocketProjectResult] = await Promise.all([
      savePersistentRecord("projects", projectKey, projectPackage, persistenceOptions),
      savePersistentRecord("rocket_projects", projectKey, projectPackage, persistenceOptions),
    ]);
    const cloudSynced = projectResult.cloud && rocketProjectResult.cloud;
    const hasError = projectResult.error || rocketProjectResult.error;
    setStatus(
      hasError
        ? requestedVisibility === "public"
          ? "Saved locally. Sign in is required to publish to the public archive."
          : "Published locally. Sign in is required for cloud archive."
        : cloudSynced
          ? requestedVisibility === "public"
            ? `Published to the public archive: /projects/${projectKey}`
            : "Project package published to your account archive."
          : "Project package published locally."
    );
    void refreshUsage();
    setSafetyOpen(false);
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  function updateComponent(id: string, patch: Partial<RocketComponent>) {
    setParts((current) => current.map((part) => (part.id === id ? { ...part, ...patch } : part)));
  }

  function addComponent(type: RocketComponentType, label?: string) {
    const component = createRocketComponent(type, parts, label);
    setParts((current) => [...current, component]);
    setSelectedId(component.id);
  }

  return (
    <main className="mt-16 min-h-[calc(100dvh-4rem)] overflow-y-auto bg-[#f4f1ea] px-3 py-4 text-slate-950">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-sm">
        <header className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Publish workspace</p>
              <h1 className="text-[1.45rem] font-black leading-tight tracking-tight">Upload a rocket project</h1>
              <p className="mt-0.5 max-w-2xl text-xs font-semibold text-slate-600">
                A compact release flow for project metadata, editable Web CAD, flight context, proof files, licensing, and public archive readiness.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {currentUser ? (
                <Button size="sm" variant="outline" href="/profile" asChild className="rounded-xl border-emerald-300 bg-emerald-50 text-emerald-800">
                  {currentUser.name}
                </Button>
              ) : (
                <Button size="sm" variant="outline" href="/auth/sign-in" asChild className="rounded-xl border-amber-300 bg-amber-50 text-amber-800">
                  Sign in
                </Button>
              )}
              <Button size="sm" href="/build/rocket" asChild className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400"><Rocket className="mr-1 h-4 w-4" />Builder</Button>
            </div>
          </div>
          <nav className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setActive(index)}
                className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left transition ${
                  active === index ? "border-orange-400 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-black ${active === index ? "bg-orange-300 text-slate-950" : "bg-orange-100 text-orange-700"}`}>{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">{step.title}</span>
                  <span className={`block truncate text-xs font-semibold ${active === index ? "text-slate-300" : "text-slate-500"}`}>{step.label}</span>
                </span>
              </button>
            ))}
          </nav>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Step {active + 1} of 5</p>
              <h2 className="text-base font-black">{steps[active].title} / {steps[active].label}</h2>
            </div>
            <StepControls active={active} setActive={setActive} compact />
          </div>

          <div className="p-2">
            {active === 0 && (
              <ProjectStep
                form={projectForm}
                setForm={setProjectForm}
                projectUsage={statuses?.projectsCreatedCount}
                usageLoading={usageLoading}
                usageError={usageError}
                limitPrompt={projectLimitPrompt}
                accountType={currentUser?.accountType ?? "personal"}
                onDismissLimitPrompt={() => setProjectLimitPrompt(null)}
              />
            )}
            {active === 1 && (
              <CadStep
                parts={parts}
                selected={selected}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updateComponent={updateComponent}
                addComponent={addComponent}
                result={simulationResult}
                stats={{ totalLength, totalMass, cg, cp, stability }}
              />
            )}
            {active === 2 && <FlightStep form={flightForm} setForm={setFlightForm} />}
            {active === 3 && <EvidenceStep files={files} setFiles={setFiles} />}
            {active === 4 && <ReleaseStep form={releaseForm} setForm={setReleaseForm} />}
          </div>
        </section>

        <footer className="flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          <span className="truncate">{status} Contact: rocketryhouse@gmail.com</span>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" onClick={saveDraft} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">Save</Button>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} className="rounded-xl">Preview</Button>
            <Button type="button" onClick={() => setSafetyOpen(true)} className="rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-200">Publish</Button>
          </div>
        </footer>
      </div>

      {previewOpen ? (
        <PreviewModal
          project={projectForm}
          flight={flightForm}
          release={releaseForm}
          visibility={requestedVisibility}
          evidenceCount={evidenceFileCount}
          evidenceFiles={evidenceFiles}
          stats={{ totalLength, totalMass, cg, cp, stability }}
          predictedAltitudeM={Math.round(parseNumber(flightForm.predictedApogee) ?? simulationResult.predictedAltitudeM ?? 0)}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {safetyOpen ? <SafetyModal onClose={() => setSafetyOpen(false)} onConfirm={publishProject} publishing={publishing} /> : null}
    </main>
  );
}

function StepControls({ active, setActive, compact = false }: { active: number; setActive: (step: number) => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" size={compact ? "sm" : "md"} disabled={active === 0} onClick={() => setActive(Math.max(0, active - 1))} className="rounded-xl">
        {!compact && <ChevronLeft className="mr-1 h-4 w-4" />}Previous
      </Button>
      <Button type="button" size={compact ? "sm" : "md"} disabled={active === steps.length - 1} onClick={() => setActive(Math.min(steps.length - 1, active + 1))} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">
        Next<ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function ProjectStep({
  form,
  setForm,
  projectUsage,
  usageLoading,
  usageError,
  limitPrompt,
  accountType,
  onDismissLimitPrompt
}: {
  form: ProjectFormState;
  setForm: Dispatch<SetStateAction<ProjectFormState>>;
  projectUsage?: UsageStatus | null;
  usageLoading: boolean;
  usageError: string;
  limitPrompt: { title: string; description: string } | null;
  accountType: AccountType;
  onDismissLimitPrompt: () => void;
}) {
  const update = (patch: Partial<ProjectFormState>) => setForm((current) => ({ ...current, ...patch }));
  return (
    <Panel Icon={FileText} title="Project identity" detail="Name the repository, ownership, category, and publish goal.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Project title" value={form.title} onChange={(title) => update({ title })} placeholder="Scout F-style TVC test rocket" wide />
        <Field label="Owner account" value={form.ownerAccount} onChange={(ownerAccount) => update({ ownerAccount })} placeholder="Personal, team, or organization" />
        <Pick label="Visibility" value={form.visibility} onChange={(visibility) => update({ visibility: visibility as ProjectFormState["visibility"] })} options={["Private project", "Public project", "Unlisted reference"]} />
        <Pick label="Difficulty" value={form.difficulty} onChange={(difficulty) => update({ difficulty: difficulty as ProjectFormState["difficulty"] })} options={["Beginner", "Intermediate", "Advanced", "High Power"]} />
        <Pick label="Solid rocket category" value={form.category} onChange={(category) => update({ category })} options={["Sport model rocket", "High-power rocket", "Sounding rocket", "Static-fire article"]} />
        <Field label="Motor class" value={form.motorClass} onChange={(motorClass) => update({ motorClass })} placeholder="H178, J350, custom" />
        <Field label="Reference URL" value={form.referenceUrl} onChange={(referenceUrl) => update({ referenceUrl })} placeholder="Optional public reference" />
        <Pick label="Publish goal" value={form.publishGoal} onChange={(publishGoal) => update({ publishGoal })} options={["Share project", "Archive flight record", "Request article coverage"]} />
      </div>
      <textarea
        value={form.description}
        onChange={(event) => update({ description: event.target.value })}
        className="mt-2 h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
        placeholder="Design goal, assumptions, safety constraints, flight history, and what a fork should preserve."
      />
      <div className="mt-2 grid grid-cols-1 gap-1.5 lg:grid-cols-3">
        <label className="min-w-0">
          <span className="mb-1 block truncate text-xs font-black text-slate-600">Highlights</span>
          <textarea
            value={form.highlights}
            onChange={(event) => update({ highlights: event.target.value })}
            className="h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
            placeholder="Most useful finding, flight result, design decision, or comparison."
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block truncate text-xs font-black text-slate-600">Reusable data</span>
          <textarea
            value={form.reuseNotes}
            onChange={(event) => update({ reuseNotes: event.target.value })}
            className="h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
            placeholder="CAD parts, telemetry, thrust source, files, or checks another builder can inspect."
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block truncate text-xs font-black text-slate-600">Known limitations</span>
          <textarea
            value={form.limitations}
            onChange={(event) => update({ limitations: event.target.value })}
            className="h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
            placeholder="Missing measurements, private details, uncertainty, review status, or safety scope."
          />
        </label>
      </div>
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Solid motor data is accepted for simulation and documentation only. Hazardous manufacturing instructions, harmful payload workflows, and weaponization content are not allowed.
      </div>
      <div className="mt-2">
        <UsageCounter label="Projects" status={projectUsage} loading={usageLoading} error={usageError} />
      </div>
      {limitPrompt ? (
        <div className="mt-2">
          <UpgradeLimitCard accountType={accountType} title={limitPrompt.title} description={limitPrompt.description} onDismiss={onDismissLimitPrompt} />
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="Standard plan" value="Up to 3 projects" />
        <Info title="Cloud source of truth" value="Project usage is checked against Supabase before publishing." />
        <Info title="Article coverage" value="Pro requests route to ICANEWS Global Research through rocketryhouse@gmail.com." />
      </div>
    </Panel>
  );
}

function CadStep({
  parts,
  selected,
  selectedId,
  setSelectedId,
  updateComponent,
  addComponent,
  result,
  stats,
}: {
  parts: RocketComponent[];
  selected: RocketComponent;
  selectedId: string;
  setSelectedId: (id: string) => void;
  updateComponent: (id: string, patch: Partial<RocketComponent>) => void;
  addComponent: (type: RocketComponentType, label?: string) => void;
  result: ReturnType<typeof runRocketEstimateWithMotor>;
  stats: { totalLength: number; totalMass: number; cg: number; cp: number; stability: string };
}) {
  const addActions: Array<{ label: string; type: RocketComponentType; name?: string }> = [
    { label: "Add nose", type: "nose_cone" },
    { label: "Add body", type: "body_tube" },
    { label: "Add transition", type: "transition" },
    { label: "Add payload", type: "payload_section" },
    { label: "Add recovery", type: "recovery_bay" },
    { label: "Add motor", type: "motor_mount" },
    { label: "Add fins", type: "fins", name: "Freeform fin set" },
    { label: "Add rail", type: "rail_buttons" },
  ];

  return (
    <Panel Icon={Grid3X3} title="Canonical Web CAD" detail="The editable web model stays canonical; imported files remain evidence attachments.">
      <div className="flex h-full min-h-[520px] flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 xl:grid-cols-4">
            <Metric label="Length" value={`${stats.totalLength} mm`} />
            <Metric label="Dry mass" value={`${stats.totalMass} g`} />
            <Metric label="CG / CP" value={`${stats.cg} / ${stats.cp} mm`} />
            <Metric label="Stability" value={`${stats.stability} cal`} />
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {addActions.map((action) => (
              <Button key={action.label} type="button" variant="outline" size="sm" onClick={() => addComponent(action.type, action.name)} className="h-8 rounded-xl bg-white text-xs font-black">
                {action.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ components: parts, simulation: result }, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "rocketry-house-cad.json";
                anchor.click();
                URL.revokeObjectURL(url);
              }}
              className="h-8 rounded-xl bg-white text-xs font-black"
            >
              Save CAD JSON
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[280px_minmax(0,1fr)_390px]">
          <aside className="max-h-[260px] min-h-0 overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] p-2 text-orange-50 xl:max-h-none">
            <p className="px-2 pt-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-50/55">Component tree</p>
            <RocketComponentTree components={parts} selectedId={selectedId} select={setSelectedId} />
          </aside>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
            <RocketSideProfile components={parts} result={result} selectedId={selectedId} select={setSelectedId} />
          </div>

          <aside className="max-h-[520px] min-h-0 overflow-y-auto rounded-2xl border border-slate-800 bg-[#111827] p-4 text-orange-50">
            <ComponentConfigurationPanel component={selected} updateComponent={updateComponent} />
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs font-semibold leading-relaxed text-orange-50/65">
              Imported STEP, STL, and .ork-compatible files stay as evidence attachments. The editable web CAD model remains the source used for previews, forks, and project search.
            </div>
          </aside>
        </div>
      </div>
    </Panel>
  );
}

function FlightStep({ form, setForm }: { form: FlightFormState; setForm: Dispatch<SetStateAction<FlightFormState>> }) {
  const update = (patch: Partial<FlightFormState>) => setForm((current) => ({ ...current, ...patch }));
  return (
    <Panel Icon={Calculator} title="Motor and flight analysis" detail="Attach non-hazardous motor metadata, thrust curve source, and trajectory results.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Pick label="Propellant / fuel family" value={form.propellantFamily} onChange={(propellantFamily) => update({ propellantFamily })} options={["Commercial certified motor", "Published performance only", "KNSB metadata", "Custom private metadata"]} />
        <Pick label="Grain geometry" value={form.grainGeometry} onChange={(grainGeometry) => update({ grainGeometry })} options={["Unknown / not published", "Hollow cylinder", "BATES", "Finocyl", "Moon burner", "C-slot", "Other"]} />
        <Pick label="Motor evidence source" value={form.motorEvidenceSource} onChange={(motorEvidenceSource) => update({ motorEvidenceSource })} options={["Manufacturer thrust curve", "Measured static-fire CSV", "Educational simulation estimate", "No motor attached"]} />
        <Pick label="Disclosure level" value={form.disclosureLevel} onChange={(disclosureLevel) => update({ disclosureLevel })} options={["Public performance metadata", "Private team record", "Internal review only"]} />
        <Field label="Motor designation" value={form.motorDesignation} onChange={(motorDesignation) => update({ motorDesignation })} placeholder="H178, J350, custom" />
        <Field label="Motor class" value={form.motorClass} onChange={(motorClass) => update({ motorClass })} placeholder="F, G, H, I, J..." />
        <Field label="Case diameter" value={form.caseDiameter} onChange={(caseDiameter) => update({ caseDiameter })} placeholder="29 / 38 / 54 mm" />
        <Field label="Total impulse" value={form.totalImpulse} onChange={(totalImpulse) => update({ totalImpulse })} placeholder="N-s, if known" />
        <Field label="Avg / peak thrust" value={form.avgPeakThrust} onChange={(avgPeakThrust) => update({ avgPeakThrust })} placeholder="N / N" />
        <Field label="Burn time" value={form.burnTime} onChange={(burnTime) => update({ burnTime })} placeholder="seconds" />
        <Field label="Predicted apogee" value={form.predictedApogee} onChange={(predictedApogee) => update({ predictedApogee })} placeholder="820 m" />
        <Field label="Measured apogee" value={form.measuredApogee} onChange={(measuredApogee) => update({ measuredApogee })} placeholder="Optional" />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="CG / CP" value="Imported from CAD" />
        <Info title="Thrust curve" value="Saved motor or uploaded CSV" />
        <Info title="Graphs" value="Altitude, velocity, acceleration" />
      </div>
    </Panel>
  );
}

function EvidenceStep({ files, setFiles }: { files: Record<string, EvidenceSelection>; setFiles: Dispatch<SetStateAction<Record<string, EvidenceSelection>>> }) {
  const attachedCount = evidenceRecordCount(files);
  const uploadedCount = flattenEvidenceRecords(files).filter((record) => record.publicUrl).length;
  const coveredCount = evidence.filter((item) => files[item.key]?.names.length).length;

  return (
    <Panel Icon={UploadCloud} title="Evidence files" detail="Upload source files with clear format checks, review labels, and file feedback.">
      <div className="mb-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="Attached files" value={`${attachedCount} selected`} />
        <Info title="Coverage" value={`${coveredCount}/${evidence.length} evidence groups`} />
        <Info title="Cloud files" value={`${uploadedCount} synced`} />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {evidence.map((item) => (
          <FileUploadBox
            key={item.key}
            title={item.title}
            description={item.description}
            formats={item.formats}
            status={item.status}
            acceptedSpecifiers={item.acceptedSpecifiers}
            onFilesSelected={(_, selectedFiles, records) => {
              setFiles((current) => ({
                ...current,
                [item.key]: {
                  names: selectedFiles.map((file) => file.name),
                  records: records ?? [],
                },
              }));
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

function ReleaseStep({ form, setForm }: { form: ReleaseFormState; setForm: Dispatch<SetStateAction<ReleaseFormState>> }) {
  const update = (patch: Partial<ReleaseFormState>) => setForm((current) => ({ ...current, ...patch }));
  return (
    <Panel Icon={BadgeCheck} title="Access and release" detail="Choose visibility, usage rights, review state, and article request status before publishing.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Pick label="Release type" value={form.releaseType} onChange={(releaseType) => update({ releaseType: releaseType as ReleaseFormState["releaseType"] })} options={["Private archive", "Public project", "Unlisted reference"]} />
        <Pick label="Usage rights" value={form.usageRights} onChange={(usageRights) => update({ usageRights })} options={["Educational reference", "Subscriber-visible reference", "Team permission required", "Custom access note"]} />
        <Pick label="Fork policy" value={form.forkPolicy} onChange={(forkPolicy) => update({ forkPolicy })} options={["Allow attributed forks", "Team approval required", "No public forks"]} />
        <Pick label="Data access" value={form.dataAccess} onChange={(dataAccess) => update({ dataAccess })} options={["Summary only", "Files visible", "Telemetry visible", "Full evidence package"]} />
        <Pick label="Article request" value={form.articleRequest} onChange={(articleRequest) => update({ articleRequest })} options={["Not requested", "Request coverage", "Coverage already published"]} />
        <Field label="Contact email" value={form.contactEmail} onChange={(contactEmail) => update({ contactEmail })} placeholder="rocketryhouse@gmail.com" />
        <Field label="Citation / DOI" value={form.citation} onChange={(citation) => update({ citation })} placeholder="Optional public citation" />
        <Pick label="Review state" value={form.reviewState} onChange={(reviewState) => update({ reviewState })} options={["Draft", "Ready for review", "Publish after safety gate"]} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="Attribution" value="Forked projects retain lineage and original credit." />
        <Info title="Article coverage" value={ARTICLE_COVERAGE_COPY} />
        <Info title="Moderation" value="Reports and safety status attach to the project." />
      </div>
    </Panel>
  );
}

function Panel({ Icon, title, detail, children }: { Icon: LucideIcon; title: string; detail: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-xl bg-orange-100 p-1.5 text-orange-700"><Icon className="h-5 w-5" /></span>
        <div>
          <h3 className="text-base font-black">{title}</h3>
          <p className="text-xs font-semibold text-slate-500">{detail}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, placeholder, value, onChange, wide = false }: { label: string; placeholder?: string; value?: string | number; onChange?: (value: string) => void; wide?: boolean }) {
  return (
    <label className={wide ? "min-w-0 md:col-span-2" : "min-w-0"}>
      <span className="mb-1 block truncate text-xs font-black text-slate-600">{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-sm font-bold outline-none focus:border-orange-400" />
    </label>
  );
}

function Pick({ label, options, value, onChange }: { label: string; options: string[]; value?: string; onChange?: (value: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block truncate text-xs font-black text-slate-600">{label}</span>
      <select value={value ?? options[0]} onChange={(event) => onChange?.(event.target.value)} className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-sm font-bold outline-none focus:border-orange-400">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-2"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

function PreviewModal({
  project,
  flight,
  release,
  visibility,
  evidenceCount,
  evidenceFiles,
  stats,
  predictedAltitudeM,
  onClose,
}: {
  project: ProjectFormState;
  flight: FlightFormState;
  release: ReleaseFormState;
  visibility: string;
  evidenceCount: number;
  evidenceFiles: PersistentFileRecord[];
  stats: { totalLength: number; totalMass: number; cg: number; cp: number; stability: string };
  predictedAltitudeM: number;
  onClose: () => void;
}) {
  const title = project.title.trim() || "Untitled Rocket Project";
  const motorClass = flight.motorClass.trim() || project.motorClass.trim() || flight.motorDesignation.trim() || "Unspecified solid motor";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-600">Publish preview</p>
            <h3 className="mt-1 text-2xl font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">{project.description || "No description added yet."}</p>
            {project.highlights ? <p className="mt-2 text-sm font-black text-slate-800">{project.highlights}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Info title="Visibility" value={visibility === "public" ? "Public archive" : visibility === "unlisted" ? "Unlisted" : "Private"} />
          <Info title="Motor" value={motorClass} />
          <Info title="Predicted apogee" value={`${predictedAltitudeM} m`} />
          <Info title="Evidence" value={`${evidenceCount} files / ${evidenceFiles.filter((file) => file.publicUrl).length} cloud`} />
          <Info title="Length" value={`${stats.totalLength} mm`} />
          <Info title="Dry mass" value={`${stats.totalMass} g`} />
          <Info title="CG / CP" value={`${stats.cg} / ${stats.cp} mm`} />
          <Info title="Stability" value={`${stats.stability} cal`} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Release</p>
            <p className="mt-2 text-sm font-bold text-slate-800">{release.usageRights} / {release.forkPolicy}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{release.dataAccess} / {release.reviewState}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Source</p>
            <p className="mt-2 break-all text-sm font-bold text-slate-800">{project.referenceUrl || "No public reference URL attached."}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{project.publishGoal} / {release.articleRequest}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">Close preview</Button>
        </div>
      </div>
    </div>
  );
}

function SafetyModal({ onClose, onConfirm, publishing }: { onClose: () => void; onConfirm: () => void; publishing: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-600">Safety gate</p><h3 className="mt-1 text-2xl font-black">Confirm lawful educational use</h3></div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3 text-sm font-semibold leading-relaxed text-slate-700">
          <p>Rocketry House stores designs, simulation context, and evidence for lawful rocketry, education, and engineering documentation.</p>
          <p>Do not upload harmful payload workflows, weaponization content, targeting systems, or hazardous manufacturing instructions.</p>
          <p>Users remain responsible for local laws, launch rules, club rules, and safety codes.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={publishing} className="rounded-xl">Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={publishing} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">{publishing ? "Publishing..." : "I understand, publish"}</Button>
        </div>
      </div>
    </div>
  );
}
