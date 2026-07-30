"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Gauge,
  Grid3X3,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  StepForward
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_RANS_CONFIG,
  type CfdFieldName,
  type CfdWorkerRequest,
  type CfdWorkerResponse,
  type RansSolverConfig,
  type SolverResidualPoint,
  type SolverSnapshot
} from "@/lib/cfd/rans/types";

const FIELD_OPTIONS: Array<{ name: CfdFieldName; label: string; unit: string }> = [
  { name: "mach", label: "Mach number", unit: "" },
  { name: "pressure", label: "Static pressure", unit: "Pa" },
  { name: "temperature", label: "Static temperature", unit: "K" },
  { name: "density", label: "Density", unit: "kg/m3" },
  { name: "velocity", label: "Velocity magnitude", unit: "m/s" },
  { name: "axialVelocity", label: "Axial velocity", unit: "m/s" },
  { name: "turbulentViscosityRatio", label: "Turbulent viscosity ratio", unit: "mu_t/mu" },
  { name: "residual", label: "Update magnitude", unit: "" }
];

const VIRIDIS = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37]
] as const;

function scientificColor(value: number) {
  const t = Math.max(0, Math.min(1, value));
  const scaled = t * (VIRIDIS.length - 1);
  const index = Math.min(VIRIDIS.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const left = VIRIDIS[index];
  const right = VIRIDIS[index + 1];
  const channel = (component: number) => Math.round(left[component] + (right[component] - left[component]) * local);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 10000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) return value.toExponential(2);
  if (Math.abs(value) >= 100) return value.toFixed(1);
  return value.toFixed(3);
}

function transferFreeMessage(worker: Worker, message: CfdWorkerRequest) {
  worker.postMessage(message);
}

function NozzleFieldCanvas({
  snapshot,
  fieldName,
  mirror,
  showMesh,
  autoRange,
  fixedMin,
  fixedMax
}: {
  snapshot: SolverSnapshot | null;
  fieldName: CfdFieldName;
  mirror: boolean;
  showMesh: boolean;
  autoRange: boolean;
  fixedMin: number;
  fixedMax: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const draw = () => {
      const width = Math.max(parent.clientWidth, 320);
      const height = Math.max(Math.round(width * 0.42), 260);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#05070b";
      context.fillRect(0, 0, width, height);

      const { nx, nr, xFaces, wallFaces, maxRadiusM } = snapshot.mesh;
      const values = snapshot.fields[fieldName];
      const computed = snapshot.ranges[fieldName];
      const min = autoRange ? computed.min : fixedMin;
      const max = autoRange ? computed.max : Math.max(fixedMax, fixedMin + 1e-12);
      const plotLeft = 20;
      const plotRight = width - 20;
      const plotTop = 22;
      const plotBottom = height - 42;
      const centerY = mirror ? 0.5 * (plotTop + plotBottom) : plotBottom;
      const radialScale = mirror
        ? 0.46 * (plotBottom - plotTop) / maxRadiusM
        : 0.92 * (plotBottom - plotTop) / maxRadiusM;
      const xScale = (plotRight - plotLeft) / snapshot.mesh.lengthM;

      context.lineWidth = 0.45;
      for (let i = 0; i < nx; i += 1) {
        const x0 = plotLeft + xFaces[i] * xScale;
        const x1 = plotLeft + xFaces[i + 1] * xScale;
        const wall0 = wallFaces[i];
        const wall1 = wallFaces[i + 1];
        for (let j = 0; j < nr; j += 1) {
          const index = i * nr + j;
          const normalized = (values[index] - min) / Math.max(max - min, 1e-20);
          context.fillStyle = scientificColor(normalized);
          const eta0 = j / nr;
          const eta1 = (j + 1) / nr;
          const upper = new Path2D();
          upper.moveTo(x0, centerY - eta0 * wall0 * radialScale);
          upper.lineTo(x1, centerY - eta0 * wall1 * radialScale);
          upper.lineTo(x1, centerY - eta1 * wall1 * radialScale);
          upper.lineTo(x0, centerY - eta1 * wall0 * radialScale);
          upper.closePath();
          context.fill(upper);
          if (showMesh) {
            context.strokeStyle = "rgba(255,255,255,0.14)";
            context.stroke(upper);
          }
          if (mirror) {
            const lower = new Path2D();
            lower.moveTo(x0, centerY + eta0 * wall0 * radialScale);
            lower.lineTo(x1, centerY + eta0 * wall1 * radialScale);
            lower.lineTo(x1, centerY + eta1 * wall1 * radialScale);
            lower.lineTo(x0, centerY + eta1 * wall0 * radialScale);
            lower.closePath();
            context.fill(lower);
            if (showMesh) context.stroke(lower);
          }
        }
      }

      context.strokeStyle = "#f8fafc";
      context.lineWidth = 1.2;
      context.beginPath();
      for (let i = 0; i < xFaces.length; i += 1) {
        const x = plotLeft + xFaces[i] * xScale;
        const y = centerY - wallFaces[i] * radialScale;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (mirror) {
        context.beginPath();
        for (let i = 0; i < xFaces.length; i += 1) {
          const x = plotLeft + xFaces[i] * xScale;
          const y = centerY + wallFaces[i] * radialScale;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
      context.strokeStyle = "rgba(255,255,255,0.28)";
      context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(plotLeft, centerY);
      context.lineTo(plotRight, centerY);
      context.stroke();
      context.setLineDash([]);

      const legendLeft = plotLeft;
      const legendTop = height - 24;
      const legendWidth = Math.min(250, width * 0.34);
      const gradient = context.createLinearGradient(legendLeft, 0, legendLeft + legendWidth, 0);
      VIRIDIS.forEach((color, index) => {
        gradient.addColorStop(index / (VIRIDIS.length - 1), `rgb(${color.join(",")})`);
      });
      context.fillStyle = gradient;
      context.fillRect(legendLeft, legendTop, legendWidth, 7);
      context.fillStyle = "rgba(248,250,252,0.78)";
      context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textBaseline = "bottom";
      context.fillText(formatNumber(min), legendLeft, legendTop - 2);
      const maxText = formatNumber(max);
      const maxWidth = context.measureText(maxText).width;
      context.fillText(maxText, legendLeft + legendWidth - maxWidth, legendTop - 2);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [autoRange, fieldName, fixedMax, fixedMin, mirror, showMesh, snapshot]);

  return (
    <div className="min-h-[260px] w-full overflow-hidden bg-[#05070b]">
      <canvas ref={canvasRef} className="block" aria-label={`${fieldName} CFD field`} />
    </div>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-white/58">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-white/12 bg-[#11151d] px-2 text-sm text-white"
      >
        {children}
      </select>
    </label>
  );
}

function NumberControl({
  label,
  value,
  step,
  min,
  max,
  onChange,
  suffix
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-white/58">
      {label}
      <span className="flex h-9 items-center rounded-md border border-white/12 bg-[#11151d] px-2">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        />
        {suffix ? <span className="ml-2 text-[11px] text-white/38">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function NozzleCfdLab() {
  const workerRef = useRef<Worker | null>(null);
  const initialConfigRef = useRef<RansSolverConfig>(structuredClone(DEFAULT_RANS_CONFIG));
  const [config, setConfig] = useState<RansSolverConfig>(() => structuredClone(DEFAULT_RANS_CONFIG));
  const [snapshot, setSnapshot] = useState<SolverSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState<CfdFieldName>("mach");
  const [mirror, setMirror] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [autoRange, setAutoRange] = useState(true);
  const [fixedMin, setFixedMin] = useState(0);
  const [fixedMax, setFixedMax] = useState(3);
  const [residualHistory, setResidualHistory] = useState<SolverResidualPoint[]>([]);

  useEffect(() => {
    const worker = new Worker(new URL("../lib/cfd/worker/cfd.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onerror = (event) => {
      setError(event.message || "The CFD worker could not be loaded.");
      setRunning(false);
      setReady(false);
    };
    worker.onmessage = (event: MessageEvent<CfdWorkerResponse>) => {
      const response = event.data;
      if (response.type === "error") {
        setError(response.message);
        setRunning(false);
        return;
      }
      if (response.type === "status") {
        setRunning(response.running);
        return;
      }
      setSnapshot(response.snapshot);
      setReady(true);
      setError(response.snapshot.diagnostics.failureReason ?? null);
      if (response.type === "snapshot") setRunning(response.running);
      const residual = response.snapshot.diagnostics.residual;
      setResidualHistory((current) => {
        if (current.at(-1)?.iteration === residual.iteration) return current;
        return [...current.slice(-119), residual];
      });
    };
    transferFreeMessage(worker, { type: "initialize", config: initialConfigRef.current });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const selectedField = useMemo(
    () => FIELD_OPTIONS.find((field) => field.name === fieldName) ?? FIELD_OPTIONS[0],
    [fieldName]
  );
  const diagnostics = snapshot?.diagnostics;

  const updateConfig = (next: RansSolverConfig) => {
    setConfig(next);
    setDirty(true);
  };
  const updateGeometry = (key: keyof RansSolverConfig["geometry"], value: number) => {
    updateConfig({ ...config, geometry: { ...config.geometry, [key]: value } });
  };
  const applyAndReset = () => {
    if (!workerRef.current) return;
    setRunning(false);
    setError(null);
    setResidualHistory([]);
    setDirty(false);
    transferFreeMessage(workerRef.current, { type: "reset", config });
  };

  const status = diagnostics?.failed
    ? "Failed"
    : diagnostics?.converged
      ? "Converged"
      : running
        ? "Running"
        : ready
          ? "Paused"
          : "Initializing";

  return (
    <main className="min-h-screen bg-[#07090d] pb-24 pt-20 text-white">
      <div className="border-b border-white/10 bg-[#0b0e13]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-orange-300/68">Motor analysis</p>
            <h1 className="mt-1 text-xl font-semibold">Axisymmetric Nozzle CFD</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mr-2 inline-flex items-center gap-2 text-xs ${diagnostics?.failed ? "text-rose-300" : running ? "text-emerald-300" : "text-white/55"}`}>
              <span className={`h-2 w-2 rounded-full ${diagnostics?.failed ? "bg-rose-400" : running ? "bg-emerald-400" : "bg-white/35"}`} />
              {status}
            </span>
            <Button
              size="sm"
              onClick={() => {
                if (!workerRef.current) return;
                transferFreeMessage(workerRef.current, { type: running ? "pause" : "start" });
              }}
              disabled={!ready || Boolean(diagnostics?.failed)}
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : diagnostics?.iteration ? "Resume" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => workerRef.current && transferFreeMessage(workerRef.current, { type: "step", iterations: 1 })}
              disabled={!ready || running || Boolean(diagnostics?.failed)}
            >
              <StepForward className="h-4 w-4" />
              Step
            </Button>
            <Button size="sm" variant="outline" onClick={applyAndReset} disabled={!ready}>
              <RotateCcw className="h-4 w-4" />
              {dirty ? "Apply & reset" : "Reset"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0a0d12] p-5 lg:border-b-0 lg:border-r">
          <div className="grid gap-5">
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-orange-300" /> Physics</h2>
              <div className="mt-3 grid gap-3">
                <SelectControl
                  label="Gas properties"
                  value={config.thermoModel}
                  onChange={(value) => updateConfig({ ...config, thermoModel: value as RansSolverConfig["thermoModel"] })}
                >
                  <option value="hydroloxFrozen">Frozen hydrolox</option>
                  <option value="constantGas">Constant ideal gas</option>
                </SelectControl>
                <SelectControl
                  label="Viscous model"
                  value={config.turbulence}
                  onChange={(value) => updateConfig({ ...config, turbulence: value as RansSolverConfig["turbulence"] })}
                >
                  <option value="spalartAllmaras">Spalart-Allmaras</option>
                  <option value="laminar">Laminar</option>
                </SelectControl>
                <NumberControl label="Chamber pressure" value={config.chamberPressurePa / 1e6} step={0.1} min={0.1} onChange={(value) => updateConfig({ ...config, chamberPressurePa: value * 1e6 })} suffix="MPa" />
                <NumberControl label="Chamber temperature" value={config.chamberTemperatureK} step={10} min={300} onChange={(value) => updateConfig({ ...config, chamberTemperatureK: value })} suffix="K" />
                <NumberControl label="Ambient pressure" value={config.ambientPressurePa / 1000} step={1} min={0.001} onChange={(value) => updateConfig({ ...config, ambientPressurePa: value * 1000 })} suffix="kPa" />
                <NumberControl label="Turbulent Prandtl" value={config.turbulentPrandtl} step={0.05} min={0.1} max={2} onChange={(value) => updateConfig({ ...config, turbulentPrandtl: value })} />
              </div>
            </section>

            <section className="border-t border-white/10 pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="h-4 w-4 text-orange-300" /> Numerics</h2>
              <div className="mt-3 grid gap-3">
                <SelectControl
                  label="Reconstruction"
                  value={config.reconstruction}
                  onChange={(value) => updateConfig({ ...config, reconstruction: value as RansSolverConfig["reconstruction"] })}
                >
                  <option value="musclVenkatakrishnan">MUSCL + Venkatakrishnan</option>
                  <option value="firstOrder">First order</option>
                </SelectControl>
                <SelectControl
                  label="Resolution"
                  value={config.resolution}
                  onChange={(value) => updateConfig({ ...config, resolution: value as RansSolverConfig["resolution"], nx: undefined, nr: undefined })}
                >
                  <option value="development">Development · 96 x 36</option>
                  <option value="standard">Standard · 160 x 56</option>
                  <option value="high">High · 240 x 80</option>
                </SelectControl>
                <NumberControl label="Initial CFL" value={config.cfl} step={0.01} min={0.005} max={0.5} onChange={(value) => updateConfig({ ...config, cfl: value })} />
                <NumberControl label="Iterations per batch" value={config.iterationsPerBatch} step={1} min={1} max={20} onChange={(value) => updateConfig({ ...config, iterationsPerBatch: value })} />
                <label className="flex items-center justify-between gap-3 text-xs text-white/58">
                  CFL ramp
                  <input
                    type="checkbox"
                    checked={config.cflRamp}
                    onChange={(event) => updateConfig({ ...config, cflRamp: event.target.checked })}
                    className="h-4 w-4 accent-orange-400"
                  />
                </label>
              </div>
            </section>

            <details className="border-t border-white/10 pt-5">
              <summary className="cursor-pointer text-sm font-semibold text-white/80">Geometry</summary>
              <div className="mt-3 grid gap-3">
                <NumberControl label="Chamber radius" value={config.geometry.chamberRadiusM * 1000} step={1} min={2} onChange={(value) => updateGeometry("chamberRadiusM", value / 1000)} suffix="mm" />
                <NumberControl label="Throat radius" value={config.geometry.throatRadiusM * 1000} step={0.5} min={1} onChange={(value) => updateGeometry("throatRadiusM", value / 1000)} suffix="mm" />
                <NumberControl label="Exit radius" value={config.geometry.exitRadiusM * 1000} step={1} min={1} onChange={(value) => updateGeometry("exitRadiusM", value / 1000)} suffix="mm" />
                <NumberControl label="Chamber length" value={config.geometry.chamberLengthM * 1000} step={5} min={5} onChange={(value) => updateGeometry("chamberLengthM", value / 1000)} suffix="mm" />
                <NumberControl label="Convergent length" value={config.geometry.convergentLengthM * 1000} step={5} min={5} onChange={(value) => updateGeometry("convergentLengthM", value / 1000)} suffix="mm" />
                <NumberControl label="Divergent length" value={config.geometry.divergentLengthM * 1000} step={5} min={5} onChange={(value) => updateGeometry("divergentLengthM", value / 1000)} suffix="mm" />
              </div>
            </details>
          </div>
        </aside>

        <div className="min-w-0">
          <section className="border-b border-white/10">
            <div className="flex flex-wrap items-end gap-3 border-b border-white/10 bg-[#0d1118] px-5 py-3">
              <SelectControl label="Field" value={fieldName} onChange={(value) => setFieldName(value as CfdFieldName)}>
                {FIELD_OPTIONS.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
              </SelectControl>
              <label className="flex h-9 items-center gap-2 text-xs text-white/58">
                <input type="checkbox" checked={autoRange} onChange={(event) => setAutoRange(event.target.checked)} className="h-4 w-4 accent-orange-400" />
                Auto range
              </label>
              {!autoRange ? (
                <>
                  <NumberControl label="Minimum" value={fixedMin} step={0.1} min={-1e12} onChange={setFixedMin} />
                  <NumberControl label="Maximum" value={fixedMax} step={0.1} min={-1e12} onChange={setFixedMax} />
                </>
              ) : null}
              <button type="button" onClick={() => setMirror((value) => !value)} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs ${mirror ? "border-orange-300/40 bg-orange-300/10 text-orange-100" : "border-white/12 text-white/55"}`}>
                <Gauge className="h-4 w-4" /> Mirror
              </button>
              <button type="button" onClick={() => setShowMesh((value) => !value)} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs ${showMesh ? "border-orange-300/40 bg-orange-300/10 text-orange-100" : "border-white/12 text-white/55"}`}>
                <Grid3X3 className="h-4 w-4" /> Mesh
              </button>
            </div>
            <NozzleFieldCanvas
              snapshot={snapshot}
              fieldName={fieldName}
              mirror={mirror}
              showMesh={showMesh}
              autoRange={autoRange}
              fixedMin={fixedMin}
              fixedMax={fixedMax}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0a0d12] px-5 py-2 text-xs text-white/48">
              <span>{selectedField.label} {snapshot ? `${formatNumber(snapshot.ranges[fieldName].min)} to ${formatNumber(snapshot.ranges[fieldName].max)} ${selectedField.unit}` : ""}</span>
              <span>Cell-centered axisymmetric field · r &gt;= 0</span>
            </div>
          </section>

          {error ? (
            <div className="m-5 flex items-start gap-3 border border-rose-300/25 bg-rose-300/8 p-4 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="grid border-b border-white/10 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Iteration", diagnostics?.iteration.toLocaleString() ?? "0"],
              ["CFL", diagnostics ? diagnostics.cfl.toFixed(3) : "0.000"],
              ["dt", diagnostics ? `${diagnostics.dtS.toExponential(2)} s` : "0 s"],
              ["Max Mach", diagnostics ? diagnostics.maxMach.toFixed(3) : "0.000"],
              ["Min pressure", diagnostics ? `${(diagnostics.minPressurePa / 1000).toFixed(2)} kPa` : "0 kPa"],
              ["HLLC fallbacks", diagnostics?.hllcFallbacks.toLocaleString() ?? "0"]
            ].map(([label, value]) => (
              <div key={label} className="border-b border-white/10 px-4 py-3 sm:border-r">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/38">{label}</p>
                <p className="mt-1 font-mono text-sm text-white/88">{value}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-0 xl:grid-cols-2">
            <section className="border-b border-white/10 p-5 xl:border-r">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Residual history</h2>
                <span className="font-mono text-xs text-white/45">{diagnostics ? diagnostics.residual.continuity.toExponential(2) : "0.00e+0"}</span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={residualHistory}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="iteration" stroke="rgba(255,255,255,0.34)" />
                    <YAxis scale="log" domain={["auto", "auto"]} stroke="rgba(255,255,255,0.34)" />
                    <Tooltip contentStyle={{ background: "#11151d", border: "1px solid rgba(255,255,255,0.12)" }} />
                    <Line dataKey="continuity" stroke="#38bdf8" dot={false} isAnimationActive={false} />
                    <Line dataKey="axialMomentum" stroke="#fb923c" dot={false} isAnimationActive={false} />
                    <Line dataKey="energy" stroke="#a78bfa" dot={false} isAnimationActive={false} />
                    <Line dataKey="turbulence" stroke="#4ade80" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="border-b border-white/10 p-5">
              <h2 className="text-sm font-semibold">Mass-flow balance</h2>
              <div className="mt-4 grid gap-2">
                {(diagnostics?.massFlow ?? []).map((station) => (
                  <div key={station.station} className="grid grid-cols-[1fr_auto] items-center border-b border-white/8 py-2 text-sm">
                    <span className="capitalize text-white/55">{station.station.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-mono text-white/88">{station.massFlowKgS.toFixed(5)} kg/s</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Minimum density", diagnostics ? `${diagnostics.minDensityKgM3.toExponential(3)} kg/m3` : "n/a"],
                ["Minimum temperature", diagnostics ? `${diagnostics.minTemperatureK.toFixed(2)} K` : "n/a"],
                ["Max mu_t/mu", diagnostics ? diagnostics.maxTurbulentViscosityRatio.toFixed(2) : "n/a"],
                ["Limited faces", diagnostics?.limitedFaces.toLocaleString() ?? "0"],
                ["First-order fallbacks", diagnostics?.firstOrderFallbacks.toLocaleString() ?? "0"],
                ["Rejected steps", diagnostics?.rejectedSteps.toLocaleString() ?? "0"],
                ["Positivity corrections", diagnostics?.positivityCorrections.toLocaleString() ?? "0"],
                ["NaN / Infinity", diagnostics?.nanCount ? diagnostics.nanCount.toLocaleString() : "0"]
              ].map(([label, value]) => (
                <div key={label} className="border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-xs text-white/42">{label}</p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-sm">
                    {label === "NaN / Infinity" && value === "0" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-white/42">
              Educational CFD visualization. Results require independent mesh-convergence and experimental validation before engineering use.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
