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
import { Button } from "@/components/ui/button";
import { savePersistentRecord } from "@/lib/cloud-persistence";
import { STANDARD_LIMITS } from "@/lib/usage-limits";

type Step = { title: string; label: string; Icon: LucideIcon };
type CadPart = { id: string; name: string; type: string; length: number; diameter: number; mass: number; position: number };

const steps: Step[] = [
  { title: "Project", label: "Identity", Icon: FileText },
  { title: "CAD", label: "Web model", Icon: Grid3X3 },
  { title: "Flight", label: "Motor data", Icon: Calculator },
  { title: "Evidence", label: "Proof files", Icon: UploadCloud },
  { title: "Release", label: "License", Icon: BadgeCheck },
];

const initialParts: CadPart[] = [
  { id: "nose", name: "Ogive nose cone", type: "nose", length: 210, diameter: 70, mass: 180, position: 0 },
  { id: "payload", name: "Avionics bay", type: "payload", length: 180, diameter: 70, mass: 320, position: 210 },
  { id: "body", name: "Main airframe", type: "body", length: 620, diameter: 70, mass: 560, position: 390 },
  { id: "recovery", name: "Recovery bay", type: "recovery", length: 150, diameter: 70, mass: 220, position: 640 },
  { id: "motor", name: "29 mm motor mount", type: "motor", length: 280, diameter: 29, mass: 180, position: 780 },
  { id: "fins", name: "Freeform fin set", type: "fins", length: 170, diameter: 70, mass: 260, position: 870 },
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
  const [selectedId, setSelectedId] = useState("body");
  const [status, setStatus] = useState("Draft is local until cloud sync is available.");
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, string[]>>({});

  const selected = parts.find((part) => part.id === selectedId) ?? parts[0];
  const totalLength = Math.max(...parts.map((part) => part.position + part.length));
  const totalMass = parts.reduce((sum, part) => sum + part.mass, 0);
  const cg = Math.round(parts.reduce((sum, part) => sum + (part.position + part.length / 2) * part.mass, 0) / totalMass);
  const cp = Math.round(totalLength * 0.74);
  const stability = ((cp - cg) / 70).toFixed(2);

  const payload = useMemo(
    () => ({
      version: "upload-workspace-v3",
      updatedAt: new Date().toISOString(),
      activeStep: active + 1,
      cad: { parts, totalLength, totalMass, cg, cp, stability },
      evidence: files,
    }),
    [active, cg, cp, files, parts, stability, totalLength, totalMass],
  );

  async function saveDraft() {
    const result = await savePersistentRecord("upload-drafts", "active-upload-draft", payload);
    setStatus(result.error ? `Saved locally. Cloud sync needs sign-in.` : result.cloud ? "Saved upload draft to Supabase." : "Saved upload draft locally.");
  }

  async function publishProject() {
    const result = await savePersistentRecord("projects", `upload-project-${Date.now()}`, {
      ...payload,
      visibility: "private",
      verificationStatus: "Design uploaded",
      publishedAt: new Date().toISOString(),
    });
    setStatus(result.error ? "Published locally. Cloud sync needs sign-in." : result.cloud ? "Project package published to Supabase." : "Project package published locally.");
    setSafetyOpen(false);
  }

  function updatePart(field: keyof Pick<CadPart, "length" | "diameter" | "mass" | "position">, value: string) {
    const numeric = Number(value);
    setParts((current) => current.map((part) => (part.id === selected.id ? { ...part, [field]: Number.isFinite(numeric) ? numeric : 0 } : part)));
  }

  return (
    <main className="mt-16 grid h-[calc(100dvh-4rem)] place-items-center overflow-hidden bg-[#f4f1ea] p-3 text-slate-950">
      <div className="flex h-[min(700px,calc(100dvh-5rem))] w-[min(100%,980px)] flex-col gap-2 rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-sm">
        <header className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Publish workspace</p>
              <h1 className="text-[1.35rem] font-black leading-tight tracking-tight">Upload a rocket project</h1>
              <p className="mt-0.5 max-w-xl text-xs font-semibold text-slate-600">
                A compact release flow for project metadata, editable Web CAD, flight context, proof files, licensing, and public archive readiness.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" className="rounded-xl border-amber-300 bg-amber-50 text-amber-800">Sign in</Button>
              <Button size="sm" className="rounded-xl bg-orange-500 text-slate-950 hover:bg-orange-400"><Rocket className="mr-1 h-4 w-4" />Builder</Button>
            </div>
          </div>
          <nav className="mt-2 grid grid-cols-5 gap-1">
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

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-1.5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Step {active + 1} of 5</p>
              <h2 className="text-base font-black">{steps[active].title} / {steps[active].label}</h2>
            </div>
            <StepControls active={active} setActive={setActive} />
          </div>

          <div className="min-h-0 flex-1 p-2">
            {active === 0 && <ProjectStep />}
            {active === 1 && (
              <CadStep
                parts={parts}
                selected={selected}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                updatePart={updatePart}
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
            <StepControls active={active} setActive={setActive} compact />
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
      <div className="grid grid-cols-4 gap-1.5">
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
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Info title="Standard plan" value={`${projectLimit} projects included`} />
        <Info title="Cloud source of truth" value="Project records sync to Supabase after sign-in." />
        <Info title="Article coverage" value="Available by request for completed projects, launches, events, or competitions." />
      </div>
    </Panel>
  );
}

function CadStep({
  parts,
  selected,
  selectedId,
  setSelectedId,
  updatePart,
  stats,
}: {
  parts: CadPart[];
  selected: CadPart;
  selectedId: string;
  setSelectedId: (id: string) => void;
  updatePart: (field: keyof Pick<CadPart, "length" | "diameter" | "mass" | "position">, value: string) => void;
  stats: { totalLength: number; totalMass: number; cg: number; cp: number; stability: string };
}) {
  return (
    <Panel Icon={Grid3X3} title="Canonical Web CAD" detail="The editable web model stays canonical; imported files remain evidence attachments.">
      <div className="grid min-h-0 grid-cols-[1fr_255px] gap-2">
        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-1.5">
          <div className="grid grid-cols-4 gap-1.5">
            <Metric label="Length" value={`${stats.totalLength} mm`} />
            <Metric label="Dry mass" value={`${stats.totalMass} g`} />
            <Metric label="CG / CP" value={`${stats.cg} / ${stats.cp} mm`} />
            <Metric label="Stability" value={`${stats.stability} cal`} />
          </div>
          <div className="grid min-h-[270px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1">
            <RocketDrawing parts={parts} selectedId={selectedId} cg={stats.cg} cp={stats.cp} />
          </div>
        </div>
        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-1.5">
          <div className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Component tree</p>
            <div className="mt-1.5 space-y-1">
              {parts.map((part) => (
                <button key={part.id} type="button" onClick={() => setSelectedId(part.id)} className={`w-full rounded-xl border px-2 py-1.5 text-left ${part.id === selectedId ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
                  <p className="truncate text-[13px] font-black">{part.name}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{part.type} / {part.length} mm / {part.mass} g</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Selected component</p>
            <p className="mt-1 truncate text-base font-black">{selected.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Field label="Length" value={selected.length} onChange={(v) => updatePart("length", v)} />
              <Field label="Diameter" value={selected.diameter} onChange={(v) => updatePart("diameter", v)} />
              <Field label="Mass" value={selected.mass} onChange={(v) => updatePart("mass", v)} />
              <Field label="Position" value={selected.position} onChange={(v) => updatePart("position", v)} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FlightStep() {
  return (
    <Panel Icon={Calculator} title="Motor and flight analysis" detail="Attach non-hazardous motor metadata, thrust curve source, and trajectory results.">
      <div className="grid grid-cols-4 gap-1.5">
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
      <div className="mt-2 grid grid-cols-3 gap-1.5">
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
      <div className="grid grid-cols-3 gap-1.5">
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
      <div className="grid grid-cols-4 gap-1.5">
        <Pick label="Release type" options={["Private archive", "Public project", "Unlisted reference"]} />
        <Pick label="License" options={["Educational reference", "Creative Commons", "Team permission required", "Custom"]} />
        <Pick label="Fork policy" options={["Allow attributed forks", "Team approval required", "No public forks"]} />
        <Pick label="Data access" options={["Summary only", "Files visible", "Telemetry visible", "Full evidence package"]} />
        <Pick label="Article request" options={["Not requested", "Request coverage", "Coverage already published"]} />
        <Field label="Contact email" placeholder="rocketryhouse@gmail.com" />
        <Field label="Citation / DOI" placeholder="Optional public citation" />
        <Pick label="Review state" options={["Draft", "Ready for review", "Publish after safety gate"]} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Info title="Attribution" value="Forked projects retain lineage and original credit." />
        <Info title="Article coverage" value="Available by request for completed projects, launches, events, or competitions." />
        <Info title="Moderation" value="Reports and safety status attach to the project." />
      </div>
    </Panel>
  );
}

function Panel({ Icon, title, detail, children }: { Icon: LucideIcon; title: string; detail: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5">
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

function RocketDrawing({ parts, selectedId, cg, cp }: { parts: CadPart[]; selectedId: string; cg: number; cp: number }) {
  const total = Math.max(...parts.map((part) => part.position + part.length));
  const scale = 800 / total;
  const x = (value: number) => 48 + value * scale;
  const selected = parts.find((part) => part.id === selectedId);
  return (
    <svg viewBox="0 0 900 290" className="h-full max-h-[285px] min-h-[235px] w-full" role="img" aria-label="Inline web CAD rocket preview">
      <rect width="900" height="290" rx="18" fill="#f8fafc" />
      <line x1="38" y1="150" x2="860" y2="150" stroke="#cbd5e1" strokeDasharray="6 7" />
      {Array.from({ length: 9 }).map((_, i) => <g key={i}><line x1={48 + i * 92} y1="42" x2={48 + i * 92} y2="78" stroke="#64748b" /><text x={48 + i * 92} y="31" textAnchor="middle" fontSize="12" fontWeight="800" fill="#64748b">{Math.round((i * 92) / scale / 10)}</text></g>)}
      <path d={`M ${x(0)} 150 C ${x(62)} 95, ${x(140)} 92, ${x(210)} 112 L ${x(210)} 188 C ${x(140)} 208, ${x(62)} 205, ${x(0)} 150 Z`} fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
      {parts.filter((p) => !["nose", "fins"].includes(p.id)).map((part) => (
        <rect key={part.id} x={x(part.position)} y={part.type === "motor" ? 134 : 112} width={Math.max(12, part.length * scale)} height={part.type === "motor" ? 34 : 76} rx={part.type === "payload" ? 8 : 2} fill={part.id === selectedId ? "#fed7aa" : part.type === "motor" ? "#fbbf24" : "#fef3c7"} stroke={part.id === selectedId ? "#f97316" : "#2563eb"} strokeWidth="2" />
      ))}
      <path d={`M ${x(870)} 112 L ${x(1030)} 46 L ${x(1110)} 46 L ${x(985)} 112 Z`} fill="#7dd3fc" stroke="#0284c7" strokeWidth={selectedId === "fins" ? 4 : 2} />
      <path d={`M ${x(870)} 188 L ${x(1030)} 254 L ${x(1110)} 254 L ${x(985)} 188 Z`} fill="#38bdf8" stroke="#0284c7" strokeWidth={selectedId === "fins" ? 4 : 2} />
      <circle cx={x(cg)} cy="150" r="7" fill="#2563eb" /><text x={x(cg) + 10} y="142" fontSize="12" fontWeight="800" fill="#2563eb">CG</text>
      <circle cx={x(cp)} cy="150" r="7" fill="#ef4444" /><text x={x(cp) + 10} y="170" fontSize="12" fontWeight="800" fill="#ef4444">CP</text>
      {selected ? <rect x={x(selected.position)} y="95" width={Math.max(12, selected.length * scale)} height="110" fill="none" stroke="#f97316" strokeWidth="3" rx="4" /> : null}
      <text x="48" y="268" fontSize="13" fontWeight="800" fill="#2563eb">Length {total} mm / selected component highlighted orange</text>
    </svg>
  );
}
