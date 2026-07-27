"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Archive, Boxes, Calculator, Check, ChevronRight, Cpu, Crosshair, Download, Eye, FileUp, Flame, Gauge, Layers, Library, PackagePlus, Pause, Play, Rocket, Ruler, Save, ShieldCheck, UploadCloud, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RocketViewer3D } from "@/components/rocket-viewer-3d";
import { FileUploadBox } from "@/components/file-upload-box";
import { TelemetryChart } from "@/components/charts";
import { mockProjects } from "@/lib/mock-data";
import { readMockUser } from "@/lib/auth";
import { loadPersistentRecords, savePersistentRecord } from "@/lib/cloud-persistence";
import { analyzeNozzleFlow, defaultMotorParameters, propellantProfiles, simulateMotor } from "@/lib/motor-simulation";
import { runRocketEstimateWithMotor } from "@/lib/rocket-simulation";
import { sortComponents, totalLength } from "@/lib/cad/geometry";
import { buildModules, flightEquations, flightGraphOutputs, motorEquations, motorGraphOutputs } from "@/lib/platform-content";
import type { MotorParameters, MotorSimulationResult, SavedMotor } from "@/types/motor";
import type { NozzleCfdField, NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";
import type { RocketComponent, RocketComponentType, SimulationResult } from "@/lib/types";

const MOTOR_STORAGE_KEY = "rocketry-house.saved-motors";
type CfdDebugView = NozzleCfdField["name"] | "mesh" | "residual";

const safetyWarnings = [
  "Motor simulations are estimates and must not be treated as safety certification.",
  "Users are responsible for complying with applicable laws, club rules, launch site rules, and certified safety codes.",
  "Rocketry House does not certify motor safety."
];

const flow = ["Design Motor", "Simulate Motor", "Save Motor", "Build Rocket", "Insert Motor", "Simulate Rocket", "Publish / Fork / Review"];
const buildPageClass = "min-h-screen bg-space-radial px-6 pb-32 pt-24";

const defaultFreeformFinPoints = [
  { x: 0, y: 0 },
  { x: 44, y: 12 },
  { x: 155, y: 0 },
  { x: 118, y: 54 },
  { x: 68, y: 86 },
  { x: 12, y: 38 }
];

const finShapePresets = [
  {
    name: "Clipped delta",
    note: "Common sport/high-power baseline",
    patch: { finPlanform: "Clipped delta", finRootChord: 165, finTipChord: 72, finSpan: 86, finSweep: 52, finCount: 4, wallThickness: 4 }
  },
  {
    name: "Trapezoidal",
    note: "OpenRocket-style general purpose",
    patch: { finPlanform: "Trapezoidal", finRootChord: 155, finTipChord: 92, finSpan: 78, finSweep: 28, finCount: 4, wallThickness: 4 }
  },
  {
    name: "Swept tapered",
    note: "Looks fast, keeps aft CP authority",
    patch: { finPlanform: "Swept tapered", finRootChord: 175, finTipChord: 62, finSpan: 82, finSweep: 66, finCount: 4, wallThickness: 4 }
  },
  {
    name: "Elliptical reference",
    note: "Low-drag visual target",
    patch: { finPlanform: "Elliptical", finRootChord: 145, finTipChord: 118, finSpan: 68, finSweep: 18, finCount: 3, wallThickness: 3 }
  },
  {
    name: "Forward swept",
    note: "Visual study with forward leading edge",
    patch: { finPlanform: "Forward swept", finRootChord: 150, finTipChord: 64, finSpan: 76, finSweep: -28, finCount: 3, wallThickness: 4 }
  },
  {
    name: "Split fin",
    note: "Two-panel high-power style cue",
    patch: { finPlanform: "Split fin", finRootChord: 170, finTipChord: 56, finSpan: 88, finSweep: 48, finCount: 4, wallThickness: 4 }
  },
  {
    name: "Tube fin",
    note: "Ring/tube stabilizer layout",
    patch: { finPlanform: "Tube fin", finRootChord: 96, finTipChord: 96, finSpan: 62, finSweep: 0, finCount: 6, wallThickness: 3 }
  },
  {
    name: "Freeform vertices",
    note: "Edit each vertex below",
    patch: { finPlanform: "Freeform", finRootChord: 170, finTipChord: 68, finSpan: 92, finSweep: 36, finCount: 4, wallThickness: 4, finFreeformPoints: defaultFreeformFinPoints }
  }
] satisfies Array<{ name: string; note: string; patch: Partial<RocketComponent> }>;

const motorGeometryPresets = [
  {
    name: "54 mm BATES stack",
    note: "Segmented neutral-burn starting point",
    values: { casingLengthMm: 480, casingOuterDiameterMm: 54, casingInnerDiameterMm: 48, dryMassG: 1080, grainCount: 4, grainLengthMm: 88, grainOuterDiameterMm: 45, coreDiameterMm: 15, nozzleThroatMm: 8.5, nozzleExitMm: 20, expansionRatio: 5.5 }
  },
  {
    name: "38 mm club motor",
    note: "Smaller airframes and training flights",
    values: { casingLengthMm: 360, casingOuterDiameterMm: 38, casingInnerDiameterMm: 34, dryMassG: 520, grainCount: 3, grainLengthMm: 76, grainOuterDiameterMm: 31, coreDiameterMm: 11, nozzleThroatMm: 6, nozzleExitMm: 14, expansionRatio: 5.4 }
  },
  {
    name: "Long-burn conservative",
    note: "Lower average thrust, longer burn",
    values: { casingLengthMm: 520, casingOuterDiameterMm: 54, casingInnerDiameterMm: 48, dryMassG: 1160, grainCount: 5, grainLengthMm: 78, grainOuterDiameterMm: 44, coreDiameterMm: 18, nozzleThroatMm: 9.5, nozzleExitMm: 21, expansionRatio: 4.9 }
  }
] satisfies Array<{ name: string; note: string; values: Partial<MotorParameters> }>;

const grainGeometryModes = [
  ["BATES", "Segmented hollow-cylinder stack with axial core, commonly used for neutral-burn SRM studies."],
  ["Hollow cylinder", "Single or segmented circular port grain; equivalent baseline used in Meteor/JSRM style workflows."],
  ["Finocyl", "High initial burn-area concept for comparison and future solver support."],
  ["Moon burner", "Offset-core educational preview for progressive burn studies."],
  ["C-slot", "Slot-based visualization mode for non-axisymmetric profile research."],
  ["End burner", "Low-area reference case for long-burn comparison."],
  ["Rod and tube", "Coaxial reference geometry used for comparison datasets."],
  ["Star", "Star-port geometry factor for high initial burn-area comparisons."],
  ["Custom", "Reserved for imported profiles and future sketch-based grain geometry."]
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getFinPlanformPoints(component: RocketComponent) {
  const root = component.finRootChord ?? component.length;
  const tip = component.finTipChord ?? component.length * 0.48;
  const span = component.finSpan ?? component.diameter;
  const sweep = component.finSweep ?? component.length * 0.25;

  if (component.finPlanform === "Freeform") {
    const source = component.finFreeformPoints?.length ? component.finFreeformPoints : defaultFreeformFinPoints;
    return source.map((point) => ({ x: clamp(point.x, -root * 0.4, root * 1.4), y: clamp(point.y, 0, span * 1.35) }));
  }

  if (component.finPlanform === "Forward swept") {
    return [
      { x: 0, y: 0 },
      { x: root, y: 0 },
      { x: root + sweep, y: span },
      { x: Math.max(0, sweep) + Math.max(26, tip * 0.18), y: span }
    ];
  }

  if (component.finPlanform === "Elliptical") {
    return [
      { x: 0, y: 0 },
      { x: root * 0.24, y: span * 0.2 },
      { x: root * 0.58, y: span * 0.96 },
      { x: root * 0.9, y: span * 0.84 },
      { x: root, y: 0 }
    ];
  }

  if (component.finPlanform === "Split fin") {
    return [
      { x: 0, y: 0 },
      { x: root * 0.34, y: 0 },
      { x: root * 0.48, y: span * 0.44 },
      { x: root * 0.62, y: span * 0.15 },
      { x: root, y: span * 0.15 },
      { x: sweep + tip, y: span },
      { x: sweep, y: span },
      { x: root * 0.38, y: span * 0.5 }
    ];
  }

  if (component.finPlanform === "Tube fin") {
    return [
      { x: 0, y: span * 0.18 },
      { x: root * 0.18, y: 0 },
      { x: root * 0.82, y: 0 },
      { x: root, y: span * 0.18 },
      { x: root, y: span * 0.82 },
      { x: root * 0.82, y: span },
      { x: root * 0.18, y: span },
      { x: 0, y: span * 0.82 }
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: root, y: 0 },
    { x: sweep + tip, y: span },
    { x: sweep, y: span }
  ];
}

const rocketComponentPalette = [
  {
    category: "Assembly",
    items: [
      ["payload_section", "Stage", "Create a stage-like section"],
      ["coupler", "Booster/Coupler", "Stage adapter or coupler"],
      ["payload_section", "Pods", "External pod study"]
    ]
  },
  {
    category: "Body and fin sets",
    items: [
      ["nose_cone", "Nose Cone", "Ogive, conical, elliptical"],
      ["body_tube", "Body Tube", "Tube length, OD, ID, wall"],
      ["transition", "Transition", "Fore/aft diameter reducer"],
      ["fins", "Trapezoidal Fin Set", "Root, tip, span, sweep"],
      ["fins", "Elliptical Fin Set", "Low-drag visual reference"],
      ["fins", "Freeform Fin Set", "Custom planform controls"],
      ["rail_buttons", "Rail Button", "Rail guide pair"],
      ["launch_lug", "Launch Lug", "Tube launch guide"]
    ]
  },
  {
    category: "Inner components",
    items: [
      ["motor_mount", "Inner Tube", "Motor mount tube"],
      ["coupler", "Tube Coupler", "Internal tube coupler"],
      ["centering_rings", "Centering Ring", "Motor tube alignment"],
      ["bulkhead", "Bulkhead", "Bay closure"],
      ["engine_block", "Engine Block", "Motor stop"]
    ]
  },
  {
    category: "Recovery and mass",
    items: [
      ["parachute", "Parachute", "Recovery device"],
      ["shock_cord", "Shock Cord", "Recovery harness"],
      ["wadding", "Wadding", "Thermal protection marker"],
      ["payload_section", "Mass Component", "Avionics or payload mass"]
    ]
  }
] satisfies Array<{ category: string; items: Array<[RocketComponentType, string, string]> }>;

const componentFriendlyName: Record<RocketComponentType, string> = {
  nose_cone: "Nose cone",
  body_tube: "Body tube",
  transition: "Transition",
  fins: "Fin set",
  motor_mount: "Motor mount / inner tube",
  centering_rings: "Centering ring",
  bulkhead: "Bulkhead",
  coupler: "Tube coupler",
  engine_block: "Engine block",
  motor_retainer: "Motor retainer",
  motor_nozzle: "Motor nozzle",
  shock_cord: "Shock cord",
  parachute: "Parachute",
  wadding: "Wadding",
  rail_buttons: "Rail button",
  launch_lug: "Launch lug",
  recovery_bay: "Recovery bay",
  payload_section: "Payload / avionics bay"
};

const surfaceOptions = ["Exposed", "Inhibited"] as const;

function classPercent(totalImpulseNs: number, motorClass: string) {
  const maxByClass: Record<string, number> = { A: 2.5, B: 5, C: 10, D: 20, E: 40, F: 80, G: 160, H: 320, I: 640, J: 1280, K: 2560, L: 5120, M: 10240, N: 20480, O: 40960 };
  const letters = Object.keys(maxByClass);
  const index = letters.indexOf(motorClass);
  if (index < 0) return 0;
  const lower = index === 0 ? 0 : maxByClass[letters[index - 1]];
  const upper = maxByClass[motorClass];
  return Math.max(0, Math.min(100, Math.round(((totalImpulseNs - lower) / Math.max(upper - lower, 1)) * 100)));
}

function summarizeMotor(result: MotorSimulationResult, parameters: MotorParameters) {
  const active = result.curve.filter((point) => point.thrust > 0);
  const maxPressure = Math.max(0, ...result.curve.map((point) => point.pressure));
  const averagePressure = active.length ? active.reduce((sum, point) => sum + point.pressure, 0) / active.length : 0;
  const averageIsp = active.length ? active.reduce((sum, point) => sum + (point.specificImpulseS ?? 0), 0) / active.length : 0;
  const exitMach = 1.4 + Math.sqrt(Math.max((parameters.nozzleExitMm / Math.max(parameters.nozzleThroatMm, 1)) ** 2 - 1, 0)) * 0.55;
  const expansionRatio = ((parameters.nozzleExitMm / Math.max(parameters.nozzleThroatMm, 1)) ** 2);
  return {
    classLoad: classPercent(result.totalImpulseNs, result.motorClass),
    maxPressure: Number((result.maxPressureMPa ?? maxPressure).toFixed(2)),
    averagePressure: Number((result.averagePressureMPa ?? averagePressure).toFixed(2)),
    maxPressureBar: Number(((result.maxPressureMPa ?? maxPressure) * 10).toFixed(1)),
    averagePressureBar: Number(((result.averagePressureMPa ?? averagePressure) * 10).toFixed(1)),
    averageIsp: Number((result.averageSpecificImpulseS ?? averageIsp).toFixed(1)),
    exitMach: Number(exitMach.toFixed(2)),
    expansionRatio: Number(expansionRatio.toFixed(2)),
    optimumExpansionRatio: Number((result.optimumExpansionRatio ?? expansionRatio).toFixed(2)),
    portToThroatRatio: Number((result.portToThroatRatio ?? 0).toFixed(2)),
    combustionEfficiency: Math.round((result.combustionEfficiency ?? 1) * 100),
    nozzleEfficiency: Math.round((result.nozzleEfficiency ?? 1) * 100),
    deliveredCStar: result.deliveredCharacteristicVelocityMS ?? 0
  };
}

function validateMotorInputs(parameters: MotorParameters) {
  const issues: string[] = [];
  if (parameters.grainOuterDiameterMm > parameters.casingInnerDiameterMm) issues.push("Grain OD must fit inside the chamber diameter.");
  if (parameters.coreDiameterMm >= parameters.grainOuterDiameterMm) issues.push("Core diameter must be smaller than grain OD.");
  if (parameters.grainCount * parameters.grainLengthMm > parameters.casingLengthMm) issues.push("Grain stack length should not exceed chamber length.");
  if (parameters.nozzleThroatMm >= parameters.casingInnerDiameterMm * 0.6) issues.push("Throat diameter is too large relative to the chamber diameter for this estimate.");
  if (parameters.grainConfiguration === "C-slot" && (parameters.slotOffsetMm ?? 0) >= parameters.grainOuterDiameterMm / 2) issues.push("C-slot offset should be smaller than grain radius.");
  return issues;
}

export function createRocketComponent(type: RocketComponentType, components: RocketComponent[], label?: string): RocketComponent {
  const length = Math.max(1, totalLength(components));
  const diameter = components.find((component) => component.type === "body_tube")?.diameter ?? components[0]?.diameter ?? 54;
  const position = Math.max(0, Math.round(length * 0.55));
  const base = {
    id: `${type}-${Date.now()}`,
    type,
    name: label ?? componentFriendlyName[type],
    length: 80,
    diameter,
    wallThickness: 2,
    material: "Cardboard",
    mass: 25,
    position
  } satisfies RocketComponent;

  if (type === "nose_cone") return { ...base, length: 150, position: 0, mass: 38, noseShape: "Ogive", shapeParameter: 1, finish: "Regular paint" };
  if (type === "body_tube") return { ...base, length: 220, position: length, mass: 48, automaticDiameter: true, finish: "Regular paint" };
  if (type === "transition") return { ...base, length: 75, foreDiameter: diameter, aftDiameter: Math.round(diameter * 0.78), mass: 18, finish: "Regular paint" };
  if (type === "fins") {
    const planform: RocketComponent["finPlanform"] = label?.includes("Freeform") ? "Freeform" : label?.includes("Elliptical") ? "Elliptical" : "Trapezoidal";
    return { ...base, name: label ?? "Trapezoidal fin set", length: 120, position: Math.max(0, length - 160), mass: 42, finPlanform: planform, finFreeformPoints: planform === "Freeform" ? defaultFreeformFinPoints : undefined, finRootChord: 120, finTipChord: 70, finSpan: 45, finSweep: 32, finCount: 3, finCantDeg: 0, finRotationDeg: 0, finCrossSection: "Square", finFilletRadius: 0 };
  }
  if (type === "motor_mount") return { ...base, name: "Inner tube / motor mount", length: 180, diameter: 29, position: Math.max(0, length - 200), mass: 32 };
  if (type === "rail_buttons") return { ...base, length: 18, diameter: 8, position: Math.max(0, length * 0.42), mass: 8, name: "Rail button pair" };
  if (type === "launch_lug") return { ...base, length: 35, diameter: 6, position: Math.max(0, length * 0.42), mass: 6 };
  if (type === "parachute") return { ...base, length: 75, diameter: Math.round(diameter * 0.75), position: Math.round(length * 0.34), mass: 22 };
  if (type === "shock_cord") return { ...base, length: 110, diameter: 8, position: Math.round(length * 0.28), mass: 14 };
  if (type === "wadding") return { ...base, length: 55, diameter: Math.round(diameter * 0.8), position: Math.round(length * 0.38), mass: 8 };
  if (type === "centering_rings") return { ...base, length: 8, diameter, position: Math.max(0, length - 130), mass: 10 };
  if (type === "engine_block") return { ...base, length: 12, diameter: 29, position: Math.max(0, length - 210), mass: 7 };
  if (type === "bulkhead") return { ...base, length: 8, diameter, position: Math.round(length * 0.5), mass: 16 };
  if (type === "coupler") return { ...base, length: 70, diameter: Math.round(diameter * 0.94), position: Math.round(length * 0.45), mass: 20 };
  return base;
}

export function BuildHome() {
  const libraryNotes = [
    ["Motor library", "Saved motors stay attached to your account and can be inserted into future rocket designs."],
    ["Rocket projects", "Airframe CAD, selected motor, simulation result, and publish settings live together as one project."],
    ["Public release", "Publish when the design has files, safety notes, flight evidence, and usage-rights metadata ready."]
  ];

  return (
    <main className={buildPageClass}>
      <div className="mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">Builder workspace</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold">Design propulsion first, then build the rocket around real motor data.</h1>
        <p className="mt-4 max-w-3xl text-orange-50/68">Rocketry House treats motors as account-owned design objects: simulate a motor, save it to your personal library, insert it into a CAD rocket, then run rocket-level flight analysis from the selected thrust curve.</p>
        <SafetyStrip />
        <div className="mt-8 grid gap-4 md:grid-cols-7">
          {flow.map((step, index) => (
            <Card key={step} className="p-4">
              <p className="text-xs text-orange-100/50">0{index + 1}</p>
              <p className="mt-2 text-sm font-semibold">{step}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <WorkspaceCard href="/build/motor" icon={Flame} title="Build > Motor" copy="Create a solid motor analysis, visualize casing/grain/nozzle geometry, generate thrust and pressure curves, then save it to your account library." cta="Open Motor Builder" />
          <WorkspaceCard href="/build/rocket" icon={Rocket} title="Build > Rocket" copy="Design the airframe in the browser, pick a saved motor, place it in the motor mount, and run rocket-level performance graphs." cta="Open Rocket Builder" />
        </div>
        <Card className="mt-8 p-5">
          <h2 className="font-semibold">Build system modules</h2>
          <p className="mt-2 text-sm text-orange-50/60">The workspace is organized like an aerospace engineering environment, not a single-file editor.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {buildModules.map(([title, copy]) => (
              <div key={title} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="text-sm font-semibold text-orange-100">{title}</p>
                <p className="mt-2 text-xs leading-5 text-orange-50/55">{copy}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {libraryNotes.map(([title, copy]) => (
            <Card key={title} className="p-5">
              <p className="text-sm font-semibold text-orange-100">{title}</p>
              <p className="mt-2 text-sm leading-6 text-orange-50/62">{copy}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

export function MotorBuilder() {
  const [parameters, setParameters] = useState<MotorParameters>(defaultMotorParameters);
  const [result, setResult] = useState<MotorSimulationResult>(() => simulateMotor(defaultMotorParameters));
  const [modalOpen, setModalOpen] = useState(false);
  const [savedName, setSavedName] = useState(defaultMotorParameters.projectName);
  const [visibility, setVisibility] = useState<"private" | "public" | "unlisted">("private");
  const [license, setLicense] = useState("CC BY-NC 4.0");
  const [nozzleOpen, setNozzleOpen] = useState(false);
  const [compareMotors, setCompareMotors] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Motor not saved yet.");

  function update<K extends keyof MotorParameters>(key: K, value: MotorParameters[K]) {
    setParameters((current) => ({ ...current, [key]: value }));
  }

  function runSimulation() {
    setResult(simulateMotor(parameters));
  }

  async function saveMotor() {
    const motor: SavedMotor = {
      id: `motor-${Date.now()}`,
      name: savedName,
      creator: "You",
      description: "Saved from Build > Motor as a pre-flight simulation package.",
      visibility,
      license,
      priceCents: 0,
      motorType: "Solid Rocket Motor",
      estimatedClass: result.motorClass,
      totalImpulseNs: result.totalImpulseNs,
      averageThrustN: result.averageThrustN,
      peakThrustN: result.peakThrustN,
      burnTimeS: result.burnTimeS,
      propellantProfileName: parameters.propellantProfileName,
      verificationStatus: "Pre-flight analysis",
      parameters,
      simulation: result,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    const existing = readStoredMotors();
    localStorage.setItem(getMotorStorageKey(), JSON.stringify([motor, ...existing]));
    setSaveStatus("Saving motor to account library...");
    const saveResult = await savePersistentRecord("saved_motors", motor.id, motor);
    setSaveStatus(saveResult.cloud ? "Motor saved to Supabase and local backup." : "Motor saved locally. Cloud sync needs Supabase availability.");
    window.dispatchEvent(new Event("rocketry-motors-change"));
    setModalOpen(false);
  }

  return (
    <main className={buildPageClass}>
        <div className="mx-auto max-w-7xl">
        <BuilderHeader eyebrow="Build > Motor" title="Motor design and simulation workspace" copy="Generate a pre-flight performance analysis, attach measured static-fire data, and save the motor for rocket CAD integration." />
        <SafetyStrip />
        <div className="mt-8 grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
            <MotorParameterPanel parameters={parameters} update={update} runSimulation={runSimulation} />
          </div>
          <div className="min-w-0 space-y-5">
            <MotorPerformanceSummary result={result} parameters={parameters} compareMotors={compareMotors} setCompareMotors={setCompareMotors} onSave={() => setModalOpen(true)} onNozzle={() => setNozzleOpen(true)} onExportRasp={() => exportRaspMotor(parameters, result)} />
            <MotorCrossSectionView parameters={parameters} />
            <MotorCurveChart result={result} measuredCurve={undefined} />
          </div>
        </div>
        <Card className="mt-5 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><FileUp className="h-5 w-5 text-orange-200" />Measured data and files</h2>
          <p className="mt-2 text-sm text-orange-50/62">Attach static-fire data, measured thrust CSV, photos, PDFs, or notes. These files support verification; they do not certify motor safety.</p>
          <p className="mt-3 rounded-md bg-white/[0.04] p-3 text-xs text-orange-50/60">{saveStatus}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FileUploadBox />
            <RawMeasuredPreview />
          </div>
        </Card>
      </div>
      {modalOpen ? (
        <MotorSaveModal
          name={savedName}
          setName={setSavedName}
          visibility={visibility}
          setVisibility={setVisibility}
          license={license}
          setLicense={setLicense}
          onClose={() => setModalOpen(false)}
          onSave={saveMotor}
        />
      ) : null}
      {nozzleOpen ? <NozzleDesignModal parameters={parameters} update={update} onClose={() => setNozzleOpen(false)} /> : null}
    </main>
  );
}

export function MotorLibrary({ detailId }: { detailId?: string }) {
  const [motors, setMotors] = useState<SavedMotor[]>([]);
  useEffect(() => {
    const sync = () => setMotors(readStoredMotors());
    sync();
    void syncPersistentMotors();
    window.addEventListener("rocketry-auth-change", sync);
    window.addEventListener("rocketry-motors-change", sync);
    return () => {
      window.removeEventListener("rocketry-auth-change", sync);
      window.removeEventListener("rocketry-motors-change", sync);
    };
  }, []);
  const selected = detailId ? motors.find((motor) => motor.id === detailId) ?? motors[0] : undefined;

  return (
    <main className={buildPageClass}>
      <div className="mx-auto max-w-7xl">
        <BuilderHeader eyebrow="Account Library" title={selected ? selected.name : "Saved motors"} copy="These are account-owned motors. The top-level product navigation stays project-first; saved motors live under the user account and can be imported into Build > Rocket." />
        {selected ? <MotorDetail motor={selected} /> : (
          motors.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {motors.map((motor) => <MotorCard key={motor.id} motor={motor} />)}
            </div>
          ) : (
            <Card className="mt-8 p-8 text-center text-orange-50/65">
              No motors saved for this account yet. Build and save a motor first, then import it into the rocket builder.
            </Card>
          )
        )}
      </div>
    </main>
  );
}

export function RocketBuilder() {
  const project = mockProjects.find((item) => item.slug === "bps-scout-f-reference") ?? mockProjects[0];
  const [components, setComponents] = useState<RocketComponent[]>(project.components);
  const [motors, setMotors] = useState<SavedMotor[]>([]);
  const [selectedMotorId, setSelectedMotorId] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState("Rocket project not saved yet.");
  const [windSpeedMps, setWindSpeedMps] = useState(1.7);
  const [result, setResult] = useState<SimulationResult>(() => runRocketEstimateWithMotor(project.components, undefined, { windSpeedMps: 1.7 }));
  const [launchRun, setLaunchRun] = useState(0);
  const [selectedComponentId, setSelectedComponentId] = useState(project.components[0]?.id ?? "");
  const [designView, setDesignView] = useState<"Side view" | "3D Figure">("Side view");
  const selectedMotor = motors.find((motor) => motor.id === selectedMotorId);
  const componentsWithMotor = useMemo(() => selectedMotor ? insertMotorComponent(components, selectedMotor) : components, [components, selectedMotor]);
  const selectedComponent = components.find((component) => component.id === selectedComponentId) ?? components[0];

  useEffect(() => {
    const sync = () => {
      const storedMotors = readStoredMotors();
      setMotors(storedMotors);
      setSelectedMotorId((current) => storedMotors.some((motor) => motor.id === current) ? current : storedMotors[0]?.id || "");
    };
    sync();
    void syncPersistentMotors();
    window.addEventListener("rocketry-auth-change", sync);
    window.addEventListener("rocketry-motors-change", sync);
    return () => {
      window.removeEventListener("rocketry-auth-change", sync);
      window.removeEventListener("rocketry-motors-change", sync);
    };
  }, []);

  useEffect(() => {
    setResult(runRocketEstimateWithMotor(components, selectedMotor, { windSpeedMps }));
  }, [components, selectedMotor, windSpeedMps]);

  function simulateRocket() {
    setResult(runRocketEstimateWithMotor(components, selectedMotor, { windSpeedMps }));
    setLaunchRun((run) => run + 1);
  }

  function updateComponent(id: string, patch: Partial<RocketComponent>) {
    setComponents((current) => current.map((component) => component.id === id ? { ...component, ...patch } : component));
  }

  function addRocketComponent(type: RocketComponentType, label?: string) {
    const component = createRocketComponent(type, components, label);
    setComponents((current) => [...current, component]);
    setSelectedComponentId(component.id);
  }

  function duplicateSelected() {
    if (!selectedComponent) return;
    const duplicate = { ...selectedComponent, id: `${selectedComponent.type}-${Date.now()}`, name: `${selectedComponent.name} copy`, position: selectedComponent.position + 18 };
    setComponents((current) => [...current, duplicate]);
    setSelectedComponentId(duplicate.id);
  }

  function deleteSelected() {
    if (!selectedComponent || components.length <= 1) return;
    setComponents((current) => current.filter((component) => component.id !== selectedComponent.id));
    setSelectedComponentId(components.find((component) => component.id !== selectedComponent.id)?.id ?? "");
  }

  function moveSelected(delta: number) {
    if (!selectedComponent) return;
    updateComponent(selectedComponent.id, { position: Math.max(0, selectedComponent.position + delta) });
  }

  async function saveRocketProject() {
    const now = new Date().toISOString();
    const slug = `rocket-build-${now.slice(0, 10)}-${Date.now().toString(36)}`;
    const payload = {
      schema: "rocketry-house-rocket-project-v1",
      id: slug,
      slug,
      name: "Saved Rocket Builder Design",
      source: "build/rocket",
      updatedAt: now,
      components,
      renderedComponents: componentsWithMotor,
      selectedMotorId: selectedMotor?.id ?? null,
      selectedMotor: selectedMotor ?? null,
      motorMountPositionMm: selectedMotor ? Math.max(0, totalLength(components) - selectedMotor.parameters.casingLengthMm - 80) : null,
      windSpeedMps,
      simulation: result,
      summary: {
        lengthMm: totalLength(components),
        dryMassG: components.reduce((sum, component) => sum + component.mass, 0),
        loadedMassG: componentsWithMotor.reduce((sum, component) => sum + component.mass, 0),
        cgMm: result.cgMm,
        cpMm: result.cpMm,
        stabilityMargin: result.stabilityMargin,
        predictedAltitudeM: result.predictedAltitudeM,
        maxDriftM: result.maxDriftM ?? 0
      }
    };

    setSaveStatus("Saving rocket project to account archive...");
    localStorage.setItem("rocketry-house.last-rocket-project", JSON.stringify(payload));
    const [projectSave, builderSave] = await Promise.all([
      savePersistentRecord("rocket_projects", slug, payload),
      savePersistentRecord("rocket_builder_current", "current", payload)
    ]);
    setSaveStatus(projectSave.cloud && builderSave.cloud ? "Rocket project saved to Supabase and local backup." : "Rocket project saved locally. Cloud sync needs Supabase availability.");
  }

  function addPayloadBay() {
    const length = Math.max(...components.map((component) => component.position + component.length));
    setComponents((current) => [
      ...current,
      { id: `payload-${Date.now()}`, type: "payload_section", name: "New payload bay", length: 180, diameter: current[0]?.diameter ?? 75, wallThickness: 2, material: "airframe tube", mass: 180, position: Math.max(0, length * 0.28) }
    ]);
  }

  return (
    <main className={buildPageClass}>
      <div className="mx-auto max-w-[1600px]">
        <BuilderHeader eyebrow="Build > Rocket" title="Rocket CAD workspace with motor-aware simulation" copy="Design the airframe, insert an account-saved motor, and integrate its thrust curve directly for rocket-level flight analysis." />
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5 text-orange-200" />Web CAD live 3D workspace</h2>
                  <p className="mt-1 text-sm text-orange-50/62">This is the primary browser CAD view. Component edits, selected motor metadata, fins, launch guides, and aft hardware update the rocket model live.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button href="/upload" asChild variant="outline"><UploadCloud className="h-4 w-4" />Publish project</Button>
                  <Button variant="outline" onClick={simulateRocket}><Play className="h-4 w-4" />Run simulation</Button>
                </div>
              </div>
              <div className="mt-4">
                <RocketViewer3D components={componentsWithMotor} selectedComponentId={selectedComponentId} onSelectComponent={setSelectedComponentId} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Selected component" value={selectedComponent ? selectedComponent.name : "None"} />
                <Metric label="Selected motor" value={selectedMotor ? `${selectedMotor.name}` : "None"} />
                <Metric label="CG / CP" value={`${result.cgMm} / ${result.cpMm} mm`} />
                <Metric label="Apogee" value={`${result.predictedAltitudeM} m`} />
              </div>
            </Card>
            <RocketDesignWorkbench
              components={components}
              renderedComponents={componentsWithMotor}
              selectedComponentId={selectedComponentId}
              setSelectedComponentId={setSelectedComponentId}
              updateComponent={updateComponent}
              addComponent={addRocketComponent}
              duplicateSelected={duplicateSelected}
              deleteSelected={deleteSelected}
              moveSelected={moveSelected}
              result={result}
              designView={designView}
              setDesignView={setDesignView}
              selectedMotor={selectedMotor}
            />
            <RocketLaunchScene runId={launchRun} result={result} hasMotor={Boolean(selectedMotor)} components={componentsWithMotor} windSpeedMps={windSpeedMps} setWindSpeedMps={setWindSpeedMps} onRun={simulateRocket} />
            <RocketCADWorkspace components={components} updateComponent={updateComponent} addPayloadBay={addPayloadBay} selectedComponentId={selectedComponentId} />
            <RocketGraphSet result={result} />
            <EngineeringReferencePanel title="Rocket flight model" equations={flightEquations} outputs={flightGraphOutputs} />
          </div>
          <div className="space-y-5">
            <MotorLibraryPicker motors={motors} selectedMotorId={selectedMotorId} setSelectedMotorId={setSelectedMotorId} />
            <Card className="p-5">
              <h2 className="font-semibold">CG / CP and simulation</h2>
              <div className="mt-4 grid gap-3 text-sm text-orange-50/70">
                <Metric label="CG" value={`${result.cgMm} mm`} />
                <Metric label="CP" value={`${result.cpMm} mm`} />
                <Metric label="Stability" value={`${result.stabilityMargin} calibers`} />
                <Metric label="Apogee" value={`${result.predictedAltitudeM} m`} />
                <Metric label="Wind drift" value={`${result.maxDriftM ?? 0} m @ ${windSpeedMps.toFixed(1)} m/s`} />
              </div>
              <div className="mt-4 space-y-2">
                {result.warnings.map((warning) => <p key={warning.message} className={`rounded-md p-2 text-xs ${warning.level === "critical" ? "bg-red-500/12 text-red-100" : "bg-white/[0.04] text-orange-50/65"}`}>{warning.message}</p>)}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Project actions</h2>
              <p className="mt-3 rounded-md bg-white/[0.04] p-3 text-xs leading-5 text-orange-50/62">{saveStatus}</p>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" onClick={saveRocketProject}><Save className="h-4 w-4" />Save rocket project</Button>
                <Button variant="outline"><Archive className="h-4 w-4" />Create fork-ready package</Button>
                <Button><ChevronRight className="h-4 w-4" />Publish / Fork / Review</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function RocketDesignWorkbench({
  components,
  renderedComponents,
  selectedComponentId,
  setSelectedComponentId,
  updateComponent,
  addComponent,
  duplicateSelected,
  deleteSelected,
  moveSelected,
  result,
  designView,
  setDesignView,
  selectedMotor
}: {
  components: RocketComponent[];
  renderedComponents: RocketComponent[];
  selectedComponentId: string;
  setSelectedComponentId: (id: string) => void;
  updateComponent: (id: string, patch: Partial<RocketComponent>) => void;
  addComponent: (type: RocketComponentType, label?: string) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  moveSelected: (delta: number) => void;
  result: SimulationResult;
  designView: "Side view" | "3D Figure";
  setDesignView: (view: "Side view" | "3D Figure") => void;
  selectedMotor?: SavedMotor;
}) {
  const selectedComponent = components.find((component) => component.id === selectedComponentId) ?? components[0];
  const rocketLength = totalLength(components);
  const dryMass = Math.max(0, components.reduce((sum, component) => sum + component.mass, 0));
  const loadedMass = dryMass + (selectedMotor?.simulation.propellantMassG ?? 0);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid min-h-[760px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-white/[0.03] p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Layers className="h-5 w-5 text-cyan-200" />Rocket design tree</h2>
            <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-orange-50/52">Sustainer</span>
          </div>
          <RocketComponentTree components={components} selectedId={selectedComponentId} select={setSelectedComponentId} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => moveSelected(-10)}>Move up</Button>
            <Button variant="outline" size="sm" onClick={() => moveSelected(10)}>Move down</Button>
            <Button variant="outline" size="sm" onClick={duplicateSelected}>Duplicate</Button>
            <Button variant="outline" size="sm" onClick={deleteSelected}>Delete</Button>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-orange-50/62">
            <p className="font-semibold text-orange-50">Current design</p>
            <p>Length {Math.round(rocketLength)} mm, max diameter {Math.round(result.diameterMm)} mm</p>
            <p>Dry mass {Math.round(dryMass)} g</p>
            <p>Loaded mass {Math.round(loadedMass)} g</p>
            <p>Selected motor {selectedMotor ? `${selectedMotor.estimatedClass}${selectedMotor.averageThrustN}` : "none"}</p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="border-b border-white/10 bg-white/[0.025] p-4">
            <h2 className="flex items-center gap-2 font-semibold"><PackagePlus className="h-5 w-5 text-orange-200" />Add new component</h2>
            <div className="mt-4 space-y-4">
              {rocketComponentPalette.map((group) => (
                <div key={group.category}>
                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-orange-50/42">{group.category}</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {group.items.map(([type, label, note]) => (
                      <button key={`${group.category}-${label}`} type="button" onClick={() => addComponent(type, label)} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-orange-200/40 hover:bg-white/[0.075]">
                        <span className="block text-sm font-semibold text-orange-50">{label}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-orange-50/46">{note}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-0">
            <div className="min-w-0 p-4">
              <RocketViewportToolbar designView={designView} setDesignView={setDesignView} result={result} selectedMotor={selectedMotor} />
              {designView === "3D Figure" ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-[#f7f9fc] p-3">
                  <RocketViewer3D components={renderedComponents} selectedComponentId={selectedComponentId} onSelectComponent={setSelectedComponentId} />
                </div>
              ) : (
                <RocketSideProfile components={renderedComponents} result={result} selectedId={selectedComponentId} select={setSelectedComponentId} />
              )}
            </div>
            <div className="border-t border-white/10 p-4">
              {selectedComponent ? <ComponentConfigurationPanel component={selectedComponent} updateComponent={updateComponent} /> : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RocketComponentTree({ components, selectedId, select }: { components: RocketComponent[]; selectedId: string; select: (id: string) => void }) {
  const sorted = sortComponents(components);
  return (
    <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-white/10 bg-[#070a12]/70 p-2">
      <button type="button" className="mb-1 w-full rounded-md px-2 py-2 text-left text-xs font-semibold text-orange-50/70">Sustainer</button>
      <div className="space-y-1 pl-3">
        {sorted.map((component) => (
          <button key={component.id} type="button" onClick={() => select(component.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition ${selectedId === component.id ? "bg-cyan-200/15 text-cyan-50" : "text-orange-50/62 hover:bg-white/[0.06]"}`}>
            <span className="h-px w-4 bg-white/20" />
            <span className="truncate">{component.name}</span>
            <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-orange-50/42">{componentFriendlyName[component.type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RocketViewportToolbar({ designView, setDesignView, result, selectedMotor }: { designView: "Side view" | "3D Figure"; setDesignView: (view: "Side view" | "3D Figure") => void; result: SimulationResult; selectedMotor?: SavedMotor }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="text-xs text-orange-50/50">View type
          <select value={designView} onChange={(event) => setDesignView(event.target.value as "Side view" | "3D Figure")} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-2 py-2 text-sm text-orange-50">
            <option>Side view</option>
            <option>3D Figure</option>
          </select>
        </label>
        <label className="text-xs text-orange-50/50">Flight configuration
          <select className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-2 py-2 text-sm text-orange-50">
            <option>{selectedMotor ? `[${selectedMotor.estimatedClass}${selectedMotor.averageThrustN}]` : "[no motor selected]"}</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 text-xs text-orange-50/62">
          <span className="rounded-md bg-white/[0.06] px-2 py-2"><Crosshair className="mr-1 inline h-3.5 w-3.5" />CG {Math.round(result.cgMm)} mm</span>
          <span className="rounded-md bg-white/[0.06] px-2 py-2">CP {Math.round(result.cpMm)} mm</span>
          <span className="rounded-md bg-white/[0.06] px-2 py-2">Stability {result.stabilityMargin} cal</span>
        </div>
      </div>
    </div>
  );
}

export function RocketSideProfile({ components, result, selectedId, select }: { components: RocketComponent[]; result: SimulationResult; selectedId: string; select: (id: string) => void }) {
  const sorted = sortComponents(components);
  const nominalLength = Math.max(totalLength(sorted), 1);
  const maxDiameter = Math.max(...sorted.map((component) => component.diameter), 1);
  const renderedEnd = Math.max(
    nominalLength,
    result.cgMm,
    result.cpMm,
    ...sorted.map((component) => {
      if (component.type === "fins") {
        return component.position + Math.max(...getFinPlanformPoints(component).map((point) => point.x), component.length);
      }

      return component.position + component.length;
    }),
  );
  const drawingLength = renderedEnd + Math.max(160, maxDiameter * 2.2);
  const width = 1320;
  const height = 380;
  const left = 74;
  const right = 120;
  const top = 90;
  const usableWidth = width - left - right;
  const scaleX = usableWidth / drawingLength;
  const scaleY = 86 / maxDiameter;

  const xFor = (position: number) => left + position * scaleX;
  const yMid = top + 150;
  const componentHeight = (component: RocketComponent) => Math.max(5, component.diameter * scaleY);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-[#f8fafc] p-3 text-slate-900">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="OpenRocket-style side profile with ruler and CG CP markers">
        <defs>
          <pattern id="rocketRulerTick" width="20" height="10" patternUnits="userSpaceOnUse">
            <line x1="0" x2="0" y1="0" y2="10" stroke="#94a3b8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#f8fafc" />
        <rect x={left} y="34" width={usableWidth} height="22" fill="url(#rocketRulerTick)" />
        {Array.from({ length: 12 }, (_, index) => {
          const value = Math.round((drawingLength / 11) * index);
          const x = left + (usableWidth / 11) * index;
          return (
            <g key={value}>
              <line x1={x} x2={x} y1="30" y2="60" stroke="#334155" strokeWidth={index % 2 === 0 ? 1.4 : 1} />
              <text x={x - 10} y="28" fontSize="11" fill="#334155">{Math.round(value / 10)}</text>
            </g>
          );
        })}
        <text x="8" y="54" fontSize="12" fill="#334155">cm</text>
        <line x1={left} x2={left + usableWidth} y1={yMid} y2={yMid} stroke="#475569" strokeOpacity="0.22" strokeDasharray="4 5" />

        {sorted.map((component) => {
          const x = xFor(component.position);
          const w = Math.max(4, component.length * scaleX);
          const h = componentHeight(component);
          const isSelected = component.id === selectedId;
          const stroke = isSelected ? "#f97316" : component.type === "motor_mount" || component.type === "parachute" || component.type === "shock_cord" ? "#ef4444" : "#2563eb";
          const dash = ["motor_mount", "parachute", "shock_cord", "wadding", "bulkhead", "centering_rings", "coupler", "engine_block"].includes(component.type) ? "7 5" : undefined;

          if (component.type === "nose_cone") {
            return <path key={component.id} onClick={() => select(component.id)} d={`M${x} ${yMid} C${x + w * 0.36} ${yMid - h * 0.5} ${x + w * 0.78} ${yMid - h * 0.5} ${x + w} ${yMid - h / 2} V${yMid + h / 2} C${x + w * 0.78} ${yMid + h * 0.5} ${x + w * 0.36} ${yMid + h * 0.5} ${x} ${yMid} Z`} fill="none" stroke={stroke} strokeWidth={isSelected ? 2.4 : 1.5} />;
          }
          if (component.type === "fins") {
            const points = getFinPlanformPoints(component);
            return (
              <g key={component.id} onClick={() => select(component.id)}>
                {[1, -1].map((side) => {
                  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x + point.x * scaleX} ${yMid + side * (h / 2 + point.y * scaleY)}`).join(" ");
                  return <path key={side} d={`${path} Z`} fill="rgba(59,130,246,0.08)" stroke={stroke} strokeWidth={isSelected ? 2.4 : 1.5} />;
                })}
              </g>
            );
          }
          if (component.type === "transition") {
            const fore = Math.max(8, (component.foreDiameter ?? component.diameter) * scaleY);
            const aft = Math.max(8, (component.aftDiameter ?? component.diameter * 0.8) * scaleY);
            return <path key={component.id} onClick={() => select(component.id)} d={`M${x} ${yMid - fore / 2} H${x + w} V${yMid - aft / 2} M${x} ${yMid + fore / 2} H${x + w} V${yMid + aft / 2} M${x} ${yMid - fore / 2} L${x + w} ${yMid - aft / 2} M${x} ${yMid + fore / 2} L${x + w} ${yMid + aft / 2}`} fill="none" stroke={stroke} strokeWidth={isSelected ? 2.4 : 1.5} />;
          }
          return <rect key={component.id} onClick={() => select(component.id)} x={x} y={yMid - h / 2} width={w} height={h} rx="3" fill="none" stroke={stroke} strokeWidth={isSelected ? 2.4 : 1.5} strokeDasharray={dash} />;
        })}

        <CGCPMarker x={xFor(result.cgMm)} y={yMid} color="#2563eb" label={`CG ${Math.round(result.cgMm)} mm`} />
        <CGCPMarker x={xFor(result.cpMm)} y={yMid} color="#ef4444" label={`CP ${Math.round(result.cpMm)} mm`} />
        <text x={width - 210} y="82" fontSize="13" fill="#334155">Stability: {result.stabilityMargin} cal</text>
        <text x="20" y={height - 74} fontSize="12" fill="#1d4ed8">Apogee: {result.predictedAltitudeM} m</text>
        <text x="20" y={height - 54} fontSize="12" fill="#1d4ed8">Max velocity: {result.maxVelocityMps} m/s</text>
        <text x="20" y={height - 34} fontSize="12" fill="#1d4ed8">Rail exit: {result.railExitVelocityMps} m/s</text>
      </svg>
    </div>
  );
}

function CGCPMarker({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" fill={color} stroke="#fff" strokeWidth="2" />
      <line x1={x - 12} x2={x + 12} y1={y} y2={y} stroke="#fff" strokeWidth="1.4" />
      <line x1={x} x2={x} y1={y - 12} y2={y + 12} stroke="#fff" strokeWidth="1.4" />
      <text x={x + 12} y={y - 12} fontSize="12" fill={color}>{label}</text>
    </g>
  );
}

export function ComponentConfigurationPanel({ component, updateComponent }: { component: RocketComponent; updateComponent: (id: string, patch: Partial<RocketComponent>) => void }) {
  return (
    <div>
      <h2 className="font-semibold">{componentFriendlyName[component.type]} configuration</h2>
      <p className="mt-1 text-xs text-orange-50/50">OpenRocket-style component settings adapted for web CAD.</p>
      <ComponentEditCard component={component} updateComponent={updateComponent} />
      <ComponentSpecificControls component={component} updateComponent={updateComponent} />
    </div>
  );
}

function RocketLaunchScene({ runId, result, hasMotor, components, windSpeedMps, setWindSpeedMps, onRun }: { runId: number; result: SimulationResult; hasMotor: boolean; components: RocketComponent[]; windSpeedMps: number; setWindSpeedMps: (value: number) => void; onRun: () => void }) {
  const [phase, setPhase] = useState<"idle" | "countdown" | "ignition" | "rail" | "ascent" | "coast" | "parachute" | "complete">("idle");
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!runId) return;
    setPhase("countdown");
    setClock(0);
    let animationFrame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      setClock(elapsed);
      if (elapsed < 9.4) animationFrame = requestAnimationFrame(tick);
      else setPhase("complete");
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [runId]);

  useEffect(() => {
    if (phase === "countdown" && clock >= 2) setPhase("ignition");
    if (phase === "ignition" && clock >= 2.45) setPhase("rail");
    if (phase === "rail" && clock >= 3.2) setPhase("ascent");
    if (phase === "ascent" && Math.max(0, clock - 2) > result.burnTimeS) setPhase("coast");
    if ((phase === "ascent" || phase === "coast") && clock >= 7.2) setPhase("parachute");
    if (phase === "parachute" && clock >= 9.2) setPhase("complete");
  }, [clock, phase]);

  const flightTime = Math.max(0, clock - 2);
  const sample = sampleFlightPoint(result, flightTime);
  const isActive = phase !== "idle" && phase !== "countdown";
  const visualFlightProgress = isActive ? Math.min(1, Math.max(0, (clock - 2) / 5.2)) : 0;
  const easedVisualProgress = 1 - Math.pow(1 - visualFlightProgress, 2.25);
  const physicsAltitudeProgress = Math.min(1, Math.max(0, (sample.altitude ?? 0) / Math.max(result.predictedAltitudeM || 80, 80)));
  const normalizedAltitude = Math.max(physicsAltitudeProgress, easedVisualProgress);
  const currentAltitudeM = Math.max(0, sample.altitude ?? 0);
  const displayCeilingM = Math.max(result.predictedAltitudeM || 0, 1200);
  const sceneAltitudeM = Math.max(currentAltitudeM, easedVisualProgress * displayCeilingM);
  const atmosphereAltitudeM = Math.max(currentAltitudeM, normalizedAltitude * displayCeilingM);
  const skyDarkness = Math.min(0.72, Math.max(0, (atmosphereAltitudeM - 1000) / 9000) * 0.72);
  const starOpacity = Math.min(0.88, Math.max(0, (atmosphereAltitudeM - 10000) / 4200) * 0.88);
  const altitudeAxisStepM = displayCeilingM <= 1600 ? 250 : displayCeilingM <= 5000 ? 500 : displayCeilingM <= 18000 ? 1000 : 5000;
  const visibleAltitudeSpanM = altitudeAxisStepM * 4.8;
  const markerBaseM = Math.floor(sceneAltitudeM / altitudeAxisStepM) * altitudeAxisStepM;
  const altitudeMarkers = Array.from({ length: 13 }, (_, index) => markerBaseM + (index - 5) * altitudeAxisStepM).filter((marker) => marker >= 0);
  const parachuteProgress = phase === "parachute" ? Math.min(1, Math.max(0, (clock - 7.2) / 2)) : phase === "complete" ? 1 : 0;
  const descentPx = parachuteProgress * 92;
  const railProgress = phase === "ignition" ? 0 : phase === "rail" ? Math.min(1, (clock - 2.45) / 0.75) : phase === "ascent" || phase === "coast" || phase === "parachute" || phase === "complete" ? 1 : 0;
  const liftPx = isActive ? 24 + railProgress * 170 + normalizedAltitude * 820 - descentPx : 0;
  const windDriftM = sample.lateralDrift ?? 0;
  const driftPx = isActive ? clamp(windDriftM * 18, -620, 620) : 0;
  const flightPathAngle = isActive ? clamp(sample.angleDeg ?? 0, -84, 84) : 0;
  const cameraLift = isActive ? Math.min(620, normalizedAltitude * 820) : 0;
  const farCloudDrop = isActive ? normalizedAltitude * 260 : 0;
  const groundDrop = isActive ? normalizedAltitude * 460 : 0;
  const countdown = Math.max(0, 2 - clock);
  const isThrusting = (phase === "ignition" || phase === "rail" || phase === "ascent") && (sample.thrust ?? 0) > 0;
  const plumeScale = isThrusting ? Math.min(1.9, Math.max(0.25, (sample.thrust ?? 0) / Math.max(result.averageThrustN, 1))) : 0;
  const rocketSvgTransform = `translate(${driftPx.toFixed(1)} ${(-liftPx).toFixed(1)}) rotate(${flightPathAngle.toFixed(1)})`;
  const trajectoryPath = `M772 ${(690 + cameraLift).toFixed(1)} C${(772 + driftPx * 0.18).toFixed(1)} ${(610 + cameraLift - liftPx * 0.25).toFixed(1)} ${(772 + driftPx * 0.62).toFixed(1)} ${(560 + cameraLift - liftPx * 0.65).toFixed(1)} ${(772 + driftPx).toFixed(1)} ${(534 + cameraLift - liftPx).toFixed(1)}`;
  const windOptions = Array.from({ length: 16 }, (_, index) => index);
  const selectedWindOption = Number.isInteger(windSpeedMps) && windSpeedMps >= 0 && windSpeedMps <= 15 ? String(windSpeedMps) : "custom";
  const stabilityWindNote = result.tumbleTimeS ? `Tumble predicted near T+${result.tumbleTimeS}s` : windSpeedMps > 0 && result.stabilityMargin < 1.5 ? "Low margin: wind can bend the trajectory" : windSpeedMps > 0 ? "Nose follows computed flight-path angle" : "Calm wind setting";
  const windArrowLength = clamp(60 + windSpeedMps * 15, 60, 290);
  const status =
    phase === "countdown" ? "Ignition armed" :
    phase === "ignition" ? "Ignition and smoke rise" :
    phase === "rail" ? "Rail departure" :
    phase === "ascent" ? "Powered ascent" :
    phase === "coast" ? "Coast to apogee" :
    phase === "parachute" ? "Apogee reached - parachute deploying" :
    phase === "complete" ? "Recovery descent stabilized" :
    hasMotor ? "Ready on rail" : "Motor required";
  const progress = Math.min(100, Math.max(0, Math.max(flightTime / Math.max(result.flightTimeS, 1), visualFlightProgress) * 100));

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative h-[560px] overflow-hidden bg-[#83bff4]">
        <svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cinematic live rocket launch simulation over a green field">
          <defs>
            <linearGradient id="launchSky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4f9fe5" />
              <stop offset="45%" stopColor="#bfe9ff" />
              <stop offset="72%" stopColor="#f5e4b8" />
              <stop offset="100%" stopColor="#a9d07b" />
            </linearGradient>
            <linearGradient id="fieldGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8ccf67" />
              <stop offset="100%" stopColor="#3f7a37" />
            </linearGradient>
            <linearGradient id="rocketBody" x1="0" x2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#c7d1da" />
              <stop offset="100%" stopColor="#f8fafc" />
            </linearGradient>
            <filter id="launchShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000000" floodOpacity="0.32" />
            </filter>
            <filter id="smokeBlur">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <g transform={`translate(0 ${(cameraLift + farCloudDrop).toFixed(1)})`}>
            <rect width="1600" height="900" fill="url(#launchSky)" />
            <circle cx="198" cy="132" r="54" fill="#fff5b8" opacity="0.98" />
            <g fill="#ffffff" opacity="0.72">
              <ellipse cx="360" cy="156" rx="108" ry="26" />
              <ellipse cx="435" cy="146" rx="60" ry="20" />
              <ellipse cx="1120" cy="210" rx="122" ry="28" opacity="0.58" />
              <ellipse cx="1216" cy="196" rx="78" ry="21" opacity="0.58" />
              <ellipse cx="820" cy="100" rx="88" ry="20" opacity="0.38" />
            </g>
          </g>
          <g transform={`translate(0 ${(cameraLift + groundDrop).toFixed(1)})`}>
            <path d="M0 570 C220 504 410 538 594 494 C824 438 1038 492 1240 444 C1390 408 1498 438 1600 394 V900 H0 Z" fill="#78b35e" />
            <path d="M0 650 C260 584 520 632 760 566 C1018 494 1276 586 1600 510 V900 H0 Z" fill="url(#fieldGrad)" />
            <path d="M0 750 C264 690 472 766 742 692 C1000 620 1300 696 1600 650 V900 H0 Z" fill="#356b35" opacity="0.58" />
            <g opacity="0.42" stroke="#e7ffd5" strokeWidth="1.6">
              {Array.from({ length: 36 }, (_, i) => <path key={i} d={`M${i * 58 - 60} 900 C${i * 58 + 8} 800 ${i * 58 + 42} 728 ${i * 58 + 116} 632`} />)}
            </g>

            <g transform="translate(756 278)">
              <rect x="0" y="58" width="8" height="400" rx="4" fill="#263241" opacity="0.86" />
              {Array.from({ length: 8 }, (_, i) => <rect key={i} x="-30" y={92 + i * 45} width="68" height="7" rx="2" fill="#475569" />)}
              <path d="M-48 458 H82 L126 500 H-86 Z" fill="#334155" opacity="0.8" />
            </g>
            <g transform="translate(620 690)">
              <rect x="0" y="34" width="278" height="32" rx="7" fill="#3d4957" />
              <rect x="40" y="0" width="198" height="44" rx="7" fill="#cbd5e1" opacity="0.72" />
              <rect x="66" y="-10" width="148" height="14" rx="4" fill="#94a3b8" opacity="0.75" />
            </g>

            {isActive ? (
              <g filter="url(#smokeBlur)" opacity={Math.min(0.9, 0.34 + plumeScale * 0.26)}>
                <ellipse cx="776" cy="720" rx={82 + plumeScale * 70} ry="38" fill="#eef2f7" opacity="0.66" />
                <ellipse cx="706" cy="745" rx={62 + plumeScale * 40} ry="30" fill="#d8dde4" opacity="0.48" />
                <ellipse cx="856" cy="752" rx={72 + plumeScale * 48} ry="34" fill="#f8fafc" opacity="0.44" />
                <ellipse cx="780" cy="780" rx={120 + plumeScale * 70} ry="42" fill="#cbd5e1" opacity="0.34" />
              </g>
            ) : null}
          </g>

          <rect width="1600" height="900" fill="#020617" opacity={skyDarkness.toFixed(2)} />
          <g transform="translate(116 160)" opacity={windSpeedMps > 0 ? 0.86 : 0.32}>
            <line x1="0" x2={windArrowLength} y1="0" y2="0" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeDasharray="14 12" />
            <path d={`M${windArrowLength} 0 L${windArrowLength - 22} -13 L${windArrowLength - 22} 13 Z`} fill="#ffffff" />
            <text x="0" y="-22" fill="#ffffff" fontSize="22" fontWeight="700">Wind {windSpeedMps.toFixed(1)} m/s</text>
          </g>
          <g opacity={starOpacity.toFixed(2)} fill="#ffffff">
            {Array.from({ length: 44 }, (_, index) => {
              const cx = (index * 137) % 1580 + 10;
              const cy = (index * 83) % 430 + 22;
              const radius = index % 7 === 0 ? 2.4 : index % 3 === 0 ? 1.7 : 1.1;
              return <circle key={index} cx={cx} cy={cy} r={radius} opacity={index % 5 === 0 ? 0.95 : 0.62} />;
            })}
          </g>

          <g pointerEvents="none">
            {altitudeMarkers.map((marker) => {
              const y = 690 - ((marker - sceneAltitudeM) / visibleAltitudeSpanM) * 620;
              if (y < 76 || y > 820) return null;
              const isMajor = marker % 1000 === 0;
              const isCurrentBand = Math.abs(marker - sceneAltitudeM) < altitudeAxisStepM * 0.38;
              const label = marker >= 1000 ? `${Number((marker / 1000).toFixed(marker % 1000 === 0 ? 0 : 1))} km` : `${marker} m`;
              return (
                <g key={marker} opacity={isCurrentBand ? 0.78 : 0.48}>
                  <line x1="86" x2="1514" y1={y} y2={y} stroke="#ffffff" strokeDasharray={isMajor ? "12 12" : "5 14"} strokeWidth={isMajor ? 1.8 : 1.1} />
                  <rect x="96" y={y - 16} width={marker >= 1000 ? 70 : 62} height="26" rx="6" fill="#020617" opacity="0.42" />
                  <text x="112" y={y + 3} fill="#ffffff" fontSize="18" fontWeight={isMajor ? 700 : 500}>{label}</text>
                </g>
              );
            })}
            <line x1="1434" x2="1434" y1="82" y2="818" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2" />
            <text x="1456" y="112" fill="#ffffff" fontSize="20" fontWeight="700" opacity="0.82">Altitude</text>
          </g>

          {isActive ? <path d={trajectoryPath} fill="none" stroke="#fef3c7" strokeWidth="4" strokeDasharray="14 13" strokeLinecap="round" opacity="0.72" /> : null}
          <g transform={`translate(772 ${(534 + cameraLift).toFixed(1)}) ${rocketSvgTransform}`} filter="url(#launchShadow)">
            <g transform="translate(0 -122)">
              <CadRocketLaunchSvg components={components} height={238} />
              {isThrusting ? (
                <g transform="translate(0 238)">
                  <path d={`M0 0 C${-20 * plumeScale} 36 ${-14 * plumeScale} 94 0 ${136 * plumeScale} C${15 * plumeScale} 94 ${22 * plumeScale} 36 0 0 Z`} fill="#fb923c" opacity="0.95" />
                  <path d={`M0 5 C${-9 * plumeScale} 34 ${-5 * plumeScale} 70 0 ${96 * plumeScale} C${7 * plumeScale} 70 ${10 * plumeScale} 34 0 5 Z`} fill="#fff7ad" opacity="0.96" />
                  <ellipse cx="0" cy={92 * plumeScale} rx={20 * plumeScale} ry={8 * plumeScale} fill="#ef4444" opacity="0.4" />
                </g>
              ) : null}
            </g>
            {parachuteProgress > 0 ? (
              <g transform={`translate(0 ${(-178 - parachuteProgress * 34).toFixed(1)}) scale(${parachuteProgress.toFixed(2)})`} opacity={parachuteProgress}>
                <path d="M-94 20 C-72 -56 72 -56 94 20 C56 3 28 0 0 20 C-28 0 -56 3 -94 20 Z" fill="#f97316" stroke="#fff7ed" strokeWidth="5" />
                <path d="M-94 20 C-52 -6 -26 -8 0 20 C26 -8 52 -6 94 20" fill="none" stroke="#fed7aa" strokeWidth="3" opacity="0.9" />
                <path d="M-74 22 L-7 116 M0 22 L0 118 M74 22 L7 116" stroke="#f8fafc" strokeWidth="2.2" opacity="0.9" />
                <rect x="-10" y="110" width="20" height="18" rx="4" fill="#94a3b8" opacity="0.95" />
              </g>
            ) : null}
          </g>
          {isThrusting ? <path d={`M772 ${(690 + cameraLift).toFixed(1)} C760 ${(748 + cameraLift).toFixed(1)} 790 ${(804 + cameraLift).toFixed(1)} 772 ${(870 + cameraLift).toFixed(1)}`} stroke="#f8fafc" strokeOpacity="0.35" strokeWidth="12" fill="none" filter="url(#smokeBlur)" /> : null}
        </svg>

        {phase === "countdown" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <div className="rounded-lg border border-white/25 bg-black/40 px-7 py-5 text-center text-white shadow-2xl backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Ignition sequence</p>
              <p className="mt-1 text-6xl font-semibold">{countdown.toFixed(1)}</p>
              <p className="mt-1 text-xs text-white/70">Hold-down release at T+2.0</p>
            </div>
          </div>
        ) : null}

        {!hasMotor && phase === "idle" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <div className="rounded-lg border border-white/15 bg-black/35 px-5 py-3 text-sm text-orange-50/80 backdrop-blur">Select a motor, then run rocket simulation to launch.</div>
          </div>
        ) : null}

        <div className="absolute left-4 top-4 rounded-md border border-white/25 bg-black/35 p-3 text-xs text-white shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Live launch simulation</p>
              <p className="mt-1 text-white/70">{status}</p>
            </div>
            <Button size="sm" onClick={onRun} disabled={!hasMotor} className="bg-orange-300 text-[#130d08] hover:bg-orange-200">
              <Play className="h-4 w-4" />{phase === "idle" ? "Run" : "Rerun"}
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
            <label className="text-white/72">
              Wind preset
              <select
                value={selectedWindOption}
                onChange={(event) => {
                  if (event.target.value !== "custom") setWindSpeedMps(Number(event.target.value));
                }}
                className="mt-1 w-full rounded-md border border-white/18 bg-black/45 px-2 py-1 text-white"
              >
                {windOptions.map((option) => <option key={option} value={option}>{option} m/s</option>)}
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-white/72">
              Wind speed
              <input
                type="number"
                min="0"
                max="40"
                step="0.1"
                value={Number(windSpeedMps.toFixed(1))}
                onChange={(event) => setWindSpeedMps(clamp(Number(event.target.value) || 0, 0, 40))}
                className="mt-1 w-full rounded-md border border-white/18 bg-black/45 px-2 py-1 text-white"
              />
            </label>
            <p className="sm:col-span-2 rounded bg-white/10 px-2 py-1 text-white/78">{stabilityWindNote}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <span className="rounded bg-white/12 px-2 py-1">T+ {phase === "countdown" ? "0.0" : flightTime.toFixed(1)}s</span>
            <span className="rounded bg-white/12 px-2 py-1">{Math.round(sample.altitude ?? 0)} m</span>
            <span className="rounded bg-white/12 px-2 py-1">{Math.round(sample.velocity ?? 0)} m/s</span>
            <span className="rounded bg-white/12 px-2 py-1">{Math.round(Math.abs(windDriftM))} m drift</span>
            <span className="rounded bg-white/12 px-2 py-1">{Math.round(flightPathAngle)} deg path</span>
            <span className="rounded bg-white/12 px-2 py-1">{windSpeedMps.toFixed(1)} m/s wind</span>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 rounded-md border border-white/25 bg-black/35 p-3 text-xs text-white shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span>2s ignition delay - thrust-curve playback</span>
            <span>{Math.round(progress)}% flight timeline</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-orange-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function CadRocketLaunchSvg({ components, height }: { components: RocketComponent[]; height: number }) {
  const sorted = sortComponents(components);
  const length = Math.max(totalLength(sorted), 1);
  const maxDiameter = Math.max(...sorted.map((component) => component.diameter), 1);
  const bodyWidth = Math.max(18, Math.min(56, (maxDiameter / length) * height * 2.2));
  const scaleY = height / length;
  const bodyComponents = sorted.filter((component) => !["fins", "rail_buttons", "motor_nozzle", "motor_mount", "centering_rings", "bulkhead", "coupler"].includes(component.type));
  const fins = sorted.find((component) => component.type === "fins");
  const nozzle = sorted.find((component) => component.type === "motor_nozzle") ?? sorted.find((component) => component.type === "motor_mount");

  function yFor(position: number) {
    return position * scaleY;
  }

  function hFor(component: RocketComponent) {
    return Math.max(component.length * scaleY, 2);
  }

  function widthFor(component: RocketComponent) {
    return Math.max(8, Math.min(bodyWidth, (component.diameter / maxDiameter) * bodyWidth));
  }

  return (
    <g>
      {bodyComponents.map((component) => {
        const y = yFor(component.position);
        const h = hFor(component);
        const w = widthFor(component);
        if (component.type === "nose_cone") {
          return (
            <path
              key={component.id}
              d={`M0 ${y} C${-w * 0.54} ${y + h * 0.36} ${-w * 0.5} ${y + h * 0.82} ${-w / 2} ${y + h} H${w / 2} C${w * 0.5} ${y + h * 0.82} ${w * 0.54} ${y + h * 0.36} 0 ${y} Z`}
              fill="#f8fafc"
              stroke="#64748b"
              strokeWidth="1.6"
            />
          );
        }
        const fill = component.type === "payload_section" ? "#dbeafe" : component.type === "recovery_bay" ? "#fde68a" : "#f8fafc";
        return <rect key={component.id} x={-w / 2} y={y} width={w} height={h + 0.8} rx="4" fill={fill} stroke="#64748b" strokeWidth="1.4" />;
      })}

      {fins ? (
        <g>
          {[-1, 1].map((side) => {
            const yRoot = yFor(fins.position);
            const planform = getFinPlanformPoints(fins);
            const maxSpan = Math.max(...planform.map((point) => point.y), 1);
            const span = Math.max(14, Math.min(46, ((fins.finSpan ?? fins.diameter) / maxDiameter) * bodyWidth * 0.86));
            const attachX = side * bodyWidth * 0.43;
            const path = planform.map((point, index) => {
              const axialY = yRoot + point.x * scaleY;
              const radialX = side * (bodyWidth * 0.43 + (point.y / maxSpan) * span);
              const x = Math.abs(point.y) < 0.01 ? attachX : radialX;
              return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${axialY.toFixed(1)}`;
            }).join(" ");
            return (
              <path
                key={side}
                d={`${path} Z`}
                fill="#ef4444"
                stroke="#7f1d1d"
                strokeWidth="1.2"
              />
            );
          })}
        </g>
      ) : null}

      {nozzle ? (
        <g>
          <rect x={-bodyWidth * 0.26} y={height - 4} width={bodyWidth * 0.52} height="5" rx="1.5" fill="#64748b" stroke="#1f2937" strokeWidth="1" />
          <path d={`M${-bodyWidth * 0.22} ${height + 1} C${-bodyWidth * 0.12} ${height + 6} ${-bodyWidth * 0.08} ${height + 9} 0 ${height + 9} C${bodyWidth * 0.08} ${height + 9} ${bodyWidth * 0.12} ${height + 6} ${bodyWidth * 0.22} ${height + 1} Z`} fill="#d6d2c8" stroke="#334155" strokeWidth="1" />
          <path d={`M0 ${height + 9} L${bodyWidth * 0.32} ${height + 23} H${-bodyWidth * 0.32} Z`} fill="#1f2937" stroke="#0f172a" strokeWidth="1.2" />
          <rect x={-bodyWidth * 0.06} y={height + 7} width={bodyWidth * 0.12} height="6" rx="1.5" fill="#020617" stroke="#94a3b8" strokeOpacity="0.35" />
        </g>
      ) : null}
      <line x1="0" x2="0" y1={height * 0.22} y2={height * 0.88} stroke="#94a3b8" strokeOpacity="0.45" strokeWidth="2" />
    </g>
  );
}

function sampleFlightPoint(result: SimulationResult, time: number) {
  const series = result.timeSeries;
  if (!series.length) return { time: 0, altitude: 0, velocity: 0, thrust: 0 };
  if (time <= series[0].time) return series[0];
  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1];
    const next = series[i];
    if (time <= next.time) {
      const span = Math.max(next.time - previous.time, 0.001);
      const mix = (time - previous.time) / span;
      return {
        time,
        altitude: (previous.altitude ?? 0) + ((next.altitude ?? 0) - (previous.altitude ?? 0)) * mix,
        lateralDrift: (previous.lateralDrift ?? 0) + ((next.lateralDrift ?? 0) - (previous.lateralDrift ?? 0)) * mix,
        angleDeg: (previous.angleDeg ?? 0) + ((next.angleDeg ?? 0) - (previous.angleDeg ?? 0)) * mix,
        velocity: (previous.velocity ?? 0) + ((next.velocity ?? 0) - (previous.velocity ?? 0)) * mix,
        thrust: (previous.thrust ?? 0) + ((next.thrust ?? 0) - (previous.thrust ?? 0)) * mix
      };
    }
  }
  return series[series.length - 1];
}

function RocketCADWorkspace({ components, updateComponent, addPayloadBay, selectedComponentId }: { components: RocketComponent[]; updateComponent: (id: string, patch: Partial<RocketComponent>) => void; addPayloadBay: () => void; selectedComponentId?: string }) {
  const editable = components.filter((component) => ["nose_cone", "body_tube", "fins", "recovery_bay", "payload_section", "motor_mount", "rail_buttons"].includes(component.type));
  const primaryComponents = editable.filter((component) => !["fins", "motor_mount", "rail_buttons"].includes(component.type));
  const finComponent = editable.find((component) => component.type === "fins");
  const motorMount = editable.find((component) => component.type === "motor_mount");
  const launchGuide = editable.find((component) => component.type === "rail_buttons");
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Editable rocket components</h2>
          <p className="mt-1 text-sm text-orange-50/58">Update CAD parameters, then run simulation again to see mass, CG, CP, and altitude change.</p>
        </div>
        <Button variant="outline" onClick={addPayloadBay}><Boxes className="h-4 w-4" />Add payload bay</Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {primaryComponents.map((component) => <ComponentEditCard key={component.id} component={component} updateComponent={updateComponent} highlight={component.id === selectedComponentId} />)}
      </div>
      <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-orange-50">Motor mount and launch guide</h3>
              <p className="mt-1 text-xs text-orange-50/48">Compact aft hardware controls motor fit and rail/lug alignment.</p>
            </div>
            <span className="shrink-0 rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-orange-50/50">aft hardware</span>
          </div>
          <div className="mt-3 grid gap-3">
            {motorMount ? <ComponentEditCard component={motorMount} updateComponent={updateComponent} compact highlight={motorMount.id === selectedComponentId} /> : null}
            {launchGuide ? <ComponentEditCard component={launchGuide} updateComponent={updateComponent} compact highlight={launchGuide.id === selectedComponentId} /> : null}
          </div>
        </div>
        {finComponent ? (
          <ComponentEditCard component={finComponent} updateComponent={updateComponent} highlight={finComponent.id === selectedComponentId}>
            <FinShapeDesigner component={finComponent} updateComponent={updateComponent} />
          </ComponentEditCard>
        ) : null}
      </div>
    </Card>
  );
}

function ComponentEditCard({ component, updateComponent, compact = false, highlight = false, children }: { component: RocketComponent; updateComponent: (id: string, patch: Partial<RocketComponent>) => void; compact?: boolean; highlight?: boolean; children?: ReactNode }) {
  return (
    <div className={`rounded-lg border ${highlight ? "border-orange-200/55 bg-orange-200/[0.07]" : "border-white/10 bg-white/[0.04]"} ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center justify-between gap-2">
        <input value={component.name} onChange={(event) => updateComponent(component.id, { name: event.target.value })} className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold text-orange-50" />
        <span className="shrink-0 rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-orange-50/50">{componentFriendlyName[component.type]}</span>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-3"}`}>
        {(["length", "diameter", "mass", "position"] as const).map((field) => (
          <label key={field} className="text-[11px] text-orange-50/48">{field}
            <input type="number" value={component[field]} onChange={(event) => updateComponent(component.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-white/10 bg-[#111521] px-2 py-1 text-xs text-orange-50" />
          </label>
        ))}
        {component.type === "fins" ? (["finRootChord", "finTipChord", "finSpan", "finSweep", "finCount"] as const).map((field) => (
          <label key={field} className="text-[11px] text-orange-50/48">{field.replace("fin", "")}
            <input type="number" value={component[field] ?? 0} onChange={(event) => updateComponent(component.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-white/10 bg-[#111521] px-2 py-1 text-xs text-orange-50" />
          </label>
        )) : null}
      </div>
      {children}
    </div>
  );
}

function ComponentSpecificControls({ component, updateComponent }: { component: RocketComponent; updateComponent: (id: string, patch: Partial<RocketComponent>) => void }) {
  if (component.type === "nose_cone") {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Nose cone shape</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConfigSelect label="Shape" value={component.noseShape ?? "Ogive"} options={["Ogive", "Conical", "Elliptical", "Haack", "Parabolic"]} onChange={(value) => updateComponent(component.id, { noseShape: value as RocketComponent["noseShape"] })} />
          <ConfigNumber label="Shape parameter" value={component.shapeParameter ?? 1} onChange={(value) => updateComponent(component.id, { shapeParameter: value })} />
          <ConfigNumber label="Base diameter" value={component.diameter} onChange={(value) => updateComponent(component.id, { diameter: value })} suffix="mm" />
          <ConfigNumber label="Wall thickness" value={component.wallThickness} onChange={(value) => updateComponent(component.id, { wallThickness: value })} suffix="mm" />
        </div>
        <p className="mt-3 rounded-md bg-black/15 p-2 text-xs leading-5 text-orange-50/58">Ogive uses a smooth tangent profile cue; conical transitions use straight sides. These are CAD parameters, not manufacturing instructions.</p>
      </div>
    );
  }

  if (component.type === "body_tube") {
    const inner = Math.max(0, component.diameter - component.wallThickness * 2);
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Body tube</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConfigNumber label="Outer diameter" value={component.diameter} onChange={(value) => updateComponent(component.id, { diameter: value })} suffix="mm" />
          <ConfigNumber label="Inner diameter" value={inner} onChange={(value) => updateComponent(component.id, { wallThickness: Math.max(0, (component.diameter - value) / 2) })} suffix="mm" />
          <ConfigNumber label="Wall thickness" value={component.wallThickness} onChange={(value) => updateComponent(component.id, { wallThickness: value })} suffix="mm" />
          <ConfigSelect label="Component finish" value={component.finish ?? "Regular paint"} options={["Bare tube", "Regular paint", "Smooth paint", "Polished composite"]} onChange={(value) => updateComponent(component.id, { finish: value })} />
        </div>
      </div>
    );
  }

  if (component.type === "transition") {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Transition</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConfigSelect label="Transition shape" value={component.noseShape ?? "Conical"} options={["Conical", "Ogive", "Elliptical", "Parabolic"]} onChange={(value) => updateComponent(component.id, { noseShape: value as RocketComponent["noseShape"] })} />
          <ConfigNumber label="Shape parameter" value={component.shapeParameter ?? 0} onChange={(value) => updateComponent(component.id, { shapeParameter: value })} />
          <ConfigNumber label="Fore diameter" value={component.foreDiameter ?? component.diameter} onChange={(value) => updateComponent(component.id, { foreDiameter: value })} suffix="mm" />
          <ConfigNumber label="Aft diameter" value={component.aftDiameter ?? component.diameter} onChange={(value) => updateComponent(component.id, { aftDiameter: value })} suffix="mm" />
        </div>
      </div>
    );
  }

  if (component.type === "fins") {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Fin set placement and tabs</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConfigNumber label="Fin cant" value={component.finCantDeg ?? 0} onChange={(value) => updateComponent(component.id, { finCantDeg: value })} suffix="deg" />
          <ConfigNumber label="Fin rotation" value={component.finRotationDeg ?? 0} onChange={(value) => updateComponent(component.id, { finRotationDeg: value })} suffix="deg" />
          <ConfigSelect label="Cross section" value={component.finCrossSection ?? "Square"} options={["Square", "Rounded", "Airfoil"]} onChange={(value) => updateComponent(component.id, { finCrossSection: value as RocketComponent["finCrossSection"] })} />
          <ConfigNumber label="Root fillet radius" value={component.finFilletRadius ?? 0} onChange={(value) => updateComponent(component.id, { finFilletRadius: value })} suffix="mm" />
        </div>
      </div>
    );
  }

  if (["motor_mount", "centering_rings", "bulkhead", "coupler", "engine_block"].includes(component.type)) {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Inner component placement</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConfigSelect label="Position relative to" value={component.positionReference ?? "Bottom of parent"} options={["Top of parent", "Bottom of parent", "Absolute"]} onChange={(value) => updateComponent(component.id, { positionReference: value as RocketComponent["positionReference"] })} />
          <ConfigNumber label="Plus offset" value={component.position} onChange={(value) => updateComponent(component.id, { position: value })} suffix="mm" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-sm font-semibold">Component notes</p>
      <p className="mt-2 text-xs leading-5 text-orange-50/56">This component participates in mass, CG, and flight package metadata. Detailed geometry controls can be expanded as this module matures.</p>
    </div>
  );
}

function ConfigNumber({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="text-xs text-orange-50/58">{label}
      <div className="mt-1 flex items-center gap-2">
        <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-md border border-white/10 bg-[#111521] px-2 py-1 text-xs text-orange-50" />
        {suffix ? <span className="text-[10px] text-orange-50/38">{suffix}</span> : null}
      </div>
    </label>
  );
}

function ConfigSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="text-xs text-orange-50/58">{label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#111521] px-2 py-1 text-xs text-orange-50">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FinShapeDesigner({ component, updateComponent }: { component: RocketComponent; updateComponent: (id: string, patch: Partial<RocketComponent>) => void }) {
  const root = component.finRootChord ?? component.length;
  const span = component.finSpan ?? component.diameter;
  const width = 260;
  const height = 150;
  const rawPoints = getFinPlanformPoints(component);
  const maxX = Math.max(...rawPoints.map((point) => point.x), root, 1);
  const minX = Math.min(...rawPoints.map((point) => point.x), 0);
  const maxY = Math.max(...rawPoints.map((point) => point.y), span, 1);
  const scaleX = width / Math.max(maxX - minX, 1);
  const scaleY = height / Math.max(maxY, 1);
  const points = rawPoints.map((point) => [16 + (point.x - minX) * scaleX, height + 10 - point.y * scaleY]);
  const polygon = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const editablePoints = component.finFreeformPoints?.length ? component.finFreeformPoints : defaultFreeformFinPoints;

  function updateFreeformPoint(index: number, axis: "x" | "y", value: number) {
    const next = editablePoints.map((point, pointIndex) => pointIndex === index ? { ...point, [axis]: Math.round(value) } : point);
    updateComponent(component.id, { finPlanform: "Freeform", finFreeformPoints: next });
  }

  return (
    <div className="mt-4 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.04] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-100">Fin shape first</p>
          <p className="mt-1 text-xs text-orange-50/55">Choose a familiar planform, or use Freeform vertices to sketch a custom fin outline before refining dimensions.</p>
        </div>
        <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-orange-50/45">planform preview</span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[230px_1fr]">
        <svg viewBox="0 0 292 178" className="h-44 w-full rounded-md border border-white/10 bg-[#070a12]">
          <line x1="16" x2="276" y1={height + 10} y2={height + 10} stroke="#f4d399" strokeOpacity="0.38" />
          <polygon points={polygon} fill="#5fb8ff" fillOpacity="0.72" stroke="#bae6fd" strokeWidth="2" />
          {component.finPlanform === "Freeform" ? points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4" fill="#fed7aa" stroke="#020617" strokeWidth="1.5" />) : null}
          <text x="16" y="172" fill="#f4d399" fontSize="10">root/chord axis</text>
          <text x="206" y="40" fill="#bae6fd" fontSize="10">span</text>
          <text x="18" y="18" fill="#bae6fd" fontSize="10">{component.finPlanform ?? "Trapezoidal"}</text>
        </svg>
        <div className="grid gap-2 sm:grid-cols-2">
          {finShapePresets.map((preset) => (
            <button key={preset.name} type="button" onClick={() => updateComponent(component.id, preset.patch)} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left text-xs transition hover:border-orange-200/35 hover:bg-white/[0.07]">
              <span className="font-semibold text-orange-50">{preset.name}</span>
              <span className="mt-1 block text-orange-50/50">{preset.note}</span>
            </button>
          ))}
        </div>
      </div>
      {component.finPlanform === "Freeform" ? (
        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-cyan-100">Freeform vertices</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => updateComponent(component.id, { finFreeformPoints: [...editablePoints, { x: root * 0.5, y: span * 0.5 }] })} className="rounded border border-white/10 px-2 py-1 text-[11px] text-orange-50/70">Add point</button>
              <button type="button" onClick={() => updateComponent(component.id, { finFreeformPoints: defaultFreeformFinPoints })} className="rounded border border-white/10 px-2 py-1 text-[11px] text-orange-50/70">Reset</button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {editablePoints.map((point, index) => (
              <div key={index} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                <div className="mb-2 flex items-center justify-between text-[11px] text-orange-50/45">
                  <span>Point {index + 1}</span>
                  {editablePoints.length > 4 ? <button type="button" onClick={() => updateComponent(component.id, { finFreeformPoints: editablePoints.filter((_, pointIndex) => pointIndex !== index) })}>Remove</button> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-orange-50/55">x mm<input type="number" value={Math.round(point.x)} onChange={(event) => updateFreeformPoint(index, "x", Number(event.target.value) || 0)} className="mt-1 w-full rounded bg-[#0f1420] px-2 py-1 text-orange-50" /></label>
                  <label className="text-[11px] text-orange-50/55">span mm<input type="number" min="0" value={Math.round(point.y)} onChange={(event) => updateFreeformPoint(index, "y", Number(event.target.value) || 0)} className="mt-1 w-full rounded bg-[#0f1420] px-2 py-1 text-orange-50" /></label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MotorParameterPanel({ parameters, update, runSimulation }: { parameters: MotorParameters; update: <K extends keyof MotorParameters>(key: K, value: MotorParameters[K]) => void; runSimulation: () => void }) {
  const validationIssues = validateMotorInputs(parameters);
  const grainMode = parameters.grainConfiguration ?? "BATES";
  const mainFields: Array<[keyof MotorParameters, string, string, string]> = [
    ["casingInnerDiameterMm", "Combustion chamber diameter", "mm", "Inside case / liner clearance"],
    ["nozzleThroatMm", "Throat diameter", "mm", "Used for Kn and pressure estimate"],
    ["casingLengthMm", "Combustion chamber length", "mm", "From forward bulkhead to throat"],
    ["dryMassG", "Dry hardware mass", "g", "Case, closures, nozzle, retention"]
  ];
  const grainFields: Array<[keyof MotorParameters, string, string]> = [
    ["grainOuterDiameterMm", "Grain outer diameter", "mm"],
    ["coreDiameterMm", "Grain core diameter", "mm"],
    ["grainLengthMm", "Grain segment length", "mm"],
    ["grainCount", "Number of segments", ""]
  ];
  const cSlotFields: Array<[keyof MotorParameters, string, string]> = [
    ["slotOffsetMm", "Slot offset", "mm"],
    ["slotWidthMm", "Slot width", "mm"],
    ["slotDepthMm", "Slot depth", "mm"]
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-orange-200" />Motor input deck</h2>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-1 text-xs">
          <span className="rounded bg-cyan-200/15 px-2 py-1 text-cyan-100">Metric</span>
          <span className="px-2 py-1 text-orange-50/42">Imperial</span>
        </div>
      </div>
      <label className="mt-4 block text-sm text-orange-50/65">Motor project name<input value={parameters.projectName} onChange={(event) => update("projectName", event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" /></label>
      <label className="mt-4 block text-sm text-orange-50/65">Propellant profile<select value={parameters.propellantProfileName} onChange={(event) => update("propellantProfileName", event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-orange-50">{propellantProfiles.map((profile) => <option key={profile}>{profile}</option>)}</select><span className="mt-1 block text-[11px] text-orange-50/42">Public metadata profile only. Exact formulation and process notes are intentionally excluded.</span></label>
      <div className="mt-4 rounded-lg border border-orange-200/15 bg-orange-300/[0.04] p-3">
        <p className="text-sm font-semibold text-orange-100">Geometry first</p>
        <p className="mt-1 text-xs text-orange-50/55">Start from a known motor size, then tune chamber, grain stack, core, and nozzle values.</p>
        <div className="mt-3 grid gap-2">
          {motorGeometryPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                Object.entries(preset.values).forEach(([key, value]) => update(key as keyof MotorParameters, value as never));
              }}
              className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left text-xs transition hover:border-orange-200/35 hover:bg-white/[0.07]"
            >
              <span className="font-semibold text-orange-50">{preset.name}</span>
              <span className="mt-1 block text-orange-50/50">{preset.note}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {mainFields.map(([key, label, unit, help]) => (
          <label key={key} className="text-xs text-orange-50/58">{label}
            <input type="number" value={parameters[key] as number} onChange={(event) => update(key, Number(event.target.value) as never)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50" />
            {unit ? <span className="mt-1 block text-[10px] text-orange-50/40">{unit}</span> : null}
            <span className="mt-1 block text-[10px] text-orange-50/36">{help}</span>
          </label>
        ))}
      </div>
      <label className="mt-4 block text-sm text-orange-50/65">Grain configuration<select value={grainMode} onChange={(event) => update("grainConfiguration", event.target.value as never)} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-orange-50">{grainGeometryModes.map(([name]) => <option key={name}>{name}</option>)}</select></label>
      <p className="mt-2 text-xs leading-5 text-orange-50/48">{grainGeometryModes.find(([name]) => name === grainMode)?.[1]}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {grainFields.map(([key, label, unit]) => (
          <label key={key} className="text-xs text-orange-50/58">{label}
            <input type="number" value={parameters[key] as number} onChange={(event) => update(key, Number(event.target.value) as never)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50" />
            {unit ? <span className="mt-1 block text-[10px] text-orange-50/40">{unit}</span> : null}
          </label>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["coreSurface", "outerSurface", "endsSurface"] as const).map((key) => (
          <label key={key} className="text-xs text-orange-50/58">{key.replace("Surface", " surface")}
            <select value={parameters[key] ?? (key === "outerSurface" ? "Inhibited" : "Exposed")} onChange={(event) => update(key, event.target.value as never)} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-2 py-2 text-xs text-orange-50">
              {surfaceOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      {grainMode === "C-slot" ? (
        <div className="mt-4 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.05] p-3">
          <p className="text-sm font-semibold text-cyan-100">C-slot parameters</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {cSlotFields.map(([key, label, unit]) => (
              <label key={key} className="text-xs text-orange-50/58">{label}
                <input type="number" value={(parameters[key] as number | undefined) ?? 0} onChange={(event) => update(key, Number(event.target.value) as never)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-orange-50" />
                <span className="mt-1 block text-[10px] text-orange-50/40">{unit}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(["casingOuterDiameterMm", "nozzleExitMm", "expansionRatio"] as const).map((key) => (
          <label key={key} className="text-xs text-orange-50/58">{key === "casingOuterDiameterMm" ? "Case outer diameter" : key === "nozzleExitMm" ? "Nozzle exit diameter" : "Expansion ratio"}
            <input type="number" value={parameters[key] as number} onChange={(event) => update(key, Number(event.target.value) as never)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50" />
          </label>
        ))}
      </div>
      {validationIssues.length ? (
        <div className="mt-4 space-y-2">
          {validationIssues.map((issue) => <p key={issue} className="rounded-md border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">{issue}</p>)}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-xs text-emerald-100">Inputs pass the pre-computation geometry checks.</p>
      )}
      <Button className="mt-5 w-full" onClick={runSimulation}><Calculator className="h-4 w-4" />Simulate motor</Button>
    </Card>
  );
}

function MotorCrossSectionView({ parameters }: { parameters: MotorParameters }) {
  const grainMode = parameters.grainConfiguration ?? "Hollow cylinder";
  const grainCount = Math.min(5, Math.max(1, Math.round(parameters.grainCount)));
  const grainWidth = 330 / grainCount;
  const throatRadius = Math.min(11, Math.max(4, (parameters.nozzleThroatMm / Math.max(parameters.nozzleExitMm, 1)) * 17));
  const exitRadius = Math.min(34, Math.max(16, (parameters.nozzleExitMm / Math.max(parameters.casingInnerDiameterMm, 1)) * 42));
  const portRadius = Math.min(31, Math.max(8, (parameters.coreDiameterMm / Math.max(parameters.grainOuterDiameterMm, 1)) * 48));
  const isFinocyl = grainMode === "Finocyl" || grainMode === "Star";
  const isCSlot = grainMode === "C-slot";
  const finCount = isFinocyl ? 6 : 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Boxes className="h-5 w-5 text-cyan-200" />Live geometry preview</h2>
          <p className="mt-1 text-sm text-orange-50/58">Side section and cross section update directly from the motor input deck.</p>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-orange-50/70">{grainMode}</span>
      </div>
      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.55fr)_280px]">
        <div className="min-w-0 rounded-lg border border-white/10 bg-slate-50 p-4 text-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Side section</p>
          <svg viewBox="0 0 740 270" role="img" aria-label="Solid rocket motor live side section preview" className="mt-3 h-auto w-full">
            <defs>
              <linearGradient id="liveCase" x1="0" x2="1"><stop offset="0%" stopColor="#425669" /><stop offset="100%" stopColor="#607689" /></linearGradient>
              <linearGradient id="liveGrain" x1="0" x2="1"><stop offset="0%" stopColor="#f8fafc" /><stop offset="48%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#f8fafc" /></linearGradient>
              <linearGradient id="liveNozzle" x1="0" x2="1"><stop offset="0%" stopColor="#94a3b8" /><stop offset="50%" stopColor="#f8fafc" /><stop offset="100%" stopColor="#94a3b8" /></linearGradient>
            </defs>
            <rect x="24" y="64" width="492" height="118" rx="3" fill="url(#liveCase)" />
            <rect x="43" y="80" width="452" height="86" rx="2" fill="#eef2f7" />
            <rect x="58" y="92" width="418" height="62" rx="1" fill="url(#liveGrain)" stroke="#cbd5e1" />
            {Array.from({ length: grainCount }, (_, index) => (
              <line key={index} x1={58 + grainWidth * index} x2={58 + grainWidth * index} y1="92" y2="154" stroke="#94a3b8" strokeOpacity="0.75" />
            ))}
            <rect x="84" y={123 - portRadius / 2} width="374" height={portRadius} rx={portRadius / 2} fill="#334155" />
            <rect x="4" y="86" width="48" height="76" rx="4" fill="#52677a" />
            <rect x="30" y="106" width="36" height="36" fill="#eef2f7" />
            <path d={`M492 89 L532 ${123 - throatRadius} H548 L618 ${123 - exitRadius} M492 157 L532 ${123 + throatRadius} H548 L618 ${123 + exitRadius}`} fill="none" stroke="#64748b" strokeWidth="5" strokeLinejoin="miter" />
            <rect x="532" y={123 - throatRadius} width="18" height={throatRadius * 2} rx="2" fill="#334155" />
            <line x1="618" x2="618" y1={123 - exitRadius} y2={123 + exitRadius} stroke="#64748b" strokeWidth="3" />
            <line x1="24" y1="123" x2="708" y2="123" stroke="#64748b" strokeDasharray="7 7" strokeOpacity="0.4" />
            <text x="24" y="214" fill="#475569" fontSize="15">exit dia {parameters.nozzleExitMm} mm</text>
            <text x="236" y="214" fill="#475569" fontSize="15">{grainCount} grain segment{grainCount > 1 ? "s" : ""}</text>
            <text x="462" y="214" fill="#475569" fontSize="15">{parameters.nozzleThroatMm} mm throat</text>
          </svg>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-50 p-4 text-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cross section</p>
          <svg viewBox="0 0 230 230" role="img" aria-label="Motor grain cross section preview" className="mx-auto mt-4 h-52 w-52">
            <circle cx="115" cy="115" r="92" fill="#52677a" />
            <circle cx="115" cy="115" r="76" fill="#f8fafc" />
            <circle cx="115" cy="115" r="68" fill="#52677a" />
            {isFinocyl ? Array.from({ length: finCount }, (_, index) => {
              const angle = (index / finCount) * 360;
              return <rect key={index} x="109" y="34" width="12" height="84" rx="4" fill="#f8fafc" transform={`rotate(${angle} 115 115)`} />;
            }) : null}
            {isCSlot ? <path d="M115 62 A53 53 0 1 1 80 155" fill="none" stroke="#f8fafc" strokeWidth="18" strokeLinecap="round" /> : null}
            <circle cx="115" cy="115" r={portRadius} fill="#f8fafc" />
            <circle cx="115" cy="115" r={Math.max(3, portRadius - 8)} fill="#52677a" opacity={isFinocyl || isCSlot ? 0 : 1} />
          </svg>
          <div className="mt-2 rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-800">{grainMode}</span> - core {parameters.coreDiameterMm} mm</p>
            <p className="mt-1">Grain OD {parameters.grainOuterDiameterMm} mm - propellant {parameters.propellantProfileName}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 rounded-md border border-amber-200/20 bg-amber-200/8 p-3 text-xs leading-5 text-amber-50/75">
        Visual preview only. Geometry is for simulation and comparison, not fabrication instruction or motor safety certification.
      </p>
    </Card>
  );
}
function Motor3DViewer({ parameters }: { parameters: MotorParameters }) {
  const lengthPx = Math.min(620, Math.max(260, parameters.casingLengthMm * 1.15));
  const diameterPx = Math.min(120, Math.max(58, parameters.casingOuterDiameterMm * 1.35));
  const portScale = Math.min(0.72, Math.max(0.18, parameters.coreDiameterMm / Math.max(parameters.grainOuterDiameterMm, 1)));
  const throatScale = Math.min(0.72, Math.max(0.2, parameters.nozzleThroatMm / Math.max(parameters.nozzleExitMm, 1)));
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Cpu className="h-5 w-5 text-cyan-200" />Motor assembly preview</h2>
      <div className="mt-5 rounded-lg border border-white/10 bg-[#080b14] p-4">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div className="min-w-0 rounded-md border border-white/10 bg-[#0b101b] p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.16em] text-orange-100/45">External side view</p>
            <div className="flex h-40 items-center justify-center">
              <div className="relative max-w-full" style={{ width: `min(100%, ${lengthPx}px)`, height: diameterPx }}>
                <div className="absolute inset-y-[22%] left-[11%] right-[24%] rounded-sm border border-stone-100/25 bg-[linear-gradient(180deg,#e0dacf_0%,#858884_19%,#41484b_49%,#8f928b_79%,#f0e7d8_100%)] shadow-xl shadow-black/40" />
                <div className="absolute inset-y-[14%] left-[5%] w-[13%] rounded-l-md border border-stone-100/35 bg-[linear-gradient(180deg,#d6d0c4,#747978,#ebe3d7)]" />
                {[17, 37, 63, 83].map((top) => (
                  <span key={top} className="absolute left-[10%] h-[8px] w-[8px] rounded-full border border-black/40 bg-stone-200 shadow" style={{ top: `${top}%` }} />
                ))}
                <div className="absolute inset-y-[12%] right-[22%] w-[9%] rounded-r-md border border-stone-100/25 bg-[linear-gradient(180deg,#90969a,#303840,#b8b7ad)]" />
                <div className="absolute right-[7%] top-1/2 h-[52%] w-[22%] -translate-y-1/2">
                  <div className="absolute inset-y-[16%] left-0 w-[30%] rounded-sm border border-stone-100/20 bg-[#30363d]" />
                  <div className="absolute inset-y-[5%] left-[24%] right-[34%] bg-[linear-gradient(90deg,#1b2027,#05070d,#48515a)] ring-1 ring-stone-100/22" style={{ clipPath: "polygon(0 0, 100% 38%, 100% 62%, 0 100%)" }} />
                  <div className="absolute left-[58%] top-1/2 h-[18%] w-[12%] -translate-y-1/2 rounded-sm bg-[#05070d] ring-1 ring-cyan-100/50" />
                  <div className="absolute inset-y-[10%] left-[66%] right-0 bg-[linear-gradient(90deg,#333b43,#111820,#5d666d)] ring-1 ring-stone-100/24" style={{ clipPath: "polygon(0 26%, 100% 4%, 100% 96%, 0 74%)" }} />
                </div>
                <div className="absolute left-[16%] right-[38%] top-1/2 h-[2px] -translate-y-1/2 bg-cyan-100/18" />
                <span className="absolute left-[7%] -bottom-6 text-[11px] text-orange-50/50">forward closure</span>
                <span className="absolute right-[2%] -bottom-6 text-[11px] text-orange-50/50">aft nozzle</span>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 gap-4">
            <div className="rounded-md border border-white/10 bg-[#0b101b] p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.16em] text-orange-100/45">Grain end face</p>
              <div className="grid place-items-center">
                <div className="relative h-32 w-32 rounded-full border-[6px] border-stone-300/70 bg-[#161b24]">
                  <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,#5a3f2d_0%,#8b6547_62%,#3a2a21_100%)] ring-1 ring-orange-100/25" />
                  <div className="absolute left-1/2 top-1/2 rounded-full bg-[#05070d] ring-1 ring-cyan-100/35" style={{ width: `${portScale * 58}px`, height: `${portScale * 58}px`, transform: "translate(-50%, -50%)" }} />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-white/10 bg-[#0b101b] p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.16em] text-orange-100/45">Nozzle end</p>
              <div className="grid place-items-center">
                <div className="relative h-28 w-28 rounded-full border-[5px] border-stone-400/70 bg-[radial-gradient(circle,#29313a_0%,#161b22_72%)]">
                  <div className="absolute left-1/2 top-1/2 rounded-full bg-[#05070d] ring-1 ring-cyan-100/45" style={{ width: `${throatScale * 50}px`, height: `${throatScale * 50}px`, transform: "translate(-50%, -50%)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-orange-50/60 sm:grid-cols-3">
        <p>Side view shows forward closure, straight casing tube, aft closure, and a converging-diverging nozzle.</p>
        <p>Grain end face shows propellant annulus and axial port scaled from the core input.</p>
        <p>Nozzle end view separates the nozzle insert and throat instead of using a decorative capsule.</p>
      </div>
    </Card>
  );
}

function MotorDesignDetailPanel({ parameters, result }: { parameters: MotorParameters; result: MotorSimulationResult }) {
  const throatAreaMm2 = Math.PI * (parameters.nozzleThroatMm / 2) ** 2;
  const exitAreaMm2 = Math.PI * (parameters.nozzleExitMm / 2) ** 2;
  const expansionRatio = exitAreaMm2 / Math.max(throatAreaMm2, 1);
  const webThicknessMm = Math.max((parameters.grainOuterDiameterMm - parameters.coreDiameterMm) / 2, 0);
  const grainStackLengthMm = parameters.grainCount * parameters.grainLengthMm;
  const freeVolumeMm = Math.max(parameters.casingLengthMm - grainStackLengthMm, 0);
  const initialKn = result.curve.find((point) => point.kn > 0)?.kn ?? 0;
  const peakPressure = Math.max(...result.curve.map((point) => point.pressure));
  const averagePressure = result.curve.length ? result.curve.reduce((sum, point) => sum + point.pressure, 0) / result.curve.length : 0;
  const details = [
    ["Initial Kn", initialKn.toFixed(1), "burn area / throat area"],
    ["Web thickness", `${webThicknessMm.toFixed(1)} mm`, "radial regression distance"],
    ["Expansion ratio", `${expansionRatio.toFixed(2)}:1`, "exit area / throat area"],
    ["Peak chamber pressure", `${peakPressure.toFixed(2)} MPa`, "analysis result"],
    ["Mean pressure", `${averagePressure.toFixed(2)} MPa`, "curve average"],
    ["Free hardware length", `${freeVolumeMm.toFixed(0)} mm`, "closure/nozzle/gaps allowance"]
  ];
  const notes = [
    ["Case and liner", "Casing carries pressure load; liner/insulation is modeled as a thermal barrier between hot gas/propellant and the case."],
    ["Grain stack", "Multiple short grains approximate a BATES-style stack so the port and end-face area can be tracked over time."],
    ["Nozzle set", "Throat controls chamber pressure in the analysis; exit area gives the expansion-ratio cue for the visual model."],
    ["Static-fire data", "Measured thrust CSV can be attached later and compared against the simulated thrust curve without replacing the raw data."]
  ];

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Motor detail model</h2>
      <p className="mt-2 text-sm text-orange-50/60">Reference-backed structure and simulation readouts. This stays educational: no propellant recipes, machining instructions, or certification claims.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-orange-50/45">{label}</p>
            <p className="mt-1 text-lg font-semibold text-orange-50">{value}</p>
            <p className="mt-1 text-[11px] text-orange-50/42">{hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {notes.map(([title, body]) => (
          <div key={title} className="rounded-md border border-white/10 bg-[#0b101b] p-3">
            <p className="text-sm font-semibold text-orange-100">{title}</p>
            <p className="mt-1 text-xs leading-5 text-orange-50/58">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-cyan-200/15 bg-cyan-200/7 p-3 text-xs leading-5 text-cyan-50/72">
        Sources used for the model vocabulary: NASA internal-insulation guidance, NASA/public solid-motor component diagrams, ESA solid-propulsion overview, Nakka public motor notes, and NAR/Tripoli safety framing.
      </div>
    </Card>
  );
}

function DiagramLabel({ className, title, value }: { className: string; title: string; value: string }) {
  return (
    <div className={`absolute rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] leading-tight backdrop-blur ${className}`}>
      <p className="font-semibold text-orange-50">{title}</p>
      <p className="text-orange-50/48">{value}</p>
    </div>
  );
}

function MotorCallout({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x - 6} y={y - 15} width={Math.max(92, text.length * 6.4)} height="24" rx="6" fill="#030712" fillOpacity="0.78" stroke="#ffffff" strokeOpacity="0.12" />
      <text x={x} y={y + 1} fill="#f5efe7" fontSize="11" fontWeight="600">{text}</text>
    </g>
  );
}

function MotorPerformanceSummary({ result, parameters, compareMotors, setCompareMotors, onSave, onNozzle, onExportRasp }: { result: MotorSimulationResult; parameters: MotorParameters; compareMotors: boolean; setCompareMotors: (value: boolean) => void; onSave: () => void; onNozzle: () => void; onExportRasp: () => void }) {
  const summary = summarizeMotor(result, parameters);
  const copyCsv = () => {
    const rows = [
      "time_s,thrust_n,chamber_pressure_mpa,mass_flow_kg_s,kn,grain_mass_g,total_impulse_ns",
      ...result.curve.map((point) => [
        point.time,
        point.thrust,
        point.pressure,
        point.massFlowKgS,
        point.kn,
        point.massRemainingG,
        point.impulse
      ].join(","))
    ];
    void navigator.clipboard?.writeText(rows.join("\n"));
  };
  const metrics = [
    ["Class", `${result.motorClass}${result.averageThrustN}`, `${summary.classLoad}% of class band`],
    ["Thrust time", `${result.burnTimeS} s`, "computed burn duration"],
    ["Max thrust", `${result.peakThrustN} N`, "peak curve value"],
    ["Total impulse", `${result.totalImpulseNs} N-s`, "integrated thrust"],
    ["Delivered Isp", `${summary.averageIsp} s`, "curve average estimate"],
    ["Max CP", `${summary.maxPressureBar} bar`, `${summary.maxPressure} MPa`],
    ["Average CP", `${summary.averagePressureBar} bar`, `${summary.averagePressure} MPa`],
    ["Exit velocity", `Mach ${summary.exitMach}`, "derived cue"],
    ["Initial grain mass", `${result.propellantMassG} g`, "public metadata"]
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Motor performance</h2>
          <p className="mt-1 text-sm text-orange-50/58">Internal-ballistics summary generated from the current input deck.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave}><Save className="h-4 w-4" />Save motor</Button>
          <Button variant="outline" onClick={copyCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={onExportRasp}><Download className="h-4 w-4" />RASP export</Button>
          <Button variant="outline" onClick={onNozzle}><Gauge className="h-4 w-4" />Nozzle design</Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-white/12 bg-white/[0.04] p-3">
            <p className="text-xs text-orange-50/45">{label}</p>
            <p className="mt-1 text-lg font-semibold text-orange-50">{value}</p>
            <p className="mt-1 text-[11px] text-orange-50/40">{hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-cyan-100">
          <p>Expansion ratio: {summary.expansionRatio}:1 · optimum estimate: {summary.optimumExpansionRatio}:1 · port/throat: {summary.portToThroatRatio}</p>
          <p className="mt-1 text-xs text-orange-50/46">{result.engineName ?? "SRM internal ballistics"} · combustion eff {summary.combustionEfficiency}% · nozzle eff {summary.nozzleEfficiency}% · delivered c* {summary.deliveredCStar || "n/a"} m/s</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-orange-50/65">
          <input type="checkbox" checked={compareMotors} onChange={(event) => setCompareMotors(event.target.checked)} className="accent-orange-300" />
          Compare measured curve
        </label>
      </div>
    </Card>
  );
}

function MotorSimulationPanel({ result, parameters, onSave, onExportRasp }: { result: MotorSimulationResult; parameters: MotorParameters; onSave: () => void; onExportRasp: () => void }) {
  const summary = summarizeMotor(result, parameters);
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Flame className="h-5 w-5 text-orange-200" />Motor simulation</h2>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-orange-100/50">SRM analysis controls</p>
      <div className="mt-5 grid gap-3">
        <Metric label="Calculation engine" value={result.engineName ?? "SRM internal ballistics"} />
        <Metric label="Estimated class" value={`${result.motorClass}${result.averageThrustN} / ${summary.classLoad}%`} />
        <Metric label="Total impulse" value={`${result.totalImpulseNs} N-s`} />
        <Metric label="Average thrust" value={`${result.averageThrustN} N`} />
        <Metric label="Peak thrust" value={`${result.peakThrustN} N`} />
        <Metric label="Burn time" value={`${result.burnTimeS} s`} />
        <Metric label="Port / throat" value={summary.portToThroatRatio || "n/a"} />
        <Metric label="Optimum expansion" value={`${summary.optimumExpansionRatio}:1`} />
        <Metric label="Efficiency assumptions" value={`${summary.combustionEfficiency}% / ${summary.nozzleEfficiency}%`} />
        <Metric label="Loaded mass" value={`${result.estimatedLoadedMassG} g`} />
        <Metric label="Propellant mass" value={`${result.propellantMassG} g`} />
      </div>
      {result.modelNotes?.length ? (
        <div className="mt-5 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/80">Model notes</p>
          <div className="mt-2 space-y-1">
            {result.modelNotes.map((note) => <p key={note} className="text-xs leading-5 text-orange-50/55">{note}</p>)}
          </div>
        </div>
      ) : null}
      <div className="mt-5 space-y-2">
        {result.warnings.map((warning) => <p key={warning} className="rounded-md bg-amber-300/10 p-2 text-xs text-amber-100">{warning}</p>)}
      </div>
      <div className="mt-5 grid gap-2">
        <Button onClick={onSave}><Save className="h-4 w-4" />Save motor</Button>
        <Button variant="outline" onClick={onExportRasp}><Download className="h-4 w-4" />Export RASP .eng</Button>
        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(JSON.stringify(result, null, 2))}><Download className="h-4 w-4" />Export JSON</Button>
        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(result.curve.map((p) => `${p.time},${p.thrust},${p.pressure},${p.kn},${p.massFlowKgS ?? ""},${p.massRemainingG ?? ""},${p.burnRateMmS ?? ""}`).join("\n"))}><Download className="h-4 w-4" />Copy CSV</Button>
      </div>
    </Card>
  );
}

function MotorCurveChart({ result, measuredCurve }: { result: MotorSimulationResult; measuredCurve?: MotorSimulationResult["curve"] }) {
  const [activeCurve, setActiveCurve] = useState<"thrust" | "pressure" | "massFlow">("thrust");
  const tabs = [
    { id: "thrust" as const, label: "Thrust" },
    { id: "pressure" as const, label: "Chamber Pressure" },
    { id: "massFlow" as const, label: "Mass Flow Rate" }
  ];
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Performance curves</h2>
          <p className="mt-1 text-sm text-orange-50/58">One graph at a time from the same internal-ballistics time step: burn area, Kn, chamber pressure, mass flow, grain mass, and thrust.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCurve(tab.id)}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activeCurve === tab.id ? "bg-orange-300 text-slate-950" : "text-orange-50/60 hover:bg-white/[0.06]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {activeCurve === "thrust" ? (
          <Curve title="Thrust vs time" units="N over s" data={mergeMeasured(result.curve, measuredCurve)} lines={[["thrust", "#fb923c"], ["measuredThrust", "#5fb8ff"]]} />
        ) : null}
        {activeCurve === "pressure" ? (
          <Curve title="Chamber pressure / Kn" units="MPa and ratio over s" data={result.curve} lines={[["pressure", "#d7b56d"], ["kn", "#5fb8ff"]]} />
        ) : null}
        {activeCurve === "massFlow" ? (
          <Curve title="Mass flow / burn rate" units="kg/s and mm/s over s" data={result.curve} lines={[["massFlowKgS", "#c084fc"], ["burnRateMmS", "#9fd7bf"]]} />
        ) : null}
      </div>
    </Card>
  );
}

function RocketGraphSet({ result }: { result: SimulationResult }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Rocket-level graphs</h2>
      <p className="mt-1 text-sm text-orange-50/58">Integrates the selected motor thrust curve with changing propellant mass, gravity, and quadratic drag.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TelemetryChart data={result.timeSeries} type="altitude" />
        <TelemetryChart data={result.timeSeries} type="velocity" />
        <TelemetryChart data={result.timeSeries} type="thrust" />
        <Curve title="Acceleration / drag trend" units="m/s^2 and N trend over s" data={result.timeSeries.map((point) => ({ ...point, drag: Math.round(Math.abs((point.velocity ?? 0) ** 2) * result.dragCoefficientEstimate * 0.01) }))} lines={[["acceleration", "#9fd7bf"], ["drag", "#d7b56d"]]} />
      </div>
    </Card>
  );
}

function MotorLibraryPicker({ motors, selectedMotorId, setSelectedMotorId }: { motors: SavedMotor[]; selectedMotorId: string; setSelectedMotorId: (id: string) => void }) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Library className="h-5 w-5 text-orange-200" />Motor Library</h2>
      <select value={selectedMotorId} onChange={(event) => setSelectedMotorId(event.target.value)} className="mt-4 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-sm text-orange-50">
        <option value="">Select a saved motor</option>
        {motors.map((motor) => <option key={motor.id} value={motor.id}>{motor.name} - {motor.estimatedClass}{motor.averageThrustN}</option>)}
      </select>
      <Button href="/build/motor" asChild variant="outline" className="mt-3 w-full"><Flame className="h-4 w-4" />Design another motor</Button>
    </Card>
  );
}

function MotorCard({ motor }: { motor: SavedMotor }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{motor.name}</h2>
          <p className="mt-1 text-sm text-orange-50/58">{motor.creator}</p>
        </div>
        <span className="rounded-md bg-orange-300/15 px-2 py-1 text-sm text-orange-100">{motor.estimatedClass}{motor.averageThrustN}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-orange-50/68">
        <Metric label="Impulse" value={`${motor.totalImpulseNs} N-s`} />
        <Metric label="Peak" value={`${motor.peakThrustN} N`} />
        <Metric label="Burn" value={`${motor.burnTimeS} s`} />
        <Metric label="Status" value={motor.verificationStatus} />
      </div>
      <Button href={`/motors/${motor.id}`} asChild className="mt-5 w-full">Open motor</Button>
    </Card>
  );
}

function MotorDetail({ motor }: { motor: SavedMotor }) {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[380px_1fr]">
      <MotorCard motor={motor} />
      <MotorCurveChart result={motor.simulation} measuredCurve={motor.measuredCurve} />
    </div>
  );
}

function MotorSaveModal(props: {
  name: string;
  setName: (value: string) => void;
  visibility: "private" | "public" | "unlisted";
  setVisibility: (value: "private" | "public" | "unlisted") => void;
  license: string;
  setLicense: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4">
      <Card className="w-full max-w-lg p-5">
        <h2 className="font-semibold">Save motor to Motor Library</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-sm text-orange-50/65">Motor name<input value={props.name} onChange={(event) => props.setName(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" /></label>
          <label className="text-sm text-orange-50/65">Visibility<select value={props.visibility} onChange={(event) => props.setVisibility(event.target.value as never)} className="mt-1 w-full rounded-md border border-white/10 bg-[#121421] px-3 py-2 text-orange-50"><option>private</option><option>public</option><option>unlisted</option></select></label>
          <label className="text-sm text-orange-50/65">Usage rights<input value={props.license} onChange={(event) => props.setLicense(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" /></label>
          <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-orange-50/65">Motors are saved as engineering records. Public release and article coverage are handled through the project upload flow.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <Button onClick={props.onSave}><Check className="h-4 w-4" />Save Motor</Button>
        </div>
      </Card>
    </div>
  );
}

function NozzleDesignModal({ parameters, update, onClose }: { parameters: MotorParameters; update: <K extends keyof MotorParameters>(key: K, value: MotorParameters[K]) => void; onClose: () => void }) {
  const [meshDensity, setMeshDensity] = useState<NozzleCfdInputs["meshDensity"]>("standard");
  const [cfdResult, setCfdResult] = useState<NozzleCfdResult | null>(null);
  const [cfdError, setCfdError] = useState<string | null>(null);
  const [cfdRunning, setCfdRunning] = useState(false);
  const [cfdElapsedSeconds, setCfdElapsedSeconds] = useState(0);
  const [cfdFieldName, setCfdFieldName] = useState<NozzleCfdField["name"]>("schlieren");
  const [cfdDebugView, setCfdDebugView] = useState<CfdDebugView>("mach");
  const [cfdFrameIndex, setCfdFrameIndex] = useState(0);
  const [cfdPlaying, setCfdPlaying] = useState(false);
  const convergenceAngle = Math.max(1, Math.min(89, parameters.convergenceAngleDeg ?? 60));
  const divergenceAngle = Math.max(1, Math.min(89, parameters.divergenceAngleDeg ?? 24));
  const chamberRadius = parameters.casingInnerDiameterMm / 2;
  const throatRadius = parameters.nozzleThroatMm / 2;
  const exitRadius = parameters.nozzleExitMm / 2;
  const convergenceDelta = Math.max(chamberRadius - throatRadius, 0);
  const divergenceDelta = Math.max(exitRadius - throatRadius, 0);
  const convergenceLength = convergenceDelta / Math.tan((convergenceAngle * Math.PI) / 180);
  const divergenceLength = divergenceDelta / Math.tan((divergenceAngle * Math.PI) / 180);
  const throatAreaMm2 = Math.PI * throatRadius ** 2;
  const exitAreaMm2 = Math.PI * exitRadius ** 2;
  const expansionRatio = exitAreaMm2 / Math.max(throatAreaMm2, 1);
  const modalSimulation = useMemo(() => simulateMotor(parameters), [parameters]);
  const nozzleFlow = useMemo(
    () => analyzeNozzleFlow(parameters, modalSimulation.maxPressureMPa || modalSimulation.averagePressureMPa || 2.5),
    [parameters, modalSimulation.averagePressureMPa, modalSimulation.maxPressureMPa]
  );
  const expansionTone =
    nozzleFlow.expansionState === "near-optimum" ? "text-emerald-200" :
    nozzleFlow.expansionState === "underexpanded" ? "text-sky-200" :
    "text-amber-200";
  const expansionCopy =
    nozzleFlow.expansionState === "near-optimum" ? "near ambient-matched expansion" :
    nozzleFlow.expansionState === "underexpanded" ? "underexpanded plume" :
    "overexpanded, separation-prone";
  const visualCenterY = 150;
  const inletX = 78;
  const chamberEndX = 218;
  const drawingScale = Math.max(2.4, Math.min(6.2, 420 / Math.max(convergenceLength + divergenceLength, 1), 98 / Math.max(chamberRadius, 1)));
  const visualChamberRadius = Math.max(26, chamberRadius * drawingScale);
  const visualThroatRadius = Math.max(5, throatRadius * drawingScale);
  const visualExitRadius = Math.max(visualThroatRadius + 2, exitRadius * drawingScale);
  const throatX = chamberEndX + convergenceLength * drawingScale;
  const exitX = throatX + divergenceLength * drawingScale;
  const convergingStartTop = visualCenterY - visualChamberRadius;
  const convergingStartBottom = visualCenterY + visualChamberRadius;
  const throatTop = visualCenterY - visualThroatRadius;
  const throatBottom = visualCenterY + visualThroatRadius;
  const exitTop = visualCenterY - visualExitRadius;
  const exitBottom = visualCenterY + visualExitRadius;
  const convergenceArcRadius = 42;
  const divergenceArcRadius = 50;
  const convergenceArcX = throatX - Math.cos((convergenceAngle * Math.PI) / 180) * convergenceArcRadius;
  const convergenceArcY = visualCenterY - Math.sin((convergenceAngle * Math.PI) / 180) * convergenceArcRadius;
  const divergenceArcX = throatX + Math.cos((divergenceAngle * Math.PI) / 180) * divergenceArcRadius;
  const divergenceArcY = visualCenterY - Math.sin((divergenceAngle * Math.PI) / 180) * divergenceArcRadius;
  const cfdDisplayActive = cfdRunning || Boolean(cfdResult);
  const cfdFrames = cfdResult?.transientFrames ?? [];
  const activeCfdFrame = cfdFrames[Math.min(cfdFrameIndex, Math.max(cfdFrames.length - 1, 0))];
  useEffect(() => {
    if (!cfdPlaying || cfdFrames.length < 2) return;
    const timer = window.setInterval(() => {
      setCfdFrameIndex((current) => {
        if (current >= cfdFrames.length - 1) {
          setCfdPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 27);
    return () => window.clearInterval(timer);
  }, [cfdFrames.length, cfdPlaying]);
  useEffect(() => {
    if (!cfdRunning) return;
    const startedAt = Date.now();
    setCfdElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setCfdElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [cfdRunning]);
  const runCfd = async () => {
    const payload: NozzleCfdInputs = {
      chamberPressurePa: nozzleFlow.chamberPressureMPa * 1_000_000,
      chamberTemperatureK: Math.max(300, nozzleFlow.exitTemperatureK * (1 + ((nozzleFlow.gamma - 1) / 2) * nozzleFlow.exitMach ** 2)),
      gamma: nozzleFlow.gamma,
      molecularWeightKgPerKmol: 40,
      throatDiameterMm: parameters.nozzleThroatMm,
      exitDiameterMm: parameters.nozzleExitMm,
      chamberDiameterMm: parameters.casingInnerDiameterMm,
      convergenceAngleDeg: convergenceAngle,
      divergenceAngleDeg: divergenceAngle,
      convergenceLengthMm: Number(convergenceLength.toFixed(3)),
      divergenceLengthMm: Number(divergenceLength.toFixed(3)),
      ambientPressurePa: 101_325,
      meshDensity
    };

    setCfdRunning(true);
    setCfdError(null);

    try {
      const response = await fetch("/api/cfd/nozzle/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const message =
          typeof data?.message === "string" ? data.message :
          typeof data?.error === "string" ? data.error :
          "CFD backend failed to start.";
        setCfdError(message);
        return;
      }
      setCfdResult(data as NozzleCfdResult);
      setCfdFrameIndex(0);
      setCfdPlaying(Boolean((data as NozzleCfdResult).transientFrames?.length));
    } catch (error) {
      setCfdError(error instanceof Error ? error.message : "CFD request failed.");
    } finally {
      setCfdRunning(false);
    }
  };
  const updateThroat = (value: number) => {
    const safeValue = Math.max(1, value || 1);
    update("nozzleThroatMm", safeValue as never);
    update("expansionRatio", Number(((parameters.nozzleExitMm / safeValue) ** 2).toFixed(2)) as never);
  };
  const updateExit = (value: number) => {
    const safeValue = Math.max(1, value || 1);
    update("nozzleExitMm", safeValue as never);
    update("expansionRatio", Number(((safeValue / Math.max(parameters.nozzleThroatMm, 1)) ** 2).toFixed(2)) as never);
  };
  const updateConvergenceAngle = (value: number) => {
    update("convergenceAngleDeg", Math.max(1, Math.min(89, value || 1)) as never);
  };
  const updateDivergenceAngle = (value: number) => {
    update("divergenceAngleDeg", Math.max(1, Math.min(89, value || 1)) as never);
  };
  const updateConvergenceLength = (value: number) => {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    const nextChamberRadius = throatRadius + safeValue * Math.tan((convergenceAngle * Math.PI) / 180);
    update("casingInnerDiameterMm", Number(Math.max(parameters.nozzleThroatMm, nextChamberRadius * 2).toFixed(1)) as never);
  };
  const updateDivergenceLength = (value: number) => {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    const nextExitRadius = throatRadius + safeValue * Math.tan((divergenceAngle * Math.PI) / 180);
    updateExit(Number(Math.max(parameters.nozzleThroatMm, nextExitRadius * 2).toFixed(1)));
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4 py-4">
      <Card className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <h2 className="text-xl font-semibold">Nozzle analysis tool</h2>
          <p className="mt-1 text-sm text-orange-50/55">Converging throat and diverging exit geometry for simulation review only.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-orange-50/65">Throat diameter
              <input type="number" min="1" value={parameters.nozzleThroatMm} onChange={(event) => updateThroat(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
            <label className="text-sm text-orange-50/65">Exit diameter
              <input type="number" min="1" value={parameters.nozzleExitMm} onChange={(event) => updateExit(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
            <label className="text-sm text-orange-50/65">Convergence angle
              <input type="number" min="1" max="89" step="0.5" value={convergenceAngle} onChange={(event) => updateConvergenceAngle(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
            <label className="text-sm text-orange-50/65">Divergence angle
              <input type="number" min="1" max="89" step="0.5" value={divergenceAngle} onChange={(event) => updateDivergenceAngle(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
            <label className="text-sm text-orange-50/65">Convergence length
              <input type="number" step="0.1" value={Number(convergenceLength.toFixed(1))} onChange={(event) => updateConvergenceLength(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
            <label className="text-sm text-orange-50/65">Divergence length
              <input type="number" step="0.1" value={Number(divergenceLength.toFixed(1))} onChange={(event) => updateDivergenceLength(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50" />
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Throat area" value={`${throatAreaMm2.toFixed(1)} mm2`} />
            <Metric label="Exit Mach" value={`M ${nozzleFlow.exitMach.toFixed(2)}`} />
            <Metric label="Exit pressure" value={`${nozzleFlow.exitPressureMPa.toFixed(3)} MPa`} />
            <Metric label="Exit velocity" value={`${nozzleFlow.exitVelocityMS} m/s`} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Metric label="Expansion ratio" value={`${nozzleFlow.areaRatio.toFixed(2)}:1`} />
            <Metric label="Optimum ratio" value={`${nozzleFlow.optimumExpansionRatio.toFixed(2)}:1`} />
            <Metric label="Nozzle efficiency" value={`${Math.round(nozzleFlow.nozzleEfficiency * 100)}%`} />
          </div>
          <p className="mt-3 text-xs leading-5 text-orange-50/55">
            CFD verification mode renders raw finite-volume cells and reports validation failures openly. Treat non-converged fields as numerical diagnostics, not certified plume predictions.
          </p>
          <p className={`mt-2 text-xs font-semibold ${expansionTone}`}>{expansionCopy} · peak chamber boundary {nozzleFlow.chamberPressureMPa.toFixed(2)} MPa · Pe/Pa {nozzleFlow.pressureRatio.toFixed(2)} · Cf {nozzleFlow.thrustCoefficient.toFixed(2)}</p>
          <svg viewBox="0 0 760 330" className="mt-5 h-auto w-full rounded-lg border border-white/10 bg-[#070a12]" role="img" aria-label="Nozzle convergence throat divergence and flow analysis diagram">
            <defs>
              <clipPath id="nozzleInternalCfdClip">
                <path d={`M${inletX} ${convergingStartTop} H${chamberEndX} L${throatX} ${throatTop} L${exitX} ${exitTop} L${exitX} ${exitBottom} L${throatX} ${throatBottom} L${chamberEndX} ${convergingStartBottom} H${inletX} Z`} />
              </clipPath>
            </defs>
            {cfdDisplayActive ? (
              <NozzleIntegratedCfdOverlay
                result={cfdResult}
                running={cfdRunning}
                inletX={inletX}
                chamberEndX={chamberEndX}
                throatX={throatX}
                exitX={exitX}
                centerY={visualCenterY}
                chamberRadius={visualChamberRadius}
                throatRadius={visualThroatRadius}
                exitRadius={visualExitRadius}
                fieldName={cfdFieldName}
                frameValues={activeCfdFrame?.fields[cfdFieldName]}
                elapsedSeconds={cfdElapsedSeconds}
              />
            ) : null}
            {!cfdDisplayActive ? <line x1="48" x2="712" y1={visualCenterY} y2={visualCenterY} stroke="#f8fafc" strokeOpacity="0.32" strokeDasharray="7 8" /> : null}
            {!cfdDisplayActive ? (
              <>
                <path
                  d={`M${inletX} ${convergingStartTop} H${chamberEndX} L${throatX} ${throatTop} L${exitX} ${exitTop}`}
                  fill="none"
                  stroke="#f8fafc"
                  strokeWidth="5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
                <path
                  d={`M${inletX} ${convergingStartBottom} H${chamberEndX} L${throatX} ${throatBottom} L${exitX} ${exitBottom}`}
                  fill="none"
                  stroke="#f8fafc"
                  strokeWidth="5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
                <line x1={inletX} x2={inletX} y1={convergingStartTop} y2={convergingStartBottom} stroke="#f8fafc" strokeOpacity="0.7" strokeWidth="3" />
              </>
            ) : null}
            {!cfdDisplayActive ? (
              <>
                <path d={`M${throatX - convergenceArcRadius} ${visualCenterY} A${convergenceArcRadius} ${convergenceArcRadius} 0 0 0 ${convergenceArcX} ${convergenceArcY}`} fill="none" stroke="#86efac" strokeWidth="2" strokeOpacity="0.85" />
                <path d={`M${throatX + divergenceArcRadius} ${visualCenterY} A${divergenceArcRadius} ${divergenceArcRadius} 0 0 0 ${divergenceArcX} ${divergenceArcY}`} fill="none" stroke="#fecdd3" strokeWidth="2" strokeOpacity="0.85" />
                <line x1={throatX - convergenceArcRadius - 8} x2={throatX + 6} y1={visualCenterY} y2={visualCenterY} stroke="#86efac" strokeWidth="1.5" strokeOpacity="0.55" />
                <line x1={throatX - 6} x2={throatX + divergenceArcRadius + 8} y1={visualCenterY} y2={visualCenterY} stroke="#fecdd3" strokeWidth="1.5" strokeOpacity="0.55" />
                <circle cx={throatX} cy={throatTop} r="4" fill="#fb923c" />
                <circle cx={throatX} cy={throatBottom} r="4" fill="#fb923c" />
                <line x1={throatX} x2={throatX} y1={throatTop} y2={throatBottom} stroke="#fb923c" strokeWidth="2.5" strokeDasharray="5 4" />
                <line x1={throatX} x2={throatX} y1="244" y2="278" stroke="#fb923c" strokeWidth="2" />
                <line x1={exitX} x2={exitX} y1="244" y2="278" stroke="#c084fc" strokeWidth="2" />
                <line x1={chamberEndX} x2={throatX} y1="265" y2="265" stroke="#93c5fd" strokeWidth="2" />
                <line x1={throatX} x2={exitX} y1="292" y2="292" stroke="#93c5fd" strokeWidth="2" />
                <text x={inletX - 4} y={convergingStartTop - 12} fill="#dbeafe" fontSize="13">chamber ID {parameters.casingInnerDiameterMm} mm</text>
                <text x={throatX - 30} y={Math.max(38, throatTop - 22)} fill="#fb923c" fontSize="14">throat {parameters.nozzleThroatMm} mm</text>
                <text x={exitX - 54} y={exitTop - 12} fill="#c084fc" fontSize="14">exit {parameters.nozzleExitMm} mm</text>
                <text x={throatX - convergenceArcRadius - 4} y={visualCenterY - 18} fill="#bbf7d0" fontSize="13">{convergenceAngle} deg</text>
                <text x={throatX + divergenceArcRadius + 4} y={visualCenterY - 18} fill="#fecdd3" fontSize="13">{divergenceAngle} deg</text>
                <text x={chamberEndX + 28} y="258" fill="#bfdbfe" fontSize="13">convergence</text>
                <text x={throatX + 54} y="285" fill="#bfdbfe" fontSize="13">divergence</text>
                <text x="68" y="306" fill="#94a3b8" fontSize="12">Geometry mode. Run CFD uses one chamber-nozzle-ambient computational domain.</text>
              </>
            ) : null}
          </svg>
          {cfdFrames.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!cfdPlaying && cfdFrameIndex >= cfdFrames.length - 1) setCfdFrameIndex(0);
                  setCfdPlaying((current) => !current);
                }}
                aria-label={cfdPlaying ? "Pause CFD playback" : cfdFrameIndex >= cfdFrames.length - 1 ? "Replay CFD playback" : "Play CFD playback"}
              >
                {cfdPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {cfdPlaying ? "Pause" : cfdFrameIndex >= cfdFrames.length - 1 ? "Replay" : "Play"}
              </Button>
              <input
                type="range"
                min="0"
                max={cfdFrames.length - 1}
                value={cfdFrameIndex}
                onChange={(event) => {
                  setCfdPlaying(false);
                  setCfdFrameIndex(Number(event.target.value));
                }}
                className="min-w-44 flex-1 accent-orange-400"
                aria-label="CFD iteration frame"
              />
              <p className="min-w-44 text-right text-xs tabular-nums text-orange-50/58">
                iteration {activeCfdFrame?.iteration ?? 0} · t={(activeCfdFrame?.physicalTimeS ?? 0).toExponential(2)} s
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className="text-sm text-orange-50/65">Mesh density
              <select value={meshDensity} onChange={(event) => setMeshDensity(event.target.value as NozzleCfdInputs["meshDensity"])} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50">
                <option value="coarse">Coarse validation mesh</option>
                <option value="standard">Standard throat-refined mesh</option>
                <option value="fine">Fine shock-capturing mesh</option>
                <option value="research">Research-grade mesh</option>
              </select>
            </label>
            <label className="text-sm text-orange-50/65">Field
              <select value={cfdFieldName} onChange={(event) => setCfdFieldName(event.target.value as NozzleCfdField["name"])} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50">
                <option value="mach">Mach</option>
                <option value="pressure">Static pressure</option>
                <option value="temperature">Static temperature</option>
                <option value="density">Density</option>
                <option value="velocity">Velocity magnitude</option>
                <option value="schlieren">Schlieren / shock structure</option>
                <option value="faceFlux">Face flux magnitude</option>
                <option value="totalPressure">Total pressure</option>
                <option value="totalTemperature">Total temperature</option>
              </select>
            </label>
            <label className="text-sm text-orange-50/65">Debug view
              <select value={cfdDebugView} onChange={(event) => setCfdDebugView(event.target.value as CfdDebugView)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-orange-50">
                <option value="mach">Mach contour</option>
                <option value="pressure">Pressure contour</option>
                <option value="density">Density contour</option>
                <option value="temperature">Temperature contour</option>
                <option value="velocity">Velocity contour</option>
                <option value="faceFlux">Face flux view</option>
                <option value="mesh">Mesh view</option>
                <option value="residual">Residual view</option>
              </select>
            </label>
            <Button onClick={runCfd} disabled={cfdRunning}><Wind className="h-4 w-4" />{cfdRunning ? `Solving... ${cfdElapsedSeconds}s` : "Run CFD"}</Button>
          </div>
          <NozzleCfdViewer result={cfdResult} error={cfdError} running={cfdRunning} fieldName={cfdFieldName} debugView={cfdDebugView} />
          <p className="mt-4 rounded-md border border-amber-200/20 bg-amber-200/8 p-3 text-xs leading-5 text-amber-50/82">Rocketry House records nozzle geometry for analysis and data comparison. It does not provide manufacturing certification or hazardous build instructions.</p>
        </div>
        <div className="shrink-0 border-t border-white/10 bg-[#111827]/95 px-5 py-4 backdrop-blur">
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function finiteNumberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function contourColor(value: number, min: number, max: number) {
  const safeValue = finiteNumberOrNull(value);
  const safeMin = finiteNumberOrNull(min);
  const safeMax = finiteNumberOrNull(max);
  if (safeValue === null || safeMin === null || safeMax === null || safeMax <= safeMin) {
    return "rgb(217, 70, 239)";
  }
  const normalized = Math.max(0, Math.min(1, (safeValue - safeMin) / Math.max(safeMax - safeMin, 1e-9)));
  const highContrast = Math.max(0, Math.min(1, (normalized - 0.5) * 1.55 + 0.5));
  const t = Math.pow(highContrast, 0.78);
  const stops = [
    [24, 29, 115],
    [29, 78, 216],
    [14, 165, 233],
    [6, 182, 212],
    [34, 197, 94],
    [250, 204, 21],
    [249, 115, 22],
    [239, 68, 68],
    [190, 24, 93],
    [248, 250, 252]
  ];
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const start = stops[index];
  const end = stops[index + 1];
  const rgb = start.map((channel, channelIndex) => Math.round(channel + (end[channelIndex] - channel) * local));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function NozzleIntegratedCfdOverlay({
  result,
  running,
  inletX,
  chamberEndX,
  throatX,
  exitX,
  centerY,
  chamberRadius,
  throatRadius,
  exitRadius,
  fieldName,
  frameValues,
  elapsedSeconds
}: {
  result: NozzleCfdResult | null;
  running: boolean;
  inletX: number;
  chamberEndX: number;
  throatX: number;
  exitX: number;
  centerY: number;
  chamberRadius: number;
  throatRadius: number;
  exitRadius: number;
  fieldName: NozzleCfdField["name"];
  frameValues?: number[];
  elapsedSeconds: number;
}) {
  const field = result?.fields.find((item) => item.name === fieldName) ?? result?.fields.find((item) => item.name === "mach") ?? null;
  const viewportEndX = 740;
  const domainLength = Math.max(viewportEndX - inletX, 1);
  const displayedNozzleLength = Math.max(exitX - inletX, 1);

  if (running) {
    return (
      <g>
        <rect x={inletX} y={centerY - chamberRadius} width={displayedNozzleLength} height={chamberRadius * 2} fill="#020617" opacity="0.72" clipPath="url(#nozzleInternalCfdClip)" />
        <path d={`M${inletX} ${centerY - chamberRadius} H${chamberEndX} L${throatX} ${centerY - throatRadius} L${exitX} ${centerY - exitRadius}`} fill="none" stroke="#f8fafc" strokeWidth="2.4" opacity="0.72" />
        <path d={`M${inletX} ${centerY + chamberRadius} H${chamberEndX} L${throatX} ${centerY + throatRadius} L${exitX} ${centerY + exitRadius}`} fill="none" stroke="#f8fafc" strokeWidth="2.4" opacity="0.72" />
        <circle cx="500" cy="132" r="18" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
        <circle cx="500" cy="132" r="18" fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" strokeDasharray="28 86" className="animate-spin" style={{ transformOrigin: "500px 132px" }} />
        <text x="500" y="170" textAnchor="middle" fill="#fff7ed" fontSize="15" fontWeight="600">Solving finite-volume flow</text>
        <text x="500" y="192" textAnchor="middle" fill="#fdba74" fontSize="13">{elapsedSeconds}s elapsed · extended transient run can take a few minutes</text>
        <text x="500" y="214" textAnchor="middle" fill="#94a3b8" fontSize="11">Solving 136 x 56 cells and recording 5x longer downstream flow evolution</text>
      </g>
    );
  }

  if (!field || !result) return null;

  const machField = result.fields.find((item) => item.name === "mach");
  const velocityField = result.fields.find((item) => item.name === "velocity");
  const xKeys = Array.from(new Set(field.cells.map((cell) => cell.x.toFixed(5)))).sort((a, b) => Number(a) - Number(b));
  const yKeys = Array.from(new Set(field.cells.map((cell) => (cell.physicalY ?? cell.y).toFixed(5)))).sort((a, b) => Number(a) - Number(b));
  const xStep = domainLength / Math.max(xKeys.length, 1);
  const yMax = Math.max(...field.cells.map((cell) => cell.physicalY ?? cell.y).filter(Number.isFinite), 1e-6);
  const yStep = (132 / Math.max(yKeys.length, 1));
  const yScale = 132 / yMax;
  const exitProbeX = inletX + (result.continuityCheck?.exitX ?? result.mesh.nozzleExitX ?? 0.24) * domainLength;
  const physicallyValid = result.validation?.checks?.physicallyValid ?? false;
  const xIndex = new Map(xKeys.map((key, index) => [key, index]));
  const yIndex = new Map(yKeys.map((key, index) => [key, index]));
  const solvedWall = xKeys.flatMap((key) => {
    const column = field.cells.filter((cell) => cell.x.toFixed(5) === key && cell.inNozzle);
    if (!column.length) return [];
    const radialEdge = Math.max(...column.map((cell) => cell.physicalY ?? cell.y)) * yScale + yStep / 2;
    const x = inletX + (xIndex.get(key) ?? 0) * xStep + xStep / 2;
    return [{ x, radialEdge }];
  });
  const topWall = solvedWall.map((point) => `${point.x},${centerY - point.radialEdge}`).join(" ");
  const bottomWall = solvedWall.map((point) => `${point.x},${centerY + point.radialEdge}`).join(" ");
  const inletWall = solvedWall[0];

  return (
    <g>
      <g shapeRendering="crispEdges">
        {field.cells.map((cell, index) => {
          const xi = xIndex.get(cell.x.toFixed(5)) ?? 0;
          const yi = yIndex.get((cell.physicalY ?? cell.y).toFixed(5)) ?? 0;
          const x = inletX + xi * xStep;
          const physicalY = cell.physicalY ?? cell.y;
          const radialDistance = physicalY * yScale;
          const yTop = centerY - radialDistance - yStep / 2;
          const yBottom = centerY + radialDistance - yStep / 2;
          const selectedValue = frameValues?.[index] ?? cell.value;
          const invalidSelected = finiteNumberOrNull(selectedValue) === null;
          const color = contourColor(selectedValue, field.min, field.max);
          const machValue = finiteNumberOrNull(machField?.cells[index]?.value) ?? (field.name === "mach" ? finiteNumberOrNull(selectedValue) ?? 0 : 0);
          const velocityValue = finiteNumberOrNull(velocityField?.cells[index]?.value) ?? (field.name === "velocity" ? finiteNumberOrNull(selectedValue) ?? 0 : 0);
          const flowActivity = Math.max((machValue - 0.03) / 1.12, velocityValue / 760);
          const boundedActivity = Number.isFinite(flowActivity) ? Math.max(0, Math.min(0.9, flowActivity)) : 0;
          const opacity = invalidSelected ? 0.96 : cell.inNozzle ? 0.95 : Math.max(0.72, 0.5 + boundedActivity * 0.45);

          return (
            <g key={`${field.name}-integrated-${index}`}>
              <rect x={x} y={yTop} width={Math.max(xStep, 0.8)} height={Math.max(yStep, 0.8)} fill={color} opacity={opacity} />
              <rect x={x} y={yBottom} width={Math.max(xStep, 0.8)} height={Math.max(yStep, 0.8)} fill={color} opacity={opacity} />
            </g>
          );
        })}
      </g>
      {solvedWall.length > 1 ? (
        <g fill="none" stroke="#f8fafc" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          <polyline points={topWall} />
          <polyline points={bottomWall} />
          {inletWall ? <line x1={inletWall.x} x2={inletWall.x} y1={centerY - inletWall.radialEdge} y2={centerY + inletWall.radialEdge} /> : null}
        </g>
      ) : null}
      <line x1={exitProbeX} x2={exitProbeX} y1="36" y2="294" stroke="#f8fafc" strokeWidth="1.6" strokeDasharray="6 6" opacity="0.75" />
      <text x={exitProbeX + 8} y="50" fill="#e2e8f0" fontSize="12">exit probe</text>
      {!physicallyValid ? (
        <g>
          <rect x={inletX + 10} y="262" width="278" height="26" rx="6" fill="#7f1d1d" opacity="0.86" />
          <text x={inletX + 22} y="279" fill="#fee2e2" fontSize="12">validation failed: raw cells shown, not a plume prediction</text>
        </g>
      ) : null}
    </g>
  );
}

function CfdContour({ field }: { field: NozzleCfdField }) {
  const width = 520;
  const height = 180;
  const xKeys = Array.from(new Set(field.cells.map((cell) => cell.x.toFixed(5)))).sort((a, b) => Number(a) - Number(b));
  const yValues = field.cells.map((cell) => cell.physicalY ?? cell.y).filter(Number.isFinite);
  const xIndex = new Map(xKeys.map((key, index) => [key, index]));
  const dx = width / Math.max(xKeys.length, 1);
  const sortedPhysicalY = Array.from(new Set(yValues.map((value) => value.toFixed(5)))).sort((a, b) => Number(a) - Number(b)).map(Number);
  const minDy = sortedPhysicalY.slice(1).reduce((min, value, index) => Math.min(min, value - sortedPhysicalY[index]), Number.POSITIVE_INFINITY);
  const yMax = Math.max(...yValues, 1e-6);
  const yScale = (height / 2 - 8) / yMax;
  const cellDy = Math.max((Number.isFinite(minDy) ? minDy : yMax / 40) * yScale, 0.8);
  const wallOutline = xKeys.flatMap((key) => {
    const column = field.cells.filter((cell) => cell.x.toFixed(5) === key && cell.inNozzle);
    if (!column.length) return [];
    const top = column.reduce((max, cell) => Math.max(max, cell.physicalY ?? cell.y), 0);
    return [{ x: (xIndex.get(key) ?? 0) * dx + dx / 2, y: height / 2 - top * yScale }];
  });
  return (
    <div className="rounded-lg border border-white/10 bg-[#070a12] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-50">{field.label}</p>
          <p className="text-xs text-orange-50/45">{field.min.toFixed(3)} to {field.max.toFixed(3)} {field.unit} · raw cell-centered values</p>
        </div>
        <div className="h-3 w-28 rounded-full bg-gradient-to-r from-slate-950 via-cyan-400 via-lime-400 via-amber-400 to-red-600" />
      </div>
      <svg shapeRendering="crispEdges" viewBox={`0 0 ${width} ${height}`} className="h-auto w-full rounded-md bg-slate-950" role="img" aria-label={`${field.label} raw cell-centered CFD contour`}>
        {field.cells.flatMap((cell, index) => {
          const color = contourColor(cell.value, field.min, field.max);
          const xi = xIndex.get(cell.x.toFixed(5)) ?? 0;
          const x = xi * dx;
          const physicalY = cell.physicalY ?? cell.y;
          const topY = height / 2 - physicalY * yScale - cellDy / 2;
          const bottomY = height / 2 + physicalY * yScale - cellDy / 2;
          return [
            <rect
              key={`${field.name}-${index}-top`}
              x={x}
              y={topY}
              width={Math.max(dx, 0.8)}
              height={cellDy}
              fill={color}
            />,
            <rect
              key={`${field.name}-${index}-bottom`}
              x={x}
              y={bottomY}
              width={Math.max(dx, 0.8)}
              height={cellDy}
              fill={color}
            />
          ];
        })}
        <polyline points={wallOutline.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="rgba(248,250,252,0.72)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <polyline points={wallOutline.map((point) => `${point.x},${height - point.y}`).join(" ")} fill="none" stroke="rgba(248,250,252,0.72)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 5" />
      </svg>
      <p className="mt-2 text-[11px] leading-4 text-orange-50/42">No interpolation, no smoothing, no plume shaping. Each rectangle maps one solved cell value.</p>
    </div>
  );
}

function CfdMeshDebug({ result }: { result: NozzleCfdResult }) {
  const width = 520;
  const height = 180;
  const exitX = (result.mesh.nozzleExitX ?? 0.24) * width;
  const meshCells = result.fields.find((field) => field.name === "mach")?.cells ?? [];
  const xKeys = Array.from(new Set(meshCells.map((cell) => cell.x.toFixed(5)))).sort((a, b) => Number(a) - Number(b));
  const yValues = meshCells.map((cell) => cell.physicalY ?? cell.y).filter(Number.isFinite);
  const xIndex = new Map(xKeys.map((key, index) => [key, index]));
  const dx = width / Math.max(xKeys.length, 1);
  const sortedPhysicalY = Array.from(new Set(yValues.map((value) => value.toFixed(5)))).sort((a, b) => Number(a) - Number(b)).map(Number);
  const minDy = sortedPhysicalY.slice(1).reduce((min, value, index) => Math.min(min, value - sortedPhysicalY[index]), Number.POSITIVE_INFINITY);
  const yMax = Math.max(...yValues, 1e-6);
  const yScale = (height / 2 - 8) / yMax;
  const cellDy = Math.max((Number.isFinite(minDy) ? minDy : yMax / 40) * yScale, 0.8);

  return (
    <div className="rounded-lg border border-white/10 bg-[#070a12] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-50">Continuous mesh domain</p>
          <p className="text-xs text-orange-50/45">Nozzle exit is an internal probe plane, not an outlet boundary.</p>
        </div>
        <p className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-orange-50/60">{result.mesh.domainLengthRatio?.toFixed(2) ?? "?"}x nozzle length</p>
      </div>
      <svg shapeRendering="crispEdges" viewBox={`0 0 ${width} ${height}`} className="h-auto w-full rounded-md bg-slate-950" role="img" aria-label="Raw CFD computational mesh view">
        {meshCells.flatMap((cell, index) => {
          const xi = xIndex.get(cell.x.toFixed(5)) ?? 0;
          const x = xi * dx;
          const physicalY = cell.physicalY ?? cell.y;
          const topY = height / 2 - physicalY * yScale - cellDy / 2;
          const bottomY = height / 2 + physicalY * yScale - cellDy / 2;
          return [
            <rect key={`mesh-${index}-top`} x={x} y={topY} width={Math.max(dx, 0.8)} height={cellDy} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="0.45" />,
            <rect key={`mesh-${index}-bottom`} x={x} y={bottomY} width={Math.max(dx, 0.8)} height={cellDy} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="0.45" />
          ];
        })}
        <line x1={exitX} x2={exitX} y1="0" y2={height} stroke="#fb923c" strokeWidth="2" strokeDasharray="5 5" />
        <text x={Math.min(exitX + 8, width - 120)} y="20" fill="#fed7aa" fontSize="12">exit probe</text>
        <text x="14" y={height - 14} fill="#cbd5e1" fontSize="11">chamber / nozzle</text>
        <text x={Math.min(exitX + 18, width - 170)} y={height - 14} fill="#cbd5e1" fontSize="11">external ambient domain</text>
      </svg>
    </div>
  );
}

function NozzleCfdViewer({ result, error, running, fieldName, debugView }: { result: NozzleCfdResult | null; error: string | null; running: boolean; fieldName: NozzleCfdField["name"]; debugView: CfdDebugView }) {
  if (running) {
    return (
      <div className="mt-4 rounded-lg border border-sky-200/20 bg-sky-200/8 p-4 text-sm text-sky-50/80">
        Running the continuous chamber-nozzle-ambient solver. Raw cell fields, residuals, and validation plots will appear below when the finite-volume run returns.
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200/25 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50/88">
        <p className="font-semibold">CFD error</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2 text-xs text-amber-50/65">No cell field has been returned yet. Once a run returns any conservative-state data, Rocketry House will show it even if validation fails.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-orange-50/62">
        Press Run CFD to convert the nozzle drawing into a continuous chamber, nozzle, and ambient-domain contour. The exit plane is debugged as a probe line, not used as a reset boundary.
      </div>
    );
  }

  const debugFieldName = debugView === "mesh" || debugView === "residual" ? fieldName : debugView;
  const displayField = result.fields.find((field) => field.name === debugFieldName) ?? result.fields.find((field) => field.name === fieldName) ?? result.fields.find((field) => field.name === "mach") ?? result.fields[0];
  const machField = result.fields.find((field) => field.name === "mach") ?? result.fields[0];
  const pressureField = result.fields.find((field) => field.name === "pressure") ?? result.fields[0];
  const densityField = result.fields.find((field) => field.name === "density") ?? result.fields[0];
  const temperatureField = result.fields.find((field) => field.name === "temperature") ?? result.fields[0];
  const lastResidual = result.residuals.at(-1);
  const isProvisional = result.status !== "converged";
  const continuity = result.continuityCheck;
  const probeData = continuity?.probe.map((point) => ({
    x: point.x,
    mach: point.mach,
    pressureKPa: Number((point.pressurePa / 1000).toFixed(2)),
    temperatureK: point.temperatureK,
    density: point.densityKgM3,
    axialVelocity: point.axialVelocityMS
  })) ?? [];
  const centerlineData = result.centerline.map((point) => ({
    x: point.x,
    mach: point.mach,
    pressureKPa: Number((point.pressurePa / 1000).toFixed(2)),
    density: point.densityKgM3,
    temperatureK: point.temperatureK,
    velocity: point.velocityMS
  }));
  const auditEntries = result.solverAudit ? Object.entries(result.solverAudit.numericalSteps) : [];
  const solverIncomplete = !result.solverAudit || result.solverAudit.skippedSteps.length > 0 || auditEntries.some(([, called]) => !called);

  return (
    <div className="mt-4 space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-200/25 bg-rose-200/10 p-4 text-sm leading-6 text-rose-50/88">
          <p className="font-semibold">CFD error retained with last available raw field</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs text-rose-50/62">The contours and residuals below are not hidden; they show the last finite-volume result returned by the solver.</p>
        </div>
      ) : null}
      {isProvisional ? (
        <div className="rounded-lg border border-amber-200/25 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50/88">
          <p className="font-semibold">CFD field returned before strict convergence</p>
          <p className="mt-1 text-amber-50/72">
            Contours below are rendered from the finite-volume conservative state, not from a synthetic plume. Treat this as a provisional engineering view until residuals and validation checks pass.
          </p>
          {lastResidual ? (
            <p className="mt-2 text-xs text-amber-50/62">
              Last residuals: continuity {lastResidual.continuity.toExponential(2)}, x-momentum {lastResidual.momentum.toExponential(2)}, y-momentum {(lastResidual.yMomentum ?? 0).toExponential(2)}, energy {lastResidual.energy.toExponential(2)}.
            </p>
          ) : null}
          {result.validation ? (
            <p className="mt-2 text-xs text-amber-50/62">
              Validation: throat M {result.validation.throatMach.toFixed(2)}, exit Mach reference error {result.validation.exitMachErrorPct.toFixed(1)}%, exit pressure reference error {result.validation.exitPressureErrorPct.toFixed(1)}%.
            </p>
          ) : null}
        </div>
      ) : null}
      {result.validation?.warnings?.length ? (
        <div className="rounded-lg border border-rose-200/25 bg-rose-200/10 p-4 text-sm leading-6 text-rose-50/88">
          <p className="font-semibold">Physical validation warnings</p>
          <div className="mt-2 grid gap-1 text-xs text-rose-50/72">
            {result.validation.warnings.map((warning) => <span key={warning}>- {warning}</span>)}
          </div>
        </div>
      ) : null}
      {solverIncomplete ? (
        <div className="rounded-lg border border-rose-200/25 bg-rose-200/10 p-4 text-sm font-semibold text-rose-50">
          CFD solver incomplete
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Exit Mach" value={`M ${result.metrics.exitMach.toFixed(2)}`} />
        <Metric label="Mass flow" value={`${result.metrics.massFlowKgS.toFixed(3)} kg/s`} />
        <Metric label="Isp" value={`${result.metrics.specificImpulseS.toFixed(1)} s`} />
        <Metric label="Cells" value={result.mesh.cells.toLocaleString()} />
      </div>
      {result.solverAudit ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="text-sm font-semibold text-orange-50">Solver audit</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
            <Metric label="Number of cells" value={result.solverAudit.cells.toLocaleString()} />
            <Metric label="Iterations" value={result.solverAudit.iterations.toLocaleString()} />
            <Metric label="Final CFL" value={result.solverAudit.finalCfl.toFixed(3)} />
            <Metric label="Continuity residual" value={result.solverAudit.finalResiduals ? result.solverAudit.finalResiduals.continuity.toExponential(2) : "n/a"} />
            <Metric label="X momentum residual" value={result.solverAudit.finalResiduals ? result.solverAudit.finalResiduals.xMomentum.toExponential(2) : "n/a"} />
            <Metric label="Y momentum residual" value={result.solverAudit.finalResiduals ? result.solverAudit.finalResiduals.yMomentum.toExponential(2) : "n/a"} />
            <Metric label="Energy residual" value={result.solverAudit.finalResiduals ? result.solverAudit.finalResiduals.energy.toExponential(2) : "n/a"} />
            <Metric label="Skipped steps" value={result.solverAudit.skippedSteps.length ? result.solverAudit.skippedSteps.join(", ") : "none"} />
            <Metric label="Solver runtime" value={`${result.solverAudit.runtimeMs.toFixed(0)} ms`} />
            <Metric label="Maximum CFL" value={result.solverAudit.maximumCfl.toFixed(3)} />
            <Metric label="Minimum density" value={`${result.solverAudit.minimumDensityKgM3.toExponential(2)} kg/m3`} />
            <Metric label="Minimum pressure" value={`${result.solverAudit.minimumPressurePa.toExponential(2)} Pa`} />
            <Metric label="Conservation error" value={result.solverAudit.conservationError.toExponential(2)} />
            <Metric label="Positivity abort" value={result.solverAudit.positivityAbort ? "YES" : "NO"} />
            <Metric label="NaN detected" value={result.solverAudit.nanDetected ? "YES" : "NO"} />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {auditEntries.map(([step, called]) => (
              <span key={step} className={`rounded-md border px-2 py-1 ${called ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-50" : "border-rose-200/25 bg-rose-200/10 text-rose-50"}`}>
                {called ? "PASS" : "ABORT"} {step}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
          <p className="text-sm font-semibold text-orange-50">Raw CFD verification data</p>
          <p className="mt-1 text-xs text-orange-50/50">
            {displayField?.label ?? "Selected contour"} range: {displayField?.min.toFixed(3)} to {displayField?.max.toFixed(3)} {displayField?.unit}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-orange-50/55">
            <span>{displayField?.min.toFixed(2)}</span>
            <span className="h-3 w-32 rounded-full bg-gradient-to-r from-slate-950 via-blue-700 via-cyan-400 via-lime-400 via-amber-400 to-red-600" />
            <span>{displayField?.max.toFixed(2)} {displayField?.unit}</span>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-orange-50/50">
          Solver: {result.solver}. Expansion state: {result.metrics.expansionState}. The outlet is downstream of the nozzle lip; ambient pressure is applied at far-field boundaries.
        </p>
        {result.validation ? (
          <div className="mt-3 grid gap-2 text-xs text-orange-50/58 sm:grid-cols-3">
            <span>Throat check M {result.validation.throatMach.toFixed(2)}</span>
            <span>Exit M error {result.validation.exitMachErrorPct.toFixed(1)}%</span>
            <span>Exit p error {result.validation.exitPressureErrorPct.toFixed(1)}%</span>
          </div>
        ) : null}
        {result.validation?.checks ? (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
            {[
              ["Throat choked", result.validation.checks.throatChoked],
              ["Mach increases", result.validation.checks.centerlineMachIncreases],
              ["Diverging Mach", result.validation.checks.divergingMachIncreases],
              ["Pressure drops", result.validation.checks.pressureDropsThroughNozzle],
              ["Density drops", result.validation.checks.densityDropsThroughNozzle],
              ["Velocity increases", result.validation.checks.velocityIncreasesThroughNozzle],
              ["Residual converged", result.validation.checks.residualConverged],
              ["Exit Mach theory", result.validation.checks.exitMachWithin10Pct],
              ["No checkerboard", result.validation.checks.checkerboardStable],
              ["Exit continuous", result.validation.checks.exitContinuous],
              ["Physically valid", result.validation.checks.physicallyValid]
            ].map(([label, ok]) => (
              <span key={String(label)} className={`rounded-md border px-2 py-1 ${ok ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-50" : "border-rose-200/25 bg-rose-200/10 text-rose-50"}`}>
                {ok ? "PASS" : "FAIL"} {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {continuity ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-50">Nozzle exit continuity check</p>
              <p className="mt-1 text-xs leading-5 text-orange-50/52">Max relative jump from the last internal centerline cell to the first external centerline cell. Large values should correspond to a resolved shock marker, not a renderer split.</p>
            </div>
            <p className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-orange-50/58">exit x = {continuity.exitX.toFixed(4)}</p>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
            <Metric label="Mach jump" value={`${(continuity.maxRelativeJump.mach * 100).toFixed(2)}%`} />
            <Metric label="Pressure jump" value={`${(continuity.maxRelativeJump.staticPressure * 100).toFixed(2)}%`} />
            <Metric label="Temperature jump" value={`${(continuity.maxRelativeJump.staticTemperature * 100).toFixed(2)}%`} />
            <Metric label="Density jump" value={`${(continuity.maxRelativeJump.density * 100).toFixed(2)}%`} />
            <Metric label="Velocity jump" value={`${(continuity.maxRelativeJump.axialVelocity * 100).toFixed(2)}%`} />
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <p className="mb-2 text-sm font-semibold text-orange-50">Debug visualization</p>
        {debugView === "mesh" ? (
          <CfdMeshDebug result={result} />
        ) : debugView === "residual" ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.residuals}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="iteration" stroke="rgba(255,247,237,0.48)" />
                <YAxis scale="log" domain={["auto", "auto"]} stroke="rgba(255,247,237,0.48)" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", color: "#fff7ed" }} />
                <Line type="linear" dataKey="continuity" stroke="#38bdf8" dot={false} />
                <Line type="linear" dataKey="momentum" stroke="#f97316" dot={false} />
                <Line type="linear" dataKey="yMomentum" stroke="#22c55e" dot={false} />
                <Line type="linear" dataKey="energy" stroke="#a78bfa" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <CfdContour field={displayField} />
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <CfdContour field={machField} />
        <CfdContour field={pressureField} />
        <CfdContour field={densityField} />
        <CfdContour field={temperatureField} />
      </div>
      <CfdMeshDebug result={result} />
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <p className="mb-2 text-sm font-semibold text-orange-50">Physical validation mode: centerline properties vs X</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            ["Centerline Mach vs X", "mach", "#38bdf8", "M"],
            ["Centerline Pressure vs X", "pressureKPa", "#f97316", "kPa"],
            ["Centerline Density vs X", "density", "#22c55e", "kg/m3"],
            ["Centerline Temperature vs X", "temperatureK", "#a78bfa", "K"]
          ].map(([title, key, stroke, unit]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-[#070a12] p-3">
              <p className="mb-2 text-xs font-semibold text-orange-50/80">{title} <span className="text-orange-50/38">({unit})</span></p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={centerlineData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="x" stroke="rgba(255,247,237,0.48)" />
                    <YAxis stroke="rgba(255,247,237,0.48)" />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", color: "#fff7ed" }} />
                    <Line type="linear" dataKey={key} stroke={stroke} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-orange-50/48">These four plots are sampled directly from solved centerline cells. They are the primary physics check; the contour should not be trusted when these trends fail.</p>
      </div>
      {probeData.length ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="mb-2 text-sm font-semibold text-orange-50">Exit probe centerline trace</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={probeData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="x" stroke="rgba(255,247,237,0.48)" />
                <YAxis yAxisId="left" stroke="rgba(255,247,237,0.48)" />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,247,237,0.48)" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", color: "#fff7ed" }} />
                <Line yAxisId="left" type="linear" dataKey="mach" stroke="#38bdf8" dot={false} />
                <Line yAxisId="left" type="linear" dataKey="density" stroke="#22c55e" dot={false} />
                <Line yAxisId="right" type="linear" dataKey="pressureKPa" stroke="#f97316" dot={false} />
                <Line yAxisId="right" type="linear" dataKey="axialVelocity" stroke="#a78bfa" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-orange-50/48">Blue: Mach, green: density, orange: pressure kPa, purple: axial velocity m/s. The orange exit probe line in the CFD viewport should sit inside this continuous trace.</p>
        </div>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <p className="mb-2 text-sm font-semibold text-orange-50">Residual convergence</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.residuals}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="iteration" stroke="rgba(255,247,237,0.48)" />
              <YAxis scale="log" domain={["auto", "auto"]} stroke="rgba(255,247,237,0.48)" />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", color: "#fff7ed" }} />
              <Line type="linear" dataKey="continuity" stroke="#38bdf8" dot={false} />
              <Line type="linear" dataKey="momentum" stroke="#f97316" dot={false} />
              <Line type="linear" dataKey="yMomentum" stroke="#22c55e" dot={false} />
              <Line type="linear" dataKey="energy" stroke="#a78bfa" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function exportRaspMotor(parameters: MotorParameters, result: MotorSimulationResult) {
  const header = `; Rocketry House simulation export\n; ${parameters.projectName}\n${result.motorClass}${result.averageThrustN} ${parameters.casingOuterDiameterMm} ${parameters.casingLengthMm} 0 0 ${result.estimatedLoadedMassG / 1000} ${result.propellantMassG / 1000} RocketryHouse\n`;
  const rows = result.curve.map((point) => `${point.time.toFixed(2)} ${(point.thrust || 0).toFixed(1)}`).join("\n");
  const blob = new Blob([`${header}${rows}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${parameters.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "motor"}.eng`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EngineeringReferencePanel({ title, equations, outputs }: { title: string; equations: readonly (readonly [string, string, string])[]; outputs: readonly string[] }) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Calculator className="h-5 w-5 text-cyan-200" />{title}</h2>
      <p className="mt-2 text-sm leading-6 text-orange-50/60">
        These blocks document the analysis model so builders understand what the graphs mean. Values are estimates for education, design review, and comparison against measured evidence.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {equations.map(([name, equation, note]) => (
          <div key={name} className="rounded-md border border-white/10 bg-[#0b101b] p-3">
            <p className="text-sm font-semibold text-orange-100">{name}</p>
            <p className="mt-2 font-mono text-xs text-cyan-100">{equation}</p>
            <p className="mt-2 text-xs leading-5 text-orange-50/52">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {outputs.map((output) => <p key={output} className="rounded-md bg-white/[0.04] p-2 text-xs text-orange-50/62">{output}</p>)}
      </div>
    </Card>
  );
}

function SafetyStrip() {
  return (
    <Card className="mt-6 border-amber-300/20 bg-amber-300/8 p-4">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
        <div className="grid gap-2 text-sm text-amber-50/85 md:grid-cols-3">
          {safetyWarnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      </div>
    </Card>
  );
}

function WorkspaceCard({ href, icon: Icon, title, copy, cta }: { href: string; icon: typeof Flame; title: string; copy: string; cta: string }) {
  return (
    <Card className="p-6">
      <Icon className="h-7 w-7 text-orange-200" />
      <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
      <p className="mt-3 text-orange-50/66">{copy}</p>
      <Button href={href} asChild className="mt-6">{cta}<ChevronRight className="h-4 w-4" /></Button>
    </Card>
  );
}

function BuilderHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <>
      <p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">{eyebrow}</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-semibold">{title}</h1>
      <p className="mt-4 max-w-3xl text-orange-50/68">{copy}</p>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-orange-50/45">{label}</p><p className="mt-1 font-semibold text-orange-50">{value}</p></div>;
}

function Curve({ title, units, data, lines }: { title: string; units?: string; data: Record<string, number | string | undefined>[]; lines: Array<[string, string]> }) {
  const mounted = useClientMounted();
  return (
    <div className="h-64 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-orange-50/70">{title}</p>
        {units ? <p className="text-[11px] text-orange-50/42">{units}</p> : null}
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="time" stroke="#cbbda8" fontSize={12} unit="s" />
            <YAxis stroke="#cbbda8" fontSize={12} />
            <Tooltip contentStyle={{ background: "#101726", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
            {lines.map(([key, color]) => <Line key={key} type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2} />)}
          </LineChart>
        </ResponsiveContainer>
      ) : <ChartSkeleton />}
    </div>
  );
}

function RawMeasuredPreview() {
  const mounted = useClientMounted();
  const sample = [
    { time: 0, thrust: 0 },
    { time: 0.2, thrust: 182 },
    { time: 0.4, thrust: 214 },
    { time: 0.6, thrust: 199 }
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="font-semibold">Measured thrust CSV preview</h3>
      {mounted ? (
        <AreaChart width={320} height={160} data={sample} className="mt-3 max-w-full">
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="time" stroke="#cbbda8" fontSize={12} />
          <YAxis stroke="#cbbda8" fontSize={12} />
          <Area dataKey="thrust" stroke="#5fb8ff" fill="#5fb8ff" fillOpacity={0.2} />
        </AreaChart>
      ) : <div className="mt-3"><ChartSkeleton /></div>}
      <p className="mt-2 text-xs text-orange-50/52">CSV import maps recognizable time/thrust columns and stores raw rows for review.</p>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full min-h-36 rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,.06)_0_1px,transparent_1px_33%),linear-gradient(90deg,rgba(95,184,255,.25),rgba(251,146,60,.2))] opacity-60" />;
}

function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function mergeMeasured(curve: MotorSimulationResult["curve"], measuredCurve?: MotorSimulationResult["curve"]) {
  return curve.map((point, index) => ({ ...point, measuredThrust: measuredCurve?.[index]?.thrust }));
}

function getMotorStorageKey() {
  if (typeof window === "undefined") return MOTOR_STORAGE_KEY;
  const user = readMockUser();
  return user?.id ? `${MOTOR_STORAGE_KEY}:${user.id}` : MOTOR_STORAGE_KEY;
}

function readStoredMotors() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getMotorStorageKey()) ?? "[]") as SavedMotor[];
    return parsed;
  } catch {
    return [];
  }
}

async function syncPersistentMotors() {
  if (typeof window === "undefined") return;
  const records = await loadPersistentRecords<SavedMotor>("saved_motors");
  if (!records.length) return;
  const cloudMotors = records.map((record) => record.payload);
  const localMotors = readStoredMotors();
  const merged = [
    ...cloudMotors,
    ...localMotors.filter((motor) => !cloudMotors.some((cloudMotor) => cloudMotor.id === motor.id))
  ];
  localStorage.setItem(getMotorStorageKey(), JSON.stringify(merged));
  window.dispatchEvent(new Event("rocketry-motors-change"));
}

function insertMotorComponent(components: RocketComponent[], motor: SavedMotor) {
  const length = Math.max(...components.map((component) => component.position + component.length));
  return [
    ...components,
    {
      id: `visible-${motor.id}`,
      type: "motor_mount" as const,
      name: motor.name,
      length: motor.parameters.casingLengthMm,
      diameter: motor.parameters.casingOuterDiameterMm,
      wallThickness: 2,
      material: "Saved motor",
      mass: motor.simulation.estimatedLoadedMassG,
      position: Math.max(0, length - motor.parameters.casingLengthMm - 80)
    }
  ];
}
