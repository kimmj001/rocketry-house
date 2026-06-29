"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import { Button } from "@/components/ui/button";
import { totalLength as calculateRocketLength } from "@/lib/cad/geometry";
import { savePersistentRecord } from "@/lib/cloud-persistence";
import { runRocketEstimateWithMotor } from "@/lib/rocket-simulation";
import type { RocketComponent, RocketComponentType } from "@/lib/types";
import { STANDARD_LIMITS } from "@/lib/usage-limits";

type Step = { title: string; label: string; Icon: LucideIcon };

const steps: Step[] = [
  { title: "Project", label: "Identity", Icon: FileText },
  { title: "CAD", label: "Web model", Icon: Grid3X3 },
  { title: "Flight", label: "Motor data", Icon: Calculator },
  { title: "Evidence", label: "Proof files", Icon: UploadCloud },
  { title: "Release", label: "License", Icon: BadgeCheck },
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

const evidence = [
  "CAD: .ork, STEP, STL, JSON",
  "Simulation: RASP, ENG, CSV",
  "Telemetry: CSV, JSON, TXT",
  "Media proof: images, video links",
  "Inspection: failure notes, photos",
  "Build package: BOM, guide, drawings",
];

export default function UploadPage() {
  const [active, setActive] = useState(0);
  const [parts, setParts] = useState(initialParts);
  const [selectedId, setSelectedId] = useState("upload-body");
  const [status, setStatus] = useState("Draft is local until cloud sync is available.");
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, string[]>>({});

  const selected = parts.find((part) => part.id === selectedId) ?? parts[0];
  const simulationResult = useMemo(() => runRocketEstimateWithMotor(parts, undefined, { windSpeedMps: 0 }), [parts]);
  const totalLength = Math.round(calculateRocketLength(parts));
  const totalMass = parts.reduce((sum, part) => sum + part.mass, 0);
  const cg = Math.round(simulationResult.cgMm);
  const cp = Math.round(simulationResult.cpMm);
  const stability = simulationResult.stabilityMargin.toFixed(2);

  const payload = useMemo(
    () => ({
      version: "upload-workspace-v3",
      updatedAt: new Date().toISOString(),
      activeStep: active + 1,
      cad: { components: parts, totalLength, totalMass, cg, cp, stability, simulationResult },
      evidence: files,
    }),
    [active, cg, cp, files, parts, simulationResult, stability, totalLength, totalMass],
  );

  async function saveDraft() {
    const result = await savePersistentRecord("upload-drafts", "active-upload-draft", payload);
    setStatus(result.error ? `Saved locally. Cloud sync needs sign-in.` : result.cloud ? "Saved upload draft to Supabase." : "Saved upload draft locally.");
  }

  async function publishProject() {
    const now = new Date().toISOString();
    const projectKey = `upload-project-${Date.now()}`;
    const evidenceFileCount = Object.values(files).reduce((sum, names) => sum + names.length, 0);
    const projectPackage = {
      ...payload,
      id: projectKey,
      slug: projectKey,
      name: "Uploaded Rocket Project",
      title: "Uploaded Rocket Project",
      status: "published",
      source: "upload-workspace",
      visibility: "private",
      verificationStatus: "Design uploaded",
      summary: {
        predictedAltitudeM: Math.round(simulationResult.predictedAltitudeM ?? 0),
        motorClass: "Unspecified solid motor",
        propellantFamily: "Solid rocket motor",
        evidenceFileCount,
        lengthMm: totalLength,
        dryMassG: totalMass,
        cgMm: cg,
        cpMm: cp,
        stabilityMargin: Number(stability),
      },
      publishedAt: now,
      updatedAt: now,
    };
    const [projectResult, rocketProjectResult] = await Promise.all([
      savePersistentRecord("projects", projectKey, projectPackage),
      savePersistentRecord("rocket_projects", projectKey, projectPackage),
    ]);
    const cloudSynced = projectResult.cloud && rocketProjectResult.cloud;
    const hasError = projectResult.error || rocketProjectResult.error;
    setStatus(hasError ? "Published locally. Sign in is required for cloud archive." : cloudSynced ? "Project package published to your account archive." : "Project package published locally.");
    setSafetyOpen(false);
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
              <Button size="sm" variant="outline" className="rounded-xl border-amber-300 bg-amber-50 text-amber-800" asChild>
                <a href="/auth/sign-in">Sign in</a>
              </Button>
              <Button size="sm" className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400"><Rocket className="mr-1 h-4 w-4" />Builder</Button>
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
            {active === 0 && <ProjectStep />}
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
            {active === 2 && <FlightStep />}
            {active === 3 && <EvidenceStep files={files} setFiles={setFiles} />}
            {active === 4 && <ReleaseStep />}
          </div>
        </section>

        <footer className="flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          <span className="truncate">{status} Contact: rocketryhouse@gmail.com</span>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" onClick={saveDraft} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">Save</Button>
            <Button type="button" variant="outline" className="rounded-xl">Preview</Button>
            <Button type="button" onClick={() => setSafetyOpen(true)} className="rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-200">Publish</Button>
          </div>
        </footer>
      </div>

      {safetyOpen ? <SafetyModal onClose={() => setSafetyOpen(false)} onConfirm={publishProject} /> : null}
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

function ProjectStep() {
  const projectLimit = STANDARD_LIMITS.personal.projectsCreatedCount;
  return (
    <Panel Icon={FileText} title="Project identity" detail="Name the repository, ownership, category, and publish goal.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Project title" placeholder="Scout F-style TVC test rocket" wide />
        <Field label="Owner account" placeholder="Personal, team, or organization" />
        <Pick label="Visibility" options={["Private project", "Public project", "Unlisted reference"]} />
        <Pick label="Difficulty" options={["Beginner", "Intermediate", "Advanced", "High power"]} />
        <Pick label="Solid rocket category" options={["Sport model rocket", "High-power rocket", "Sounding rocket", "Static-fire article"]} />
        <Field label="Motor class" placeholder="H178, J350, custom" />
        <Field label="Reference URL" placeholder="Optional public reference" />
        <Pick label="Publish goal" options={["Share project", "Archive flight record", "Request article coverage"]} />
      </div>
      <textarea className="mt-2 h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400" placeholder="Design goal, assumptions, safety constraints, flight history, and what a fork should preserve." />
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Solid motor data is accepted for simulation and documentation only. Hazardous manufacturing instructions, harmful payload workflows, and weaponization content are not allowed.
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="Standard plan" value={`${projectLimit} projects included`} />
        <Info title="Cloud source of truth" value="Project records sync to Supabase after sign-in." />
        <Info title="Article coverage" value="Request coverage at rocketryhouse@gmail.com." />
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

function FlightStep() {
  return (
    <Panel Icon={Calculator} title="Motor and flight analysis" detail="Attach non-hazardous motor metadata, thrust curve source, and trajectory results.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Pick label="Propellant / fuel family" options={["Commercial certified motor", "Published performance only", "KNSB metadata", "Custom private metadata"]} />
        <Pick label="Grain geometry" options={["Unknown / not published", "Hollow cylinder", "BATES", "Finocyl", "Moon burner", "C-slot", "Other"]} />
        <Pick label="Motor evidence source" options={["Manufacturer thrust curve", "Measured static-fire CSV", "Educational simulation estimate", "No motor attached"]} />
        <Pick label="Disclosure level" options={["Public performance metadata", "Private team record", "Internal review only"]} />
        <Field label="Motor designation" placeholder="H178, J350, custom" />
        <Field label="Motor class" placeholder="F, G, H, I, J..." />
        <Field label="Case diameter" placeholder="29 / 38 / 54 mm" />
        <Field label="Total impulse" placeholder="N-s, if known" />
        <Field label="Avg / peak thrust" placeholder="N / N" />
        <Field label="Burn time" placeholder="seconds" />
        <Field label="Predicted apogee" placeholder="820 m" />
        <Field label="Measured apogee" placeholder="Optional" />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="CG / CP" value="Imported from CAD" />
        <Info title="Thrust curve" value="Saved motor or uploaded CSV" />
        <Info title="Graphs" value="Altitude, velocity, acceleration" />
      </div>
    </Panel>
  );
}

function EvidenceStep({ files, setFiles }: { files: Record<string, string[]>; setFiles: (files: Record<string, string[]>) => void }) {
  return (
    <Panel Icon={UploadCloud} title="Evidence files" detail="Each proof type is optional and separated for review clarity.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
        {evidence.map((item) => (
          <label key={item} className="rounded-2xl border border-dashed border-slate-300 bg-white p-2">
            <p className="text-sm font-black">{item.split(":")[0]}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.split(":")[1]}</p>
            <input
              className="mt-2 w-full text-xs font-semibold"
              type="file"
              multiple
              onChange={(event) => setFiles({ ...files, [item]: Array.from(event.target.files ?? []).map((file) => file.name) })}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}

function ReleaseStep() {
  return (
    <Panel Icon={BadgeCheck} title="License and release" detail="Choose access, attribution, review state, and article request status before publishing.">
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        <Pick label="Release type" options={["Private archive", "Public project", "Unlisted reference"]} />
        <Pick label="License" options={["Educational reference", "Creative Commons", "Team permission required", "Custom"]} />
        <Pick label="Fork policy" options={["Allow attributed forks", "Team approval required", "No public forks"]} />
        <Pick label="Data access" options={["Summary only", "Files visible", "Telemetry visible", "Full evidence package"]} />
        <Pick label="Article request" options={["Not requested", "Request coverage", "Coverage already published"]} />
        <Field label="Contact email" placeholder="rocketryhouse@gmail.com" />
        <Field label="Citation / DOI" placeholder="Optional public citation" />
        <Pick label="Review state" options={["Draft", "Ready for review", "Publish after safety gate"]} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <Info title="Attribution" value="Forked projects retain lineage and original credit." />
        <Info title="Article coverage" value="Available by request for completed projects, launches, events, or competitions." />
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
    <label className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <span className="mb-1 block truncate text-xs font-black text-slate-600">{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-sm font-bold outline-none focus:border-orange-400" />
    </label>
  );
}

function Pick({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block truncate text-xs font-black text-slate-600">{label}</span>
      <select className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-sm font-bold outline-none focus:border-orange-400">
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

function SafetyModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
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
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button type="button" onClick={onConfirm} className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400">I understand, publish</Button>
        </div>
      </div>
    </div>
  );
}
