import { BadgeCheck, Boxes, Calculator, CheckCircle2, ChevronRight, CircleDollarSign, FileArchive, FileText, Image, Lock, Rocket, ShieldCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FileUploadBox } from "@/components/file-upload-box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadEvidenceChecklist } from "@/lib/engineering-insights";

const publishSteps = [
  ["Project", "Project identity"],
  ["CAD", "Canonical web model"],
  ["Flight", "Motor and trajectory analysis"],
  ["Evidence", "Files and verification"],
  ["Market", "License and pricing"]
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
  "Unknown / placeholder"
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

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">Publish workspace</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Package a rocket project for CAD, simulation, evidence, and marketplace release</h1>
            <p className="mt-4 max-w-3xl text-orange-50/68">
              Upload turns a builder workspace into a project repository. The editable Web CAD model stays canonical; files, flight data, media proof, and marketplace settings attach around it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/build/rocket" asChild><Rocket className="h-4 w-4" />Continue from Rocket Builder</Button>
              <Button href="/build/motor" asChild variant="outline"><Calculator className="h-4 w-4" />Attach a saved motor</Button>
            </div>
          </div>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-5 w-5 text-orange-200" />Publish readiness</h2>
            <div className="mt-4 space-y-3">
              {publishSteps.map(([label, detail], index) => (
                <div key={label} className="flex items-center gap-3 rounded-md bg-white/[0.04] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-orange-300/15 text-sm font-semibold text-orange-100">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-orange-50/52">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <Section icon={FileText} title="Project identity" description="Name the repository, explain lineage, set visibility, and make the purpose clear before selling or forking.">
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
              <textarea className="mt-4 min-h-32 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none transition focus:border-orange-200/50" placeholder="Design goal, build story, assumptions, safety constraints, flight history, and what a fork should preserve." />
            </Section>

            <Section icon={BadgeCheck} title="Solid rocket project details" description="Different solid rocket projects need different metadata. Fill the parts that apply; unknown values can stay empty until the project matures.">
              <div className="grid gap-4 md:grid-cols-2">
                {projectInfoGroups.map(([title, description, fields]) => (
                  <div key={title} className="rounded-lg border border-white/12 bg-white/[0.04] p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-orange-50/52">{description}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {fields.map((field) => (
                        <InputField key={field} label={field} placeholder="Optional" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-amber-200/20 bg-amber-200/8 p-4 text-sm leading-6 text-orange-50/72">
                Solid motor data is accepted for simulation, documentation, and lawful educational analysis. Do not upload propellant manufacturing instructions, explosive recipes, harmful payload workflows, or weaponization content.
              </div>
            </Section>

            <Section icon={Calculator} title="Solid motor and propellant metadata" description="Capture enough motor context for simulation, search, verification, and marketplace trust without collecting hazardous manufacturing instructions.">
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
              <textarea className="mt-5 min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50 outline-none transition focus:border-orange-200/50" placeholder="Non-hazardous motor notes: data provenance, certification status, simulation assumptions, measurement hardware, anomalies, and what should remain private." />
            </Section>

            <Section icon={Boxes} title="Canonical Web CAD" description="This is the source of truth for the editable rocket. Imported files are attachments; the marketplace project should still open as a structured web CAD model.">
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
                  <div key={title} className="rounded-lg border border-white/12 bg-white/[0.04] p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fields.map((field) => <span key={field} className="rounded-md bg-black/15 px-2 py-1 text-xs text-orange-50/58">{field}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.05] p-4">
                <h3 className="flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4 text-cyan-200" />Design view and configuration metadata</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {viewAndConfigMetadata.map((item) => <p key={item} className="rounded-md bg-black/15 px-3 py-2 text-xs text-orange-50/62">{item}</p>)}
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {cadComponents.map((item) => (
                  <label key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-orange-50/72">
                    <input type="checkbox" defaultChecked className="accent-orange-300" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href="/build/rocket" asChild variant="outline"><Boxes className="h-4 w-4" />Open Web CAD editor</Button>
                <Button variant="outline"><UploadCloud className="h-4 w-4" />Import .ork-like XML</Button>
              </div>
            </Section>

            <Section icon={Calculator} title="Simulation package" description="Seed the rocket simulation from a saved motor, measured data, or a conservative analysis. Label computed values as pre-flight analysis until verified.">
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

            <Section icon={UploadCloud} title="Separated file uploads" description="Proof files are optional and should be uploaded by evidence type. This keeps CAD, simulation, telemetry, media proof, inspection evidence, and marketplace packages reviewable.">
              <div className="grid gap-4 md:grid-cols-2">
                {proofUploadBuckets.map((bucket) => (
                  <FileUploadBox key={bucket.title} {...bucket} />
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {acceptedFiles.map(([Icon, title, detail]) => (
                  <div key={title} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <Icon className="h-5 w-5 text-orange-200" />
                    <p className="mt-3 text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-orange-50/52">{detail}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={CircleDollarSign} title="Marketplace and licensing" description="Free and paid projects both support forking. Paid projects require purchase before fork; forked paid work can include royalty splits.">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Listing type" options={["Free project", "Paid project", "Private project"]} />
                <InputField label="Price" placeholder="$0.00" />
                <SelectField label="License" options={["CC BY-NC 4.0", "CC BY 4.0", "Commercial license", "Custom team license"]} />
                <InputField label="Original creator royalty" placeholder="2%" />
              </div>
              <div className="mt-5 rounded-lg border border-orange-200/20 bg-orange-300/10 p-4 text-sm text-orange-50/76">
                Platform fee is 5%. Fork attribution is retained automatically. Checkout uses a preview purchase flow and the listing model is Stripe-ready.
              </div>
            </Section>
          </div>

          <aside className="space-y-5">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-amber-200" />Safety gate</h2>
              <div className="mt-4 space-y-3 text-sm text-orange-50/72">
                <PolicyLine text="For educational and lawful rocketry use only." />
                <PolicyLine text="Users are responsible for local laws, launch rules, and safety codes." />
                <PolicyLine text="Do not upload harmful payloads, targeting systems, or weaponization instructions." />
                <PolicyLine text="Projects may be removed if they violate safety or legal policies." />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Evidence checklist</h2>
              <div className="mt-4 grid gap-2 text-sm text-orange-50/68">
                {uploadEvidenceChecklist.map((item) => (
                  <label key={item} className="flex items-center gap-2 rounded-md bg-white/[0.04] p-2">
                    <input type="checkbox" className="accent-orange-300" />
                    {item}
                  </label>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Verification target</h2>
              <div className="mt-4 space-y-3">
                {["Design uploaded", "Simulation analysis", "Media proof", "Telemetry attached", "Static fire data", "Flight verified"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                    <span className="text-orange-50/72">{item}</span>
                    <span className={index < 2 ? "text-orange-200" : "text-orange-50/35"}>{index < 2 ? "ready" : "optional"}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">Publish actions</h2>
              <div className="mt-4 grid gap-3">
                <Button><CheckCircle2 className="h-4 w-4" />Save project</Button>
                <Button variant="outline"><Lock className="h-4 w-4" />Run safety review</Button>
                <Button variant="outline">Preview listing<ChevronRight className="h-4 w-4" /></Button>
                <Button className="bg-orange-300 text-[#130d08] hover:bg-orange-200">Publish project repository</Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-orange-300/12 p-2 text-orange-200"><Icon className="h-5 w-5" /></span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-orange-50/58">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function InputField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="text-sm text-orange-50/65">
      {label}
      <input className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50 outline-none transition placeholder:text-orange-50/28 focus:border-orange-200/50" placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="text-sm text-orange-50/65">
      {label}
      <select className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-orange-50 outline-none transition focus:border-orange-200/50">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-orange-50/45">{label}</p>
      <p className="mt-1 text-sm font-medium text-orange-50">{value}</p>
    </div>
  );
}

function MotorDisclosureTile({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.04] p-4">
      <p className="font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="rounded-md bg-black/12 px-3 py-2 text-xs text-orange-50/62">{item}</p>
        ))}
      </div>
    </div>
  );
}

function PolicyLine({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-md bg-amber-300/8 p-2">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
      <span>{text}</span>
    </p>
  );
}
