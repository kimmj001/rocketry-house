"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Boxes, Calculator, CheckCircle2, ChevronRight, CircleDollarSign, FileArchive, FileText, Image, Lock, Rocket, ShieldCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FileUploadBox } from "@/components/file-upload-box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadPersistentRecords, savePersistentRecord } from "@/lib/cloud-persistence";
import { uploadEvidenceChecklist } from "@/lib/engineering-insights";

const publishSteps = [
  ["Project", "Project identity", "project-identity"],
  ["CAD", "Canonical web model", "canonical-cad"],
  ["Flight", "Motor and trajectory analysis", "simulation-package"],
  ["Evidence", "Files and verification", "file-uploads"],
  ["Market", "License and pricing", "marketplace-licensing"]
];

const cadComponents = [
  "Nose cone",
  "Transition",
  "Payload / avionics bay",
  "Main airframe",
  "Tube coupler",
  "Recovery bay",
  "Parachute",
  "Shock cord",
  "Wadding",
  "Motor mount",
  "Centering rings",
  "Engine block",
  "Fin set",
  "Rail buttons / launch lug",
  "Aft retention"
];

const openRocketStyleComponentDetails = [
  ["Nose cone", ["Shape", "Shape parameter", "Base diameter", "Shoulder length", "Wall thickness", "Filled / hollow"]],
  ["Body tube", ["Length", "Outer diameter", "Inner diameter", "Wall thickness", "Material", "Finish"]],
  ["Transition", ["Shape", "Fore diameter", "Aft diameter", "Length", "Shoulder data", "Wall thickness"]],
  ["Fin set", ["Planform type", "Fin count", "Root chord", "Tip chord", "Span", "Sweep", "Cant", "Rotation", "Cross-section", "Fillet radius"]],
  ["Inner components", ["Motor mount tube", "Tube coupler", "Centering rings", "Bulkhead", "Engine block", "Retainer"]],
  ["Recovery", ["Parachute", "Shock cord", "Wadding", "Recovery bay volume", "Deployment event", "Descent evidence"]]
] as const;

const viewAndConfigMetadata = [
  "Stage / sustainer selection",
  "Flight configuration name",
  "Show CG/CP enabled",
  "Side view / 3D figure preview",
  "Scale or ruler reference",
  "Mass with and without motor",
  "Stability margin",
  "Selected motor link"
] as const;

const solidRocketKinds = [
  "Sport model rocket",
  "Mid-power rocket",
  "High-power certification rocket",
  "Student sounding rocket",
  "Scale / replica rocket",
  "Guidance or avionics testbed",
  "Static-fire / motor dataset",
  "Failure analysis archive"
] as const;

const propellantFamilies = [
  "Commercial certified motor",
  "Black powder model motor",
  "KNSB sorbitol family metadata",
  "KNDX dextrose family metadata",
  "Composite APCP family",
  "Sugar propellant family",
  "Student-developed solid propellant",
  "Research / unknown formulation",
  "Static-fire dataset only",
  "Undisclosed for safety"
] as const;

const grainGeometries = [
  "Unknown / not published",
  "BATES",
  "End burner",
  "Hollow cylinder / core burner",
  "Moon burner",
  "C-slot",
  "Finocyl",
  "Rod and tube",
  "Star / multi-port",
  "Measured thrust curve only"
] as const;

const surfaceStates = [
  "Unknown",
  "Exposed",
  "Inhibited",
  "Mixed / partial",
  "Not applicable"
] as const;

const motorDisclosureLevels = [
  "Public performance metadata only",
  "Public geometry summary",
  "Private full motor record",
  "Marketplace buyers only",
  "Team-only internal record"
] as const;

const motorEvidenceSources = [
  "Manufacturer thrust curve",
  "Saved Rocketry House motor simulation",
  "Uploaded measured thrust CSV",
  "Static-fire report",
  "Flight-derived estimate",
  "Unknown / not disclosed"
] as const;

const projectInfoGroups = [
  ["Airframe", "tube material, couplers, bulkheads, finish, rail guide", ["Body tube material", "Coupler length", "Bulkhead material", "Rail guide type"]],
  ["Recovery", "parachutes, shock cord, deployment method, descent target", ["Recovery mode", "Main chute", "Drogue / streamer", "Deployment altitude"]],
  ["Avionics", "altimeter, GPS, IMU, telemetry, event channels", ["Flight computer", "Altimeter", "Telemetry link", "Power source"]],
  ["Operations", "launch rail, site condition, weather, safety status", ["Launch guide", "Launch angle", "Wind estimate", "Safety review state"]]
] as const;

const proofUploadBuckets = [
  {
    title: "CAD source and interchange",
    description: "Editable Web CAD remains canonical. Attach OpenRocket-compatible files or interchange exports as supporting artifacts.",
    formats: ".ork, .ork-like XML, Rocketry House JSON, STEP, STL, ZIP",
    status: "recommended" as const
  },
  {
    title: "Component tree export",
    description: "Attach the rocket component hierarchy, stage structure, CG/CP annotations, and configuration metadata separately from raw CAD files.",
    formats: "Rocketry House JSON, .ork XML, CSV component list",
    status: "recommended" as const
  },
  {
    title: "Simulation report",
    description: "Attach generated graphs, assumptions, CG/CP report, drag estimate, motor selection, and predicted flight outputs.",
    formats: "PDF, JSON, CSV, PNG graph exports",
    status: "recommended" as const
  },
  {
    title: "Measured thrust / static-fire data",
    description: "For solid motors or motor datasets, upload measured thrust curves and pressure traces when available.",
    formats: "CSV, JSON, TXT, thrust-time table, pressure-time table",
    status: "optional" as const
  },
  {
    title: "RASP / motor curve files",
    description: "Attach exported motor files separately so rocket simulation tools can import thrust curves without reading the full project package.",
    formats: ".eng, .rse, RASP export, thrust curve CSV",
    status: "optional" as const
  },
  {
    title: "Nozzle and chamber analysis",
    description: "Attach safe analysis diagrams, nozzle expansion notes, pressure summaries, and non-manufacturing geometry reports.",
    formats: "PDF, PNG, JSON, CSV summary",
    status: "optional" as const
  },
  {
    title: "Telemetry and altimeter logs",
    description: "Upload messy real-world flight logs. Columns can be mapped later if automatic detection is incomplete.",
    formats: "CSV, JSON, TXT, GPS logs, altimeter exports",
    status: "optional" as const
  },
  {
    title: "Flight media proof",
    description: "Photos or videos support flight claims. Keep this separate from raw telemetry so verification is easier.",
    formats: "JPG, PNG, MP4 link, YouTube/Vimeo link",
    status: "optional" as const
  },
  {
    title: "Post-flight inspection",
    description: "Recovery photos, damage evidence, deployment state, nozzle condition, fin condition, and failure notes.",
    formats: "Images, PDF notes, ZIP inspection pack",
    status: "optional" as const
  },
  {
    title: "Build guide and BOM",
    description: "Share materials, parts list, assembly notes, and non-hazardous educational build documentation.",
    formats: "PDF, Markdown, TXT, CSV BOM, images",
    status: "optional" as const
  },
  {
    title: "Marketplace package",
    description: "Paid downloads, manufacturing exports, license text, release notes, and preview-safe sample files.",
    formats: "ZIP, PDF, STL, STEP, license TXT",
    status: "optional" as const
  }
] as const;

const acceptedFiles = [
  [FileText, "Design and docs", ".ork, XML, JSON, PDF, TXT"],
  [FileArchive, "Manufacturing package", "STL, STEP, ZIP, BOM CSV"],
  [Calculator, "Measured data", "CSV, JSON, thrust, telemetry"],
  [Image, "Flight proof", "photos, video links, inspection images"]
] satisfies Array<[LucideIcon, string, string]>;

type UploadCadComponent = {
  id: string;
  type: "nose" | "body" | "payload" | "recovery" | "motor" | "fins" | "rail";
  name: string;
  length: number;
  diameter: number;
  mass: number;
  position: number;
  rootChord?: number;
  tipChord?: number;
  span?: number;
  sweep?: number;
  count?: number;
};

type UploadProjectDraft = {
  schema: string;
  id: string;
  updatedAt: string;
  formValues: Record<string, string>;
  fileBuckets: Record<string, string[]>;
};

const initialUploadCadComponents: UploadCadComponent[] = [
  { id: "nose", type: "nose", name: "Ogive nose cone", length: 210, diameter: 70, mass: 180, position: 0 },
  { id: "payload", type: "payload", name: "Avionics payload bay", length: 180, diameter: 70, mass: 320, position: 210 },
  { id: "body", type: "body", name: "Main airframe", length: 620, diameter: 70, mass: 560, position: 390 },
  { id: "recovery", type: "recovery", name: "Recovery bay", length: 150, diameter: 66, mass: 220, position: 450 },
  { id: "motor", type: "motor", name: "29 mm motor mount", length: 280, diameter: 29, mass: 180, position: 830 },
  { id: "fins", type: "fins", name: "Trapezoidal fin set", length: 170, diameter: 70, mass: 260, position: 900, rootChord: 170, tipChord: 80, span: 92, sweep: 55, count: 4 },
  { id: "rail", type: "rail", name: "Rail buttons", length: 28, diameter: 8, mass: 24, position: 560 }
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rocket-project";
}

function collectUploadFormValues() {
  if (typeof document === "undefined") return {};
  const values: Record<string, string> = {};

  document.querySelectorAll("label").forEach((label) => {
    const control = label.querySelector("input, select, textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!control) return;
    const labelText = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    const key = labelText || control.getAttribute("placeholder") || control.id || control.name;
    if (!key) return;
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      values[key] = control.checked ? "checked" : "";
      return;
    }
    values[key] = control.value;
  });

  document.querySelectorAll("textarea").forEach((textarea, index) => {
    if (!textarea.closest("label")) values[`Notes ${index + 1}`] = textarea.value;
  });

  return values;
}

export default function UploadPage() {
  const [filesByBucket, setFilesByBucket] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState("Draft not saved yet.");
  const [activeStep, setActiveStep] = useState("Project");
  const uploadedCount = Object.values(filesByBucket).reduce((total, files) => total + files.length, 0);

  useEffect(() => {
    void loadPersistentRecords<UploadProjectDraft>("upload_drafts").then((records) => {
      const latest = records[0]?.payload;
      if (!latest) return;
      setFilesByBucket(latest.fileBuckets ?? {});
      setStatus(`Loaded saved upload draft from ${new Date(latest.updatedAt).toLocaleString()}.`);
    });
  }, []);

  function rememberFiles(title: string, files: File[]) {
    setFilesByBucket((current) => ({ ...current, [title]: files.map((file) => file.name) }));
    setStatus(`${title}: ${files.length} file${files.length === 1 ? "" : "s"} attached.`);
  }

  async function saveDraft() {
    const formValues = collectUploadFormValues();
    const draft = {
      schema: "rocketry-house-upload-draft-v1",
      id: "current-project",
      updatedAt: new Date().toISOString(),
      formValues,
      fileBuckets: filesByBucket
    };
    localStorage.setItem("rocketry-house.upload-draft", JSON.stringify(draft));
    setStatus("Saving project draft...");
    const [draftResult, projectResult] = await Promise.all([
      savePersistentRecord("upload_drafts", "current-project", draft),
      savePersistentRecord("rocket_projects", "upload-current-project", {
        ...draft,
        source: "upload",
        name: formValues["Project title"] || "Untitled upload project",
        summary: {
          category: formValues["Solid rocket category"],
          motorClass: formValues["Motor class"],
          propellantFamily: formValues["Propellant / fuel family"],
          grainGeometry: formValues["Grain geometry"],
          listingType: formValues["Listing type"],
          evidenceBucketCount: Object.keys(filesByBucket).length,
          evidenceFileCount: uploadedCount
        }
      })
    ]);
    setStatus(draftResult.cloud && projectResult.cloud ? "Project draft saved to Supabase and account project archive." : "Project draft saved locally. Cloud sync needs Supabase availability.");
  }

  function runSafetyReview() {
    const warnings = uploadedCount === 0 ? " Attach evidence files before claiming verification." : "";
    setStatus(`Safety review complete: no weaponization or prohibited-payload fields are requested.${warnings}`);
  }

  function previewListing() {
    setStatus(`Preview ready with ${uploadedCount} attached file${uploadedCount === 1 ? "" : "s"} across ${Object.keys(filesByBucket).length} evidence bucket${Object.keys(filesByBucket).length === 1 ? "" : "s"}.`);
  }

  async function publishProject() {
    const formValues = collectUploadFormValues();
    const title = formValues["Project title"] || "Untitled rocket project";
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;
    const project = {
      schema: "rocketry-house-published-project-v1",
      id: slug,
      slug,
      source: "upload",
      name: title,
      status: "published",
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      formValues,
      fileBuckets: filesByBucket,
      summary: {
        category: formValues["Solid rocket category"],
        motorClass: formValues["Motor class"],
        propellantFamily: formValues["Propellant / fuel family"],
        grainGeometry: formValues["Grain geometry"],
        listingType: formValues["Listing type"],
        price: formValues["Price"],
        evidenceBucketCount: Object.keys(filesByBucket).length,
        evidenceFileCount: uploadedCount
      }
    };
    setStatus("Publishing project repository to account archive...");
    const result = await savePersistentRecord("rocket_projects", slug, project);
    setStatus(result.cloud ? "Project repository published to Supabase account archive." : "Project repository saved locally. Cloud sync needs Supabase availability.");
  }

  function jumpToStep(label: string, target: string) {
    setActiveStep(label);
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-6 py-24 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Publish workspace</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Package a rocket project for CAD, simulation, evidence, and marketplace release</h1>
            <p className="mt-4 max-w-3xl text-slate-600">
              Upload turns a builder workspace into a project repository. The editable Web CAD model stays canonical; files, flight data, media proof, and marketplace settings attach around it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/build/rocket" asChild><Rocket className="h-4 w-4" />Continue from Rocket Builder</Button>
              <Button href="/build/motor" asChild variant="outline"><Calculator className="h-4 w-4" />Attach a saved motor</Button>
            </div>
          </div>

          <Card className="border-slate-200 bg-slate-50 p-5 text-slate-950 shadow-none">
            <h2 className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-5 w-5 text-orange-500" />Publish readiness</h2>
            <div className="mt-4 space-y-3">
              {publishSteps.map(([label, detail, target], index) => (
                <button key={label} onClick={() => jumpToStep(label, target)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${activeStep === label ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-md text-sm font-semibold ${activeStep === label ? "bg-orange-300 text-slate-950" : "bg-orange-100 text-orange-700"}`}>{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className={`text-xs ${activeStep === label ? "text-white/70" : "text-slate-500"}`}>{detail}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <Section id="project-identity" icon={FileText} title="Project identity" description="Name the repository, explain lineage, set visibility, and make the purpose clear before selling or forking.">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Project title" placeholder="Scout F-style TVC test rocket" />
                <InputField label="Owner account" placeholder="Personal, team, or organization account" />
                <SelectField label="Visibility" options={["Private project", "Public free project", "Marketplace listing"]} />
                <SelectField label="Difficulty" options={["Beginner", "Intermediate", "Advanced", "High Power"]} />
                <SelectField label="Solid rocket category" options={[...solidRocketKinds]} />
                <InputField label="Motor class" placeholder="H178, I-class analysis, student solid motor dataset" />
                <InputField label="Public reference URL" placeholder="Optional project, paper, or flight archive link" />
                <SelectField label="Primary publish goal" options={["Share free design", "Sell project package", "Publish flight evidence", "Publish failure analysis", "Publish motor dataset", "Request peer review"]} />
              </div>
              <textarea className="mt-4 min-h-32 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white" placeholder="Design goal, build story, assumptions, safety constraints, flight history, and what a fork should preserve." />
            </Section>

            <Section id="project-details" icon={BadgeCheck} title="Solid rocket project details" description="Different solid rocket projects need different metadata. Fill the parts that apply; unknown values can stay empty until the project matures.">
              <div className="grid gap-4 md:grid-cols-2">
                {projectInfoGroups.map(([title, description, fields]) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {fields.map((field) => (
                        <InputField key={field} label={field} placeholder="Optional" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Solid motor data is accepted for simulation, documentation, and lawful educational analysis. Do not upload propellant manufacturing instructions, explosive recipes, harmful payload workflows, or weaponization content.
              </div>
            </Section>

            <Section id="motor-metadata" icon={Calculator} title="Solid motor and propellant metadata" description="Capture enough motor context for simulation, search, verification, and marketplace trust without collecting hazardous manufacturing instructions.">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Propellant / fuel family" options={[...propellantFamilies]} />
                <SelectField label="Grain geometry" options={[...grainGeometries]} />
                <SelectField label="Motor evidence source" options={[...motorEvidenceSources]} />
                <SelectField label="Motor disclosure level" options={[...motorDisclosureLevels]} />
                <InputField label="Commercial motor designation" placeholder="H178, F15, I205, optional" />
                <InputField label="Estimated motor class" placeholder="F, G, H, I, J..." />
                <InputField label="Motor case outer diameter" placeholder="29 mm, 38 mm, 54 mm..." />
                <InputField label="Combustion chamber diameter" placeholder="Inner diameter, mm if public" />
                <InputField label="Combustion chamber length" placeholder="Bulkhead to throat, mm if public" />
                <InputField label="Throat diameter" placeholder="Optional public analysis value" />
                <InputField label="Nozzle exit diameter" placeholder="Optional public analysis value" />
                <InputField label="Nozzle expansion ratio" placeholder="Optional, e.g. 4.2:1" />
                <InputField label="Grain outer diameter" placeholder="Optional public summary" />
                <InputField label="Grain core diameter" placeholder="Optional public summary" />
                <InputField label="Grain segment length" placeholder="Optional public summary" />
                <InputField label="Number of grain segments" placeholder="Optional public summary" />
                <SelectField label="Core surface" options={[...surfaceStates]} />
                <SelectField label="Outer surface" options={[...surfaceStates]} />
                <SelectField label="End surfaces" options={[...surfaceStates]} />
                <InputField label="Motor loaded mass" placeholder="Optional g" />
                <InputField label="Total impulse" placeholder="N-s, if known" />
                <InputField label="Average / peak thrust" placeholder="N / N, if known" />
                <InputField label="Burn time" placeholder="seconds" />
                <InputField label="Max / average pressure" placeholder="Optional simulation or sensor summary" />
                <InputField label="Nozzle exit velocity" placeholder="Optional Mach estimate" />
                <InputField label="RASP motor file name" placeholder="Optional .eng or .rse reference" />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <MotorDisclosureTile title="Allowed" items={["Propellant family", "Certified motor ID", "Thrust curve", "Impulse class", "Burn time", "Geometry summary"]} />
                <MotorDisclosureTile title="Keep private or omit" items={["Exact formulation", "Manufacturing steps", "Process temperatures", "Tooling instructions", "Hazardous procedures"]} />
                <MotorDisclosureTile title="Good evidence" items={["Static-fire CSV", "RASP/ENG file", "Pressure trace", "Nozzle analysis", "Flight telemetry", "Inspection photos"]} />
              </div>
              <textarea className="mt-5 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white" placeholder="Non-hazardous motor notes: data provenance, certification status, simulation assumptions, measurement hardware, anomalies, and what should remain private." />
            </Section>

            <Section id="canonical-cad" icon={Boxes} title="Canonical Web CAD" description="This is the source of truth for the editable rocket. Imported files are attachments; the marketplace project should still open as a structured web CAD model.">
              <div className="grid gap-4 md:grid-cols-3">
                <InputField label="Overall length" placeholder="1150 mm" />
                <InputField label="Outer diameter" placeholder="70 mm" />
                <InputField label="Dry mass" placeholder="1800 g" />
                <InputField label="Loaded mass" placeholder="With selected motor, g" />
                <InputField label="CG location" placeholder="From nose tip, mm" />
                <InputField label="CP location" placeholder="From nose tip, mm" />
                <InputField label="Stability margin" placeholder="calibers" />
                <InputField label="Stage / sustainer name" placeholder="Sustainer" />
                <InputField label="Flight configuration" placeholder="[C6-5], [H178], custom" />
                <InputField label="Nose length" placeholder="210 mm" />
                <SelectField label="Nose cone shape" options={["Ogive", "Conical", "Elliptical", "Haack", "Parabolic", "Custom"]} />
                <InputField label="Nose shape parameter" placeholder="1.0 for tangent ogive reference" />
                <InputField label="Main airframe" placeholder="620 mm" />
                <InputField label="Body tube inner diameter" placeholder="ID or auto" />
                <InputField label="Body wall thickness" placeholder="mm" />
                <SelectField label="Component material" options={["Cardboard", "Phenolic", "Fiberglass", "Carbon fiber", "PLA/printed", "Plywood", "Custom"]} />
                <InputField label="Motor mount" placeholder="29 mm" />
                <InputField label="Motor mount position" placeholder="From nose tip, mm" />
                <InputField label="Fin root chord" placeholder="160 mm" />
                <InputField label="Fin tip chord" placeholder="76 mm" />
                <InputField label="Fin span" placeholder="80 mm" />
                <InputField label="Fin sweep" placeholder="mm" />
                <InputField label="Fin count" placeholder="3 or 4" />
                <InputField label="Fin cant / rotation" placeholder="deg / deg" />
                <SelectField label="Fin cross section" options={["Square", "Rounded", "Airfoil", "Custom"]} />
                <InputField label="Root fillet radius" placeholder="Optional mm" />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {openRocketStyleComponentDetails.map(([title, fields]) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fields.map((field) => <span key={field} className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">{field}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
                <h3 className="flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4 text-cyan-200" />Design view and configuration metadata</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {viewAndConfigMetadata.map((item) => <p key={item} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">{item}</p>)}
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {cadComponents.map((item) => (
                  <label key={item} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <input type="checkbox" defaultChecked className="accent-orange-300" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setStatus(".ork-like XML import is attached through the CAD source upload bucket; choose a file there to keep the Web CAD model canonical.")}><UploadCloud className="h-4 w-4" />Import .ork-like XML</Button>
              </div>
              <EmbeddedUploadCadBuilder />
            </Section>

            <Section id="simulation-package" icon={Calculator} title="Simulation package" description="Seed the rocket simulation from a saved motor, measured data, or a conservative analysis. Label computed values as pre-flight analysis until verified.">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Motor source" options={["Saved motor from account", "Measured thrust CSV", "Marketplace motor dataset", "Pre-flight analysis"]} />
                <InputField label="Selected motor" placeholder="H178 Static-Fire Motor" />
                <InputField label="Predicted apogee" placeholder="820 m" />
                <InputField label="Measured apogee" placeholder="Optional if flown" />
                <InputField label="Launch guide length" placeholder="2.4 m" />
                <InputField label="Drag coefficient" placeholder="0.58" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <StatusTile label="CG / CP" value="Auto from CAD" />
                <StatusTile label="Thrust curve" value="Required for flight sim" />
                <StatusTile label="Graphs" value="Altitude, velocity, acceleration" />
              </div>
            </Section>

            <Section id="file-uploads" icon={UploadCloud} title="Separated file uploads" description="Proof files are optional and should be uploaded by evidence type. This keeps CAD, simulation, telemetry, media proof, inspection evidence, and marketplace packages reviewable.">
              <div className="grid gap-4 md:grid-cols-2">
                {proofUploadBuckets.map((bucket) => (
                  <FileUploadBox key={bucket.title} {...bucket} onFilesSelected={rememberFiles} />
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {acceptedFiles.map(([Icon, title, detail]) => (
                  <div key={title} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <Icon className="h-5 w-5 text-orange-600" />
                    <p className="mt-3 text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-slate-500">{detail}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="marketplace-licensing" icon={CircleDollarSign} title="Marketplace and licensing" description="Free and paid projects both support forking. Paid projects require purchase before fork; forked paid work can include royalty splits.">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Listing type" options={["Free project", "Paid project", "Private project"]} />
                <InputField label="Price" placeholder="$0.00" />
                <SelectField label="License" options={["CC BY-NC 4.0", "CC BY 4.0", "Commercial license", "Custom team license"]} />
                <InputField label="Original creator royalty" placeholder="2%" />
              </div>
              <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                Platform fee is 5%. Fork attribution is retained automatically. Checkout uses a preview purchase flow and the listing model is Stripe-ready.
              </div>
            </Section>
          </div>

          <aside className="space-y-5">
            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-amber-600" />Safety gate</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <PolicyLine text="For educational and lawful rocketry use only." />
                <PolicyLine text="Users are responsible for local laws, launch rules, and safety codes." />
                <PolicyLine text="Do not upload harmful payloads, targeting systems, or weaponization instructions." />
                <PolicyLine text="Projects may be removed if they violate safety or legal policies." />
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="font-semibold">Evidence checklist</h2>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                {uploadEvidenceChecklist.map((item) => (
                  <label key={item} className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
                    <input type="checkbox" className="accent-orange-300" />
                    {item}
                  </label>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="font-semibold">Verification target</h2>
              <div className="mt-4 space-y-3">
                {["Design uploaded", "Simulation analysis", "Media proof", "Telemetry attached", "Static fire data", "Flight verified"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-600">{item}</span>
                    <span className={index < 2 ? "text-orange-700" : "text-slate-400"}>{index < 2 ? "ready" : "optional"}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="font-semibold">Publish actions</h2>
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{status}</p>
              <div className="mt-4 grid gap-3">
                <Button onClick={saveDraft}><CheckCircle2 className="h-4 w-4" />Save project</Button>
                <Button variant="outline" onClick={runSafetyReview}><Lock className="h-4 w-4" />Run safety review</Button>
                <Button variant="outline" onClick={previewListing}>Preview listing<ChevronRight className="h-4 w-4" /></Button>
                <Button onClick={publishProject} className="bg-orange-300 text-[#130d08] hover:bg-orange-200">Publish project repository</Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({ id, icon: Icon, title, description, children }: { id?: string; icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-orange-100 p-2 text-orange-700"><Icon className="h-5 w-5" /></span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function InputField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="text-sm font-medium text-slate-600">
      {label}
      <input className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white" placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="text-sm font-medium text-slate-600">
      {label}
      <select className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none transition focus:border-orange-300 focus:bg-white">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function EmbeddedUploadCadBuilder() {
  const [components, setComponents] = useState(initialUploadCadComponents);
  const [selectedId, setSelectedId] = useState("body");
  const selected = components.find((component) => component.id === selectedId) ?? components[0];
  const totalLength = Math.max(...components.map((component) => component.position + component.length));
  const maxDiameter = Math.max(...components.map((component) => component.diameter));
  const dryMass = components.reduce((sum, component) => sum + component.mass, 0);
  const cg = Math.round(components.reduce((sum, component) => sum + (component.position + component.length / 2) * component.mass, 0) / Math.max(dryMass, 1));
  const cp = Math.round(Math.min(totalLength - maxDiameter * 1.5, cg + maxDiameter * 3.1));
  const stability = ((cp - cg) / Math.max(maxDiameter, 1)).toFixed(2);

  function updateSelected(field: keyof UploadCadComponent, value: string) {
    const numericFields = new Set(["length", "diameter", "mass", "position", "rootChord", "tipChord", "span", "sweep", "count"]);
    setComponents((current) =>
      current.map((component) =>
        component.id === selected.id
          ? {
              ...component,
              [field]: numericFields.has(field) ? Number(value) || 0 : value
            }
          : component
      )
    );
  }

  function addComponent(type: UploadCadComponent["type"]) {
    const label = {
      nose: "Nose cone",
      body: "Body tube",
      payload: "Payload bay",
      recovery: "Recovery bay",
      motor: "Motor mount",
      fins: "Fin set",
      rail: "Rail guide"
    }[type];
    const id = `${type}-${Date.now()}`;
    const next: UploadCadComponent = {
      id,
      type,
      name: label,
      length: type === "rail" ? 30 : type === "fins" ? 160 : 180,
      diameter: type === "motor" ? 29 : type === "rail" ? 8 : 70,
      mass: type === "rail" ? 20 : 160,
      position: Math.max(totalLength - 220, 0),
      ...(type === "fins" ? { rootChord: 160, tipChord: 70, span: 85, sweep: 45, count: 4 } : {})
    };
    setComponents((current) => [...current, next]);
    setSelectedId(id);
  }

  async function exportCadJson() {
    const payload = {
      schema: "rocketry-house-upload-cad-v1",
      id: "upload-inline-cad",
      updatedAt: new Date().toISOString(),
      summary: { totalLength, maxDiameter, dryMass, cg, cp, stability },
      components
    };
    localStorage.setItem("rocketry-house.upload-inline-cad", JSON.stringify(payload, null, 2));
    await Promise.all([
      savePersistentRecord("upload_inline_cad", "current-project", payload),
      savePersistentRecord("rocket_projects", "upload-inline-cad", {
        ...payload,
        source: "upload-inline-cad",
        name: "Inline Web CAD upload project"
      })
    ]);
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Boxes className="h-5 w-5 text-orange-600" />Inline Web CAD builder</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Edit the canonical web model here before attaching files. The drawing, mass, CG, CP, and stability summary update from these values.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["nose", "body", "payload", "recovery", "motor", "fins", "rail"] as const).map((type) => (
            <button key={type} onClick={() => addComponent(type)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-orange-300">
              Add {type}
            </button>
          ))}
          <Button onClick={exportCadJson} variant="outline"><FileText className="h-4 w-4" />Save CAD JSON</Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusTile label="Length" value={`${totalLength} mm`} />
          <StatusTile label="Dry mass" value={`${dryMass} g`} />
          <StatusTile label="CG / CP" value={`${cg} / ${cp} mm`} />
          <StatusTile label="Stability" value={`${stability} cal`} />
        </div>
        <UploadCadDrawing components={components} selectedId={selected.id} totalLength={totalLength} maxDiameter={maxDiameter} cg={cg} cp={cp} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Component tree</p>
          <div className="mt-3 space-y-2">
            {components.map((component) => (
              <button key={component.id} onClick={() => setSelectedId(component.id)} className={`w-full rounded-lg border p-3 text-left transition ${component.id === selected.id ? "border-orange-300 bg-orange-50 text-orange-950" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}>
                <span className="block text-sm font-semibold">{component.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{component.type} · {component.length} mm · {component.mass} g</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected component</p>
          <input value={selected.name} onChange={(event) => updateSelected("name", event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold outline-none focus:border-orange-300" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CadNumberField label="Length" value={selected.length} onChange={(value) => updateSelected("length", value)} />
            <CadNumberField label="Diameter" value={selected.diameter} onChange={(value) => updateSelected("diameter", value)} />
            <CadNumberField label="Mass" value={selected.mass} onChange={(value) => updateSelected("mass", value)} />
            <CadNumberField label="Position" value={selected.position} onChange={(value) => updateSelected("position", value)} />
            {selected.type === "fins" && (
              <>
                <CadNumberField label="Root chord" value={selected.rootChord ?? 0} onChange={(value) => updateSelected("rootChord", value)} />
                <CadNumberField label="Tip chord" value={selected.tipChord ?? 0} onChange={(value) => updateSelected("tipChord", value)} />
                <CadNumberField label="Span" value={selected.span ?? 0} onChange={(value) => updateSelected("span", value)} />
                <CadNumberField label="Sweep" value={selected.sweep ?? 0} onChange={(value) => updateSelected("sweep", value)} />
                <CadNumberField label="Fin count" value={selected.count ?? 0} onChange={(value) => updateSelected("count", value)} />
              </>
            )}
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">This inline builder creates the project’s editable canonical CAD metadata. STEP/STL/.ork files remain evidence attachments below.</p>
        </div>
      </div>
    </div>
  );
}

function UploadCadDrawing({ components, selectedId, totalLength, maxDiameter, cg, cp }: { components: UploadCadComponent[]; selectedId: string; totalLength: number; maxDiameter: number; cg: number; cp: number }) {
  const width = 1280;
  const height = 420;
  const left = 78;
  const center = 220;
  const scale = (width - 160) / Math.max(totalLength, 1);
  const radiusScale = 2.05;

  function x(mm: number) {
    return left + mm * scale;
  }

  function bodyRect(component: UploadCadComponent) {
    const h = Math.max(component.diameter * radiusScale, 10);
    return { x: x(component.position), y: center - h / 2, w: Math.max(component.length * scale, 6), h };
  }

  const nose = components.find((component) => component.type === "nose");
  const bodyLike = components.filter((component) => !["nose", "fins", "rail"].includes(component.type));
  const fins = components.find((component) => component.type === "fins");
  const rails = components.filter((component) => component.type === "rail");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-[420px] w-full rounded-lg border border-slate-200 bg-[#f8fafc]">
      <rect x="20" y="20" width={width - 40} height={height - 40} rx="18" fill="#ffffff" stroke="#e2e8f0" />
      <line x1={left} x2={width - 60} y1={center} y2={center} stroke="#cbd5e1" strokeDasharray="10 10" />
      {Array.from({ length: 11 }).map((_, index) => {
        const tickX = left + index * ((width - 120) / 10);
        const value = Math.round((index / 10) * totalLength / 10);
        return (
          <g key={index}>
            <line x1={tickX} x2={tickX} y1={46} y2={76} stroke="#64748b" strokeWidth={index % 2 === 0 ? 2 : 1} />
            <text x={tickX - 10} y={38} fontSize="14" fill="#475569">{value}</text>
          </g>
        );
      })}
      <text x={36} y={72} fontSize="14" fill="#475569">cm</text>

      {nose && (
        <path
          d={`M ${x(nose.position)} ${center} Q ${x(nose.position + nose.length * 0.55)} ${center - maxDiameter * radiusScale / 2} ${x(nose.position + nose.length)} ${center - nose.diameter * radiusScale / 2} L ${x(nose.position + nose.length)} ${center + nose.diameter * radiusScale / 2} Q ${x(nose.position + nose.length * 0.55)} ${center + maxDiameter * radiusScale / 2} ${x(nose.position)} ${center} Z`}
          fill={nose.id === selectedId ? "#fed7aa" : "#e2e8f0"}
          stroke={nose.id === selectedId ? "#f97316" : "#2563eb"}
          strokeWidth="2"
        />
      )}

      {bodyLike.map((component) => {
        const rect = bodyRect(component);
        const selected = component.id === selectedId;
        return (
          <rect key={component.id} x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="3" fill={selected ? "#fed7aa" : component.type === "motor" ? "#f59e0b" : "#ffffff"} stroke={selected ? "#f97316" : "#2563eb"} strokeWidth="2" opacity={component.type === "motor" || component.type === "recovery" ? 0.72 : 1} />
        );
      })}

      {fins && (() => {
        const root = fins.rootChord ?? fins.length;
        const tip = fins.tipChord ?? root * 0.45;
        const span = fins.span ?? maxDiameter;
        const sweep = fins.sweep ?? 40;
        const baseX = x(fins.position);
        const aftX = x(fins.position + root);
        const tipAft = x(fins.position + sweep + tip);
        const tipFore = x(fins.position + sweep);
        const selected = fins.id === selectedId;
        return (
          <g>
            <path d={`M ${baseX} ${center + maxDiameter * radiusScale / 2} L ${aftX} ${center + maxDiameter * radiusScale / 2} L ${tipAft} ${center + maxDiameter * radiusScale / 2 + span * 0.8} L ${tipFore} ${center + maxDiameter * radiusScale / 2 + span * 0.8} Z`} fill={selected ? "#fdba74" : "#38bdf8"} stroke={selected ? "#ea580c" : "#0369a1"} strokeWidth="2" />
            <path d={`M ${baseX} ${center - maxDiameter * radiusScale / 2} L ${aftX} ${center - maxDiameter * radiusScale / 2} L ${tipAft} ${center - maxDiameter * radiusScale / 2 - span * 0.55} L ${tipFore} ${center - maxDiameter * radiusScale / 2 - span * 0.55} Z`} fill={selected ? "#fed7aa" : "#bae6fd"} stroke={selected ? "#ea580c" : "#0284c7"} strokeWidth="2" />
          </g>
        );
      })()}

      {rails.map((component) => {
        const rect = bodyRect(component);
        return <rect key={component.id} x={rect.x} y={center - maxDiameter * radiusScale / 2 - 18} width={Math.max(rect.w, 18)} height="10" rx="4" fill={component.id === selectedId ? "#f97316" : "#94a3b8"} />;
      })}

      <circle cx={x(cg)} cy={center} r="8" fill="#2563eb" />
      <circle cx={x(cp)} cy={center} r="8" fill="#ef4444" />
      <text x={x(cg) + 10} y={center - 12} fontSize="12" fill="#2563eb">CG</text>
      <text x={x(cp) + 10} y={center + 24} fontSize="12" fill="#ef4444">CP</text>
      <text x={left} y={height - 42} fontSize="16" fill="#2563eb">Length {totalLength} mm · Max diameter {maxDiameter} mm · Selected component highlighted orange</text>
    </svg>
  );
}

function CadNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
      <input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-orange-300" />
    </label>
  );
}

function MotorDisclosureTile({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">{item}</p>
        ))}
      </div>
    </div>
  );
}

function PolicyLine({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-md bg-amber-50 p-2 text-amber-900">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{text}</span>
    </p>
  );
}
