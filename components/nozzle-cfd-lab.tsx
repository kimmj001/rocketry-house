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
  INTERACTIVE_RANS_DIMENSIONS,
  type CfdFieldName,
  type CfdWorkerRequest,
  type CfdWorkerResponse,
  type RansSolverConfig,
  type SolverResidualPoint,
  type SolverSnapshot
} from "@/lib/cfd/rans/types";
import {
  colorSensitivityPosition,
  pressureContrastPosition,
  pressureContrastScale
} from "@/lib/cfd/rans/visualization";

function createInteractiveConfig(): RansSolverConfig {
  const base = structuredClone(DEFAULT_RANS_CONFIG);
  const dimensions = INTERACTIVE_RANS_DIMENSIONS[base.resolution];
  return {
    ...base,
    ...dimensions,
    reconstruction: "musclVenkatakrishnan",
    iterationsPerBatch: 16
  };
}

type DisplayFieldName = CfdFieldName;

const FIELD_OPTIONS: Array<{ name: DisplayFieldName; label: string; unit: string }> = [
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

const PRESSURE_DIVERGING = [
  [45, 86, 132],
  [54, 119, 151],
  [74, 139, 158],
  [60, 82, 88],
  [31, 38, 42],
  [88, 72, 53],
  [164, 108, 61],
  [207, 151, 76],
  [232, 196, 99]
] as const;

const STANDARD_ATMOSPHERE_PA = 101325;
const FIELD_BACKGROUND = [5, 7, 11] as const;

function writeScientificColor(
  target: Uint8ClampedArray,
  offset: number,
  value: number,
  visibility: number,
  palette: ReadonlyArray<readonly [number, number, number]> = VIRIDIS
) {
  const t = Math.max(0, Math.min(1, value));
  const scaled = t * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const left = palette[index];
  const right = palette[index + 1];
  const strength = Math.max(0, Math.min(1, visibility));
  for (let component = 0; component < 3; component += 1) {
    const color = left[component] + (right[component] - left[component]) * local;
    target[offset + component] = Math.round(
      FIELD_BACKGROUND[component] + (color - FIELD_BACKGROUND[component]) * strength
    );
  }
  target[offset + 3] = 255;
}

function radialSample(
  field: ArrayLike<number>,
  column: number,
  radiusM: number,
  snapshot: SolverSnapshot
): number | null {
  const { nr, columnOuterRadius, cellR } = snapshot.mesh;
  if (radiusM > columnOuterRadius[column]) return null;
  const offset = column * nr;
  if (radiusM <= cellR[offset]) return field[offset];
  if (radiusM >= cellR[offset + nr - 1]) return field[offset + nr - 1];
  let low = 0;
  let high = nr - 1;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (cellR[offset + mid] <= radiusM) low = mid;
    else high = mid;
  }
  const span = Math.max(cellR[offset + high] - cellR[offset + low], 1e-12);
  const fraction = Math.max(0, Math.min(1, (radiusM - cellR[offset + low]) / span));
  return field[offset + low] * (1 - fraction) + field[offset + high] * fraction;
}

function physicalSample(
  field: ArrayLike<number>,
  i0: number,
  i1: number,
  tx: number,
  radiusM: number,
  snapshot: SolverSnapshot
) {
  const left = radialSample(field, i0, radiusM, snapshot);
  const right = radialSample(field, i1, radiusM, snapshot);
  if (left === null) return right;
  if (right === null) return left;
  return left * (1 - tx) + right * tx;
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
  fixedMax,
  ambientPressurePa,
  colorSensitivity,
  onColorSensitivityChange
}: {
  snapshot: SolverSnapshot | null;
  fieldName: DisplayFieldName;
  mirror: boolean;
  showMesh: boolean;
  autoRange: boolean;
  fixedMin: number;
  fixedMax: number;
  ambientPressurePa: number;
  colorSensitivity: number;
  onColorSensitivityChange: (value: number) => void;
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

      const {
        nx,
        nr,
        xFaces,
        wallFaces,
        columnOuterRadius,
        maxRadiusM,
        nozzleExitIndex
      } = snapshot.mesh;
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
      const pressureContrastPa = pressureContrastScale(
        snapshot.fields.pressure,
        ambientPressurePa,
        (nozzleExitIndex + 1) * nr
      ) / colorSensitivity;
      const pressurePaletteActive = fieldName === "pressure" && autoRange;

      const rasterWidth = Math.max(1, Math.ceil(plotRight - plotLeft));
      const rasterHeight = Math.max(1, Math.ceil(plotBottom - plotTop));
      const fieldCanvas = document.createElement("canvas");
      fieldCanvas.width = rasterWidth;
      fieldCanvas.height = rasterHeight;
      const fieldContext = fieldCanvas.getContext("2d");
      if (!fieldContext) return;
      const image = fieldContext.createImageData(rasterWidth, rasterHeight);
      const xSamples: Array<{
        xM: number;
        wallRadiusM: number;
        i0: number;
        i1: number;
        tx: number;
      }> = [];
      let faceI = 0;
      for (let pixelX = 0; pixelX < rasterWidth; pixelX += 1) {
        const xM = (pixelX + 0.5) / xScale;
        while (faceI < nx - 1 && xM >= xFaces[faceI + 1]) faceI += 1;
        const faceSpan = Math.max(xFaces[faceI + 1] - xFaces[faceI], 1e-12);
        const faceFraction = Math.max(0, Math.min(1, (xM - xFaces[faceI]) / faceSpan));
        const wallRadiusM = faceI <= nozzleExitIndex
          ? wallFaces[faceI] +
            (wallFaces[faceI + 1] - wallFaces[faceI]) * faceFraction
          : columnOuterRadius[faceI];
        const center = 0.5 * (xFaces[faceI] + xFaces[faceI + 1]);
        let i0 = faceI;
        let i1 = faceI;
        let tx = 0;
        if (xM >= center && faceI < nx - 1) {
          i1 = faceI + 1;
          const nextCenter = 0.5 * (xFaces[i1] + xFaces[i1 + 1]);
          tx = Math.max(0, Math.min(1, (xM - center) / Math.max(nextCenter - center, 1e-12)));
        } else if (faceI > 0) {
          i0 = faceI - 1;
          i1 = faceI;
          const previousCenter = 0.5 * (xFaces[i0] + xFaces[i0 + 1]);
          tx = Math.max(0, Math.min(1, (xM - previousCenter) / Math.max(center - previousCenter, 1e-12)));
        }
        xSamples.push({ xM, wallRadiusM, i0, i1, tx });
      }

      const palette = pressurePaletteActive ? PRESSURE_DIVERGING : VIRIDIS;
      for (let pixelY = 0; pixelY < rasterHeight; pixelY += 1) {
        const canvasY = plotTop + pixelY + 0.5;
        for (let pixelX = 0; pixelX < rasterWidth; pixelX += 1) {
          const offset = (pixelY * rasterWidth + pixelX) * 4;
          const sample = xSamples[pixelX];
          const radiusM = Math.abs(canvasY - centerY) / radialScale;
          if (radiusM > sample.wallRadiusM) {
            image.data[offset] = FIELD_BACKGROUND[0];
            image.data[offset + 1] = FIELD_BACKGROUND[1];
            image.data[offset + 2] = FIELD_BACKGROUND[2];
            image.data[offset + 3] = 255;
            continue;
          }
          const sampledValue = physicalSample(
            values,
            sample.i0,
            sample.i1,
            sample.tx,
            radiusM,
            snapshot
          );
          if (sampledValue === null) {
            image.data[offset] = FIELD_BACKGROUND[0];
            image.data[offset + 1] = FIELD_BACKGROUND[1];
            image.data[offset + 2] = FIELD_BACKGROUND[2];
            image.data[offset + 3] = 255;
            continue;
          }
          const baseNormalized = pressurePaletteActive
            ? pressureContrastPosition(sampledValue, ambientPressurePa, pressureContrastPa)
            : (sampledValue - min) / Math.max(max - min, 1e-20);
          const normalized = pressurePaletteActive
            ? baseNormalized
            : colorSensitivityPosition(baseNormalized, colorSensitivity);
          writeScientificColor(image.data, offset, normalized, 1, palette);
        }
      }
      fieldContext.putImageData(image, 0, 0);
      context.save();
      context.imageSmoothingEnabled = true;
      context.drawImage(fieldCanvas, plotLeft, plotTop, rasterWidth, rasterHeight);
      context.restore();

      if (showMesh) {
        context.strokeStyle = "rgba(255,255,255,0.14)";
        context.lineWidth = 0.45;
        for (let i = 0; i < nx; i += 1) {
          const x0 = plotLeft + xFaces[i] * xScale;
          const x1 = plotLeft + xFaces[i + 1] * xScale;
          const insideNozzle = i <= nozzleExitIndex;
          const outerLeft = insideNozzle ? wallFaces[i] : columnOuterRadius[i];
          const outerRight = insideNozzle ? wallFaces[i + 1] : columnOuterRadius[i];
          for (let j = 0; j < nr; j += 1) {
            const eta0 = insideNozzle ? j / nr : (j / nr) ** 1.7;
            const eta1 = insideNozzle ? (j + 1) / nr : ((j + 1) / nr) ** 1.7;
            context.stroke(new Path2D(
              `M ${x0} ${centerY - eta0 * outerLeft * radialScale} ` +
              `L ${x1} ${centerY - eta0 * outerRight * radialScale} ` +
              `L ${x1} ${centerY - eta1 * outerRight * radialScale} ` +
              `L ${x0} ${centerY - eta1 * outerLeft * radialScale} Z`
            ));
            if (mirror) {
              context.stroke(new Path2D(
                `M ${x0} ${centerY + eta0 * outerLeft * radialScale} ` +
                `L ${x1} ${centerY + eta0 * outerRight * radialScale} ` +
                `L ${x1} ${centerY + eta1 * outerRight * radialScale} ` +
                `L ${x0} ${centerY + eta1 * outerLeft * radialScale} Z`
              ));
            }
          }
        }
      }

      context.strokeStyle = "#f8fafc";
      context.lineWidth = 1.2;
      context.beginPath();
      for (let i = 0; i <= nozzleExitIndex + 1; i += 1) {
        const x = plotLeft + xFaces[i] * xScale;
        const y = centerY - wallFaces[i] * radialScale;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (mirror) {
        context.beginPath();
        for (let i = 0; i <= nozzleExitIndex + 1; i += 1) {
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
      const legendWidth = Math.min(250, Math.max(180, width * 0.34));
      const gradient = context.createLinearGradient(legendLeft, 0, legendLeft + legendWidth, 0);
      const legendPalette = pressurePaletteActive ? PRESSURE_DIVERGING : VIRIDIS;
      legendPalette.forEach((color, index) => {
        gradient.addColorStop(index / (legendPalette.length - 1), `rgb(${color.join(",")})`);
      });
      context.fillStyle = gradient;
      context.fillRect(legendLeft, legendTop, legendWidth, 7);
      context.fillStyle = "rgba(248,250,252,0.78)";
      context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textBaseline = "bottom";
      const legendMin = pressurePaletteActive
        ? Math.max(0, ambientPressurePa - pressureContrastPa)
        : min;
      const legendMax = pressurePaletteActive
        ? ambientPressurePa + pressureContrastPa
        : max;
      context.fillText(formatNumber(legendMin), legendLeft, legendTop - 2);
      if (pressurePaletteActive) {
        const ambientText = formatNumber(ambientPressurePa);
        const ambientWidth = context.measureText(ambientText).width;
        context.fillText(ambientText, legendLeft + 0.5 * legendWidth - 0.5 * ambientWidth, legendTop - 2);
      }
      const maxText = formatNumber(legendMax);
      const maxWidth = context.measureText(maxText).width;
      context.fillText(maxText, legendLeft + legendWidth - maxWidth, legendTop - 2);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [ambientPressurePa, autoRange, colorSensitivity, fieldName, fixedMax, fixedMin, mirror, showMesh, snapshot]);

  return (
    <div className="relative min-h-[260px] w-full overflow-hidden bg-[#05070b]">
      <canvas ref={canvasRef} className="block" aria-label={`${fieldName} CFD field`} />
      <label
        className="absolute bottom-[7px] grid w-[clamp(92px,18vw,170px)] gap-1 text-[10px] text-white/62"
        style={{ left: "calc(32px + min(250px, max(180px, 34%)))" }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="sm:hidden">Color</span>
          <span className="hidden sm:inline">Color sensitivity</span>
          <span className="font-mono text-white/78">{colorSensitivity.toFixed(1)}x</span>
        </span>
        <input
          type="range"
          aria-label="Color sensitivity"
          min={0.5}
          max={2.5}
          step={0.1}
          value={colorSensitivity}
          onChange={(event) => onColorSensitivityChange(Number(event.target.value))}
          className="h-1 w-full cursor-pointer accent-orange-400"
        />
      </label>
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
  const initialConfigRef = useRef<RansSolverConfig>(createInteractiveConfig());
  const [config, setConfig] = useState<RansSolverConfig>(createInteractiveConfig);
  const [snapshot, setSnapshot] = useState<SolverSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState<DisplayFieldName>("pressure");
  const [mirror, setMirror] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [autoRange, setAutoRange] = useState(true);
  const [fixedMin, setFixedMin] = useState(0);
  const [fixedMax, setFixedMax] = useState(3);
  const [colorSensitivity, setColorSensitivity] = useState(1);
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
                <NumberControl label="Ambient pressure" value={config.ambientPressurePa / STANDARD_ATMOSPHERE_PA} step={0.05} min={0.001} max={10} onChange={(value) => updateConfig({ ...config, ambientPressurePa: value * STANDARD_ATMOSPHERE_PA })} suffix="atm" />
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
                  <option value="firstOrder">First order - fast preview</option>
                  <option value="musclVenkatakrishnan">MUSCL + Venkatakrishnan - accurate</option>
                </SelectControl>
                <SelectControl
                  label="Resolution"
                  value={config.resolution}
                  onChange={(value) => {
                    const resolution = value as RansSolverConfig["resolution"];
                    updateConfig({ ...config, resolution, ...INTERACTIVE_RANS_DIMENSIONS[resolution] });
                  }}
                >
                  <option value="development">Development - 96 x 18</option>
                  <option value="standard">Standard - 144 x 28</option>
                  <option value="high">High - 208 x 40</option>
                </SelectControl>
                <SelectControl
                  label="Time stepping"
                  value={config.timeStepping}
                  onChange={(value) => updateConfig({ ...config, timeStepping: value as RansSolverConfig["timeStepping"] })}
                >
                  <option value="localPseudoTime">Local pseudo-time - fast steady RANS</option>
                  <option value="global">Global explicit - transient</option>
                </SelectControl>
                <NumberControl label="Initial CFL" value={config.cfl} step={0.01} min={0.005} max={0.5} onChange={(value) => updateConfig({ ...config, cfl: value })} />
                <NumberControl label="Iterations per batch" value={config.iterationsPerBatch} step={1} min={1} max={64} onChange={(value) => updateConfig({ ...config, iterationsPerBatch: value })} />
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
                <NumberControl label="External domain length" value={config.geometry.externalLengthM} step={0.1} min={0.1} max={20} onChange={(value) => updateGeometry("externalLengthM", value)} suffix="m" />
                <NumberControl label="Farfield radius" value={config.geometry.farfieldRadiusM * 1000} step={10} min={10} max={2000} onChange={(value) => updateGeometry("farfieldRadiusM", value / 1000)} suffix="mm" />
              </div>
            </details>
          </div>
        </aside>

        <div className="min-w-0">
          <section className="border-b border-white/10">
            <div className="flex flex-wrap items-end gap-3 border-b border-white/10 bg-[#0d1118] px-5 py-3">
              <SelectControl label="Field" value={fieldName} onChange={(value) => setFieldName(value as DisplayFieldName)}>
                {FIELD_OPTIONS.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
              </SelectControl>
              <label className="flex h-9 items-center gap-2 text-xs text-white/58">
                <input
                  type="checkbox"
                  checked={autoRange}
                  onChange={(event) => setAutoRange(event.target.checked)}
                  className="h-4 w-4 accent-orange-400"
                />
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
              ambientPressurePa={config.ambientPressurePa}
              colorSensitivity={colorSensitivity}
              onColorSensitivityChange={setColorSensitivity}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0a0d12] px-5 py-2 text-xs text-white/48">
              <span>
                {selectedField.label} {snapshot
                  ? `${formatNumber(snapshot.ranges[fieldName].min)} to ${formatNumber(snapshot.ranges[fieldName].max)} ${selectedField.unit}`
                  : ""}
              </span>
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
              [
                diagnostics?.timeStepping === "localPseudoTime" ? "Local dt range" : "Global dt",
                diagnostics
                  ? diagnostics.timeStepping === "localPseudoTime"
                    ? `${diagnostics.dtS.toExponential(1)} - ${diagnostics.maxLocalDtS.toExponential(1)} s`
                    : `${diagnostics.dtS.toExponential(2)} s`
                  : "0 s"
              ],
              ["Max Mach", diagnostics ? diagnostics.maxMach.toFixed(3) : "0.000"],
              ["Min pressure", diagnostics ? `${(diagnostics.minPressurePa / 1000).toFixed(2)} kPa` : "0 kPa"],
              [
                "Mass-flow spread",
                diagnostics && diagnostics.massFlowRelativeSpread < 1e8
                  ? `${(diagnostics.massFlowRelativeSpread * 100).toFixed(2)}%`
                  : "Not established"
              ]
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
                ["SA variable clips", diagnostics?.turbulenceClips.toLocaleString() ?? "0"],
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
