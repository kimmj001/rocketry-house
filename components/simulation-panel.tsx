"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Gauge, RotateCcw, SlidersHorizontal, Weight } from "lucide-react";
import { StabilityBadge } from "@/components/badges";
import { MultiTelemetryChart, TelemetryChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { estimateImpulseForTargetAltitude, runEngineeringEstimate } from "@/lib/simulation/estimates";
import type { RocketProject } from "@/lib/types";

type Controls = {
  motorImpulseNs: number;
  burnTimeS: number;
  dragCoefficient: number;
  launchAngleDeg: number;
  dryMassScale: number;
};

export function SimulationPanel({ project }: { project: RocketProject }) {
  const defaults = useMemo(() => {
    const burnTimeS = project.motorClass.toLowerCase().includes("liquid") ? 8 : project.motorClass.toLowerCase().includes("hybrid") ? 6 : 3.5;
    const dragCoefficient = project.specs.diameterMm > 300 ? 0.72 : 0.62;
    const base = { burnTimeS, dragCoefficient, launchAngleDeg: 90, dryMassScale: 1 };
    const targetAltitude = project.actualAltitudeM ?? project.predictedAltitudeM;
    return {
      ...base,
      motorImpulseNs: estimateImpulseForTargetAltitude(project.components, targetAltitude, base)
    };
  }, [project.actualAltitudeM, project.components, project.motorClass, project.predictedAltitudeM, project.specs.diameterMm]);

  const [controls, setControls] = useState<Controls>(defaults);
  const result = useMemo(() => runEngineeringEstimate(project.components, controls), [controls, project.components]);
  const altitudeDelta = typeof project.actualAltitudeM === "number" ? result.predictedAltitudeM - project.actualAltitudeM : result.predictedAltitudeM - project.predictedAltitudeM;
  const comparisonLabel = typeof project.actualAltitudeM === "number" ? "actual public altitude" : "public target altitude";

  function updateControl(key: keyof Controls, value: number) {
    setControls((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-orange-100/60">Interactive flight analysis</p>
              <h1 className="mt-2 text-3xl font-semibold">{project.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/68">
                This browser-side point-mass analysis reacts to motor impulse, burn time, drag, launch angle, and mass assumptions, while keeping CP/CG separate for later aerodynamic engines.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StabilityBadge margin={result.stabilityMargin} />
              <Button variant="outline" size="sm" onClick={() => setControls(defaults)}><RotateCcw className="h-4 w-4" />Reset</Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Apogee" value={`${formatNumber(result.predictedAltitudeM)} m`} detail={`${signed(altitudeDelta)} m vs ${comparisonLabel}`} />
            <Metric label="Max velocity" value={`${formatNumber(result.maxVelocityMps)} m/s`} detail={`Apogee at ${result.apogeeTimeS}s`} />
            <Metric label="Rail exit" value={`${formatNumber(result.railExitVelocityMps)} m/s`} detail={`T/W ${result.thrustToWeight}:1`} />
            <Metric label="Mass" value={`${formatNumber(result.massG / 1000)} kg`} detail={`Cd ${result.dragCoefficientEstimate}, area ${result.referenceAreaM2.toFixed(3)} m2`} />
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <TelemetryChart data={result.timeSeries} type="altitude" />
          <TelemetryChart data={result.timeSeries} type="velocity" />
        </div>
        <MultiTelemetryChart data={result.timeSeries} />

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-cyan-200" />Derived motor and flight summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Total impulse" value={`${formatNumber(result.motorImpulseNs)} N-s`} detail="editable input" compact />
            <Metric label="Average thrust" value={`${formatNumber(result.averageThrustN)} N`} detail={`${result.burnTimeS}s burn`} compact />
            <Metric label="Flight time" value={`${formatNumber(result.flightTimeS)} s`} detail="until ground return" compact />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-5 w-5 text-orange-200" />Simulation controls</h2>
          <div className="mt-5 space-y-5">
            <RangeControl label="Total impulse" value={controls.motorImpulseNs} min={Math.max(100, defaults.motorImpulseNs * 0.25)} max={Math.max(1000, defaults.motorImpulseNs * 2)} step={Math.max(10, Math.round(defaults.motorImpulseNs / 250))} unit="N-s" onChange={(value) => updateControl("motorImpulseNs", value)} />
            <RangeControl label="Burn time" value={controls.burnTimeS} min={0.5} max={Math.max(30, defaults.burnTimeS * 2)} step={0.1} unit="s" onChange={(value) => updateControl("burnTimeS", value)} />
            <RangeControl label="Drag coefficient" value={controls.dragCoefficient} min={0.25} max={1.4} step={0.01} unit="Cd" onChange={(value) => updateControl("dragCoefficient", value)} />
            <RangeControl label="Launch angle" value={controls.launchAngleDeg} min={80} max={90} step={0.1} unit="deg" onChange={(value) => updateControl("launchAngleDeg", value)} />
            <RangeControl label="Dry mass scale" value={controls.dryMassScale} min={0.7} max={1.4} step={0.01} unit="x" onChange={(value) => updateControl("dryMassScale", value)} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">CP / CG model</h2>
          <div className="mt-4 grid gap-3 text-sm text-orange-50/68">
            <p>CG: {formatNumber(result.cgMm)} mm from nose</p>
            <p>CP: {formatNumber(result.cpMm)} mm from nose</p>
            <p>Diameter: {formatNumber(result.diameterMm)} mm</p>
            <p>Stability margin: {result.stabilityMargin} calibers</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Weight className="h-5 w-5 text-orange-200" />Warnings</h2>
          <div className="mt-4 space-y-3">
            {result.warnings.map((warning) => (
              <p key={warning.message} className="flex gap-2 rounded-md bg-white/[0.04] p-3 text-sm text-orange-50/72">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />{warning.message}
              </p>
            ))}
            {!project.hasTelemetry && <p className="text-sm text-orange-50/60">No measured telemetry is attached for this public reference.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, compact }: { label: string; value: string; detail: string; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-orange-50/55">{label}</p>
      <p className={compact ? "mt-1 text-lg font-semibold" : "mt-1 text-xl font-semibold"}>{value}</p>
      <p className="mt-1 text-xs text-orange-50/48">{detail}</p>
    </div>
  );
}

function RangeControl({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm text-orange-50/68">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-xs text-orange-100">{formatNumber(value)} {unit}</span>
      </span>
      <input className="mt-3 w-full accent-orange-300" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

function signed(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${formatNumber(rounded)}`;
}
