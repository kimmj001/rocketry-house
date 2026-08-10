"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Gauge, Play, RotateCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadPersistentRecords } from "@/lib/cloud-persistence";
import { mockProjects } from "@/lib/mock-data";
import { getCloudUsageAuthHeaders } from "@/lib/use-cloud-usage";
import type { RocketComponent } from "@/lib/types";
import type {
  ExternalCfdFieldName,
  ExternalCfdProgress,
  ExternalCfdResolution,
  ExternalCfdResult,
  ExternalCfdSolver
} from "@/lib/cfd/external/types";

type RocketDraft = { components: RocketComponent[]; name?: string; updatedAt?: string };
type DecodedResult = {
  result: ExternalCfdResult;
  mask: Uint8Array;
  fields: Record<ExternalCfdFieldName, Float32Array>;
  velocityX: Float32Array;
  velocityY: Float32Array;
};

const fieldOptions: Array<{ value: ExternalCfdFieldName; label: string }> = [
  { value: "velocity", label: "Velocity" },
  { value: "mach", label: "Mach" },
  { value: "pressure", label: "Pressure" },
  { value: "temperature", label: "Temperature" },
  { value: "density", label: "Density" },
  { value: "vorticity", label: "Vorticity" }
];

const palette = [
  [20, 42, 180], [0, 133, 255], [0, 216, 202], [59, 205, 77],
  [229, 235, 45], [255, 147, 25], [225, 45, 36]
] as const;

function decodeBase64(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeFloat32(value: string) {
  const bytes = decodeBase64(value);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function decodeResult(result: ExternalCfdResult): DecodedResult {
  return {
    result,
    mask: decodeBase64(result.rocketMask),
    fields: {
      velocity: decodeFloat32(result.fields.velocity.data),
      mach: decodeFloat32(result.fields.mach.data),
      pressure: decodeFloat32(result.fields.pressure.data),
      temperature: decodeFloat32(result.fields.temperature.data),
      density: decodeFloat32(result.fields.density.data),
      vorticity: decodeFloat32(result.fields.vorticity.data)
    },
    velocityX: decodeFloat32(result.vectors.x),
    velocityY: decodeFloat32(result.vectors.y)
  };
}

function percentileRange(values: Float32Array, mask: Uint8Array, field: ExternalCfdFieldName) {
  const sample: number[] = [];
  const stride = Math.max(1, Math.floor(values.length / 12_000));
  for (let i = 0; i < values.length; i += stride) if (!mask[i] && Number.isFinite(values[i])) sample.push(values[i]);
  sample.sort((a, b) => a - b);
  if (!sample.length) return { min: 0, max: 1 };
  if (field === "vorticity") {
    const absolute = sample.map(Math.abs).sort((a, b) => a - b);
    const limit = absolute[Math.floor(absolute.length * 0.98)] || 1;
    return { min: -limit, max: limit };
  }
  const min = sample[Math.floor(sample.length * 0.02)];
  const max = sample[Math.floor(sample.length * 0.98)];
  return { min, max: max > min ? max : min + 1e-6 };
}

function colorAt(tRaw: number) {
  const t = Math.max(0, Math.min(1, tRaw)) * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(t));
  const mix = t - index;
  const a = palette[index];
  const b = palette[index + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * mix),
    Math.round(a[1] + (b[1] - a[1]) * mix),
    Math.round(a[2] + (b[2] - a[2]) * mix)
  ];
}

function drawScalarField(ctx: CanvasRenderingContext2D, decoded: DecodedResult, field: ExternalCfdFieldName) {
  const { width, height } = decoded.result.grid;
  const values = decoded.fields[field];
  const range = percentileRange(values, decoded.mask, field);
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < values.length; i += 1) {
    const pixel = i * 4;
    if (decoded.mask[i]) {
      image.data[pixel] = 9;
      image.data[pixel + 1] = 12;
      image.data[pixel + 2] = 17;
      image.data[pixel + 3] = 255;
      continue;
    }
    const rgb = colorAt((values[i] - range.min) / (range.max - range.min));
    image.data[pixel] = rgb[0];
    image.data[pixel + 1] = rgb[1];
    image.data[pixel + 2] = rgb[2];
    image.data[pixel + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = "rgba(255,255,255,.92)";
  ctx.lineWidth = 0.8;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!decoded.mask[i]) continue;
      if (!decoded.mask[i - 1] || !decoded.mask[i + 1] || !decoded.mask[i - width] || !decoded.mask[i + width]) ctx.strokeRect(x, y, 0.45, 0.45);
    }
  }
  return range;
}

function bilinear(values: Float32Array, x: number, y: number, width: number, height: number) {
  const x0 = Math.max(0, Math.min(width - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 2, Math.floor(y)));
  const tx = x - x0;
  const ty = y - y0;
  const a = values[y0 * width + x0];
  const b = values[y0 * width + x0 + 1];
  const c = values[(y0 + 1) * width + x0];
  const d = values[(y0 + 1) * width + x0 + 1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 10_000 || Math.abs(value) < 0.01 && value !== 0) return value.toExponential(2);
  return value.toFixed(Math.abs(value) >= 100 ? 0 : 2);
}

export function RocketCfdLab() {
  const fallback = mockProjects.find((project) => project.components?.length) ?? mockProjects[0];
  const [draft, setDraft] = useState<RocketDraft>({ components: fallback.components, name: fallback.title });
  const [draftSource, setDraftSource] = useState("Loading saved rocket...");
  const [mach, setMach] = useState(0.2);
  const [angleOfAttack, setAngleOfAttack] = useState(0);
  const [solver, setSolver] = useState<ExternalCfdSolver>("auto");
  const [resolution, setResolution] = useState<ExternalCfdResolution>("low");
  const [field, setField] = useState<ExternalCfdFieldName>("mach");
  const [progress, setProgress] = useState<ExternalCfdProgress | null>(null);
  const [decoded, setDecoded] = useState<DecodedResult | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const legendRange = useMemo(() => decoded ? percentileRange(decoded.fields[field], decoded.mask, field) : null, [decoded, field]);
  const running = progress !== null && progress.state !== "completed" && progress.state !== "failed";

  useEffect(() => {
    void loadPersistentRecords<RocketDraft>("rocket_builder_current").then((records) => {
      const saved = records[0]?.payload;
      if (saved?.components?.length) {
        setDraft(saved);
        setDraftSource(saved.name ?? "Latest account rocket draft");
      } else {
        setDraftSource("Example rocket; save a design in Rocket Builder to replace it");
      }
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    const { width, height } = decoded.result.grid;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const background = document.createElement("canvas");
    background.width = width;
    background.height = height;
    const backgroundContext = background.getContext("2d", { alpha: false });
    if (!backgroundContext) return;
    drawScalarField(backgroundContext, decoded, field);
    const particles = Array.from({ length: 72 }, (_, index) => ({
      x: 2 + (index % 9) * 1.7,
      y: 3 + (index + 0.5) / 72 * (height - 6),
      age: index % 42
    }));
    const { xMinM, xMaxM, yMinM, yMaxM } = decoded.result.domain;
    const dx = (xMaxM - xMinM) / (width - 1);
    const dy = (yMaxM - yMinM) / (height - 1);
    let animation = 0;
    const render = () => {
      ctx.drawImage(background, 0, 0);
      let maxSpeed = 1;
      for (let i = 0; i < decoded.fields.velocity.length; i += 29) maxSpeed = Math.max(maxSpeed, decoded.fields.velocity[i]);
      const dt = 0.65 * Math.min(dx, dy) / maxSpeed;
      ctx.strokeStyle = "rgba(255,255,255,.72)";
      ctx.lineWidth = 0.55;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const oldX = particle.x;
        const oldY = particle.y;
        const u0 = bilinear(decoded.velocityX, oldX, oldY, width, height);
        const v0 = bilinear(decoded.velocityY, oldX, oldY, width, height);
        const midX = oldX + 0.5 * u0 * dt / dx;
        const midY = oldY + 0.5 * v0 * dt / dy;
        const u = bilinear(decoded.velocityX, midX, midY, width, height);
        const v = bilinear(decoded.velocityY, midX, midY, width, height);
        particle.x += u * dt / dx;
        particle.y += v * dt / dy;
        particle.age += 1;
        const cell = Math.max(0, Math.min(decoded.mask.length - 1, Math.round(particle.y) * width + Math.round(particle.x)));
        if (particle.x < 1 || particle.x >= width - 1 || particle.y < 1 || particle.y >= height - 1 || decoded.mask[cell] || particle.age > 150) {
          particle.x = 2 + (index % 9) * 1.7;
          particle.y = 3 + (index + 0.5) / particles.length * (height - 6);
          particle.age = 0;
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(particle.x, particle.y);
        ctx.stroke();
      }
      animation = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animation);
  }, [decoded, field]);

  async function runCfd() {
    setError("");
    setProgress({ state: "queued", progress: 0, message: "Preparing request" });
    try {
      const headers = await getCloudUsageAuthHeaders();
      if (!headers) throw new Error("Sign in to run CFD and track plan usage.");
      const response = await fetch("/api/cfd/rocket/run", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ rocket: { components: draft.components }, mach, angleOfAttack, solver, resolution, visualization: field })
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        const failure = await response.json() as { error?: string; message?: string };
        throw new Error(failure.error ?? failure.message ?? "CFD request failed.");
      }
      if (contentType.includes("application/json")) {
        const result = await response.json() as ExternalCfdResult;
        setDecoded(decodeResult(result));
        setProgress({ state: "completed", progress: 1, message: "Loaded cached CFD result" });
        return;
      }
      if (!response.body) throw new Error("The CFD server returned no result stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; progress?: ExternalCfdProgress; result?: ExternalCfdResult; error?: string };
          if (event.type === "progress" && event.progress) setProgress(event.progress);
          if (event.type === "result" && event.result) setDecoded(decodeResult(event.result));
          if (event.type === "error") throw new Error(event.error ?? "CFD solver failed.");
        }
        if (chunk.done) break;
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CFD request failed.");
      setProgress({ state: "failed", progress: 0, message: "CFD run failed" });
    }
  }

  return (
    <main className="min-h-screen bg-space-radial px-4 pb-24 pt-20 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200/65">Build / Rocket / External CFD</p>
            <h1 className="mt-2 text-3xl font-semibold">Rocket airflow lab</h1>
            <p className="mt-2 text-sm text-orange-50/55">Physics-based 2D flow around the saved longitudinal rocket profile.</p>
          </div>
          <Button href="/build/rocket" asChild variant="outline"><ArrowLeft className="h-4 w-4" />Rocket Builder</Button>
        </header>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0">
            <Card className="overflow-hidden border-white/12 bg-[#080b10] p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{draftSource}</p>
                  <p className="mt-1 text-xs text-orange-50/45">{draft.components.length} saved components</p>
                </div>
                {decoded && <p className="font-mono text-xs text-orange-50/60">{decoded.result.grid.width} x {decoded.result.grid.height} / {decoded.result.solver}</p>}
              </div>
              <div className="relative aspect-[2.5/1] w-full bg-[#080b10]">
                {decoded ? (
                  <canvas ref={canvasRef} className="h-full w-full [image-rendering:auto]" aria-label={`${field} CFD field with velocity-field streaklines`} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-orange-50/42">Run CFD to compute the airflow field.</div>
                )}
              </div>
              {decoded && legendRange && (
                <div className="border-t border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between font-mono text-[11px] text-orange-50/65">
                    <span>{formatNumber(legendRange.min)}</span>
                    <span>{fieldOptions.find((option) => option.value === field)?.label} / {decoded.result.fields[field].unit}</span>
                    <span>{formatNumber(legendRange.max)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full" style={{ background: "linear-gradient(90deg,#142ab4,#0085ff,#00d8ca,#3bcd4d,#e5eb2d,#ff9319,#e12d24)" }} />
                  <p className="mt-2 text-[11px] text-orange-50/38">Color limits use robust 2-98% display clipping; numeric solver fields remain unchanged.</p>
                </div>
              )}
            </Card>

            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-6">
              {fieldOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setField(option.value)} className={`min-h-11 px-2 text-xs font-semibold transition ${field === option.value ? "bg-orange-500 text-black" : "bg-[#111720] text-orange-50/65 hover:bg-white/10"}`}>
                  {option.label}
                </button>
              ))}
            </div>

            {decoded && (
              <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
                <Metric label="Iterations" value={String(decoded.result.metadata.iterations)} />
                <Metric label="Runtime" value={`${(decoded.result.metadata.elapsedMs / 1000).toFixed(1)} s`} />
                <Metric label="Residual" value={decoded.result.metadata.residual.toExponential(2)} />
                <Metric label="Result" value={decoded.result.metadata.cacheHit ? "Cache hit" : decoded.result.metadata.converged ? "Converged" : "Iteration cap"} />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-orange-400" /><h2 className="font-semibold">Run conditions</h2></div>
              <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.16em] text-orange-50/50">Mach number</label>
              <input type="number" min={0.05} max={3} step={0.05} value={mach} onChange={(event) => setMach(Math.max(0.05, Math.min(3, Number(event.target.value) || 0.05)))} className="mt-2 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-sm outline-none focus:border-orange-400" />
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-orange-50/50">Angle of attack</label>
              <div className="mt-2 flex items-center gap-3 pr-12 sm:pr-0">
                <input type="range" min={-20} max={20} step={1} value={angleOfAttack} onChange={(event) => setAngleOfAttack(Number(event.target.value))} className="min-w-0 flex-1 accent-orange-500" />
                <span className="w-12 text-right font-mono text-sm">{angleOfAttack} deg</span>
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-orange-50/50">Solver</label>
              <select value={solver} onChange={(event) => setSolver(event.target.value as ExternalCfdSolver)} className="mt-2 h-11 w-full rounded-md border border-white/15 bg-[#111720] px-3 text-sm">
                <option value="auto">Auto select</option><option value="fast">FAST / D2Q9</option><option value="compressible">Compressible / HLLC</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-orange-50/42">Mach 0.3 and above always uses the compressible solver.</p>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-orange-50/50">Resolution</label>
              <select value={resolution} onChange={(event) => setResolution(event.target.value as ExternalCfdResolution)} className="mt-2 h-11 w-full rounded-md border border-white/15 bg-[#111720] px-3 text-sm">
                <option value="low">Low / 240 x 96</option><option value="medium">Medium / 320 x 128</option><option value="high">High / 420 x 168</option>
              </select>
              <Button className="mt-5 w-full" onClick={runCfd} disabled={running}><Play className="h-4 w-4" />{running ? "Solving..." : "Run CFD"}</Button>
              {progress && (
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-sm bg-white/10"><div className="h-full bg-orange-500 transition-[width]" style={{ width: `${Math.max(2, progress.progress * 100)}%` }} /></div>
                  <p className="mt-2 text-xs text-orange-50/55">{progress.message ?? progress.state.replaceAll("_", " ")}</p>
                </div>
              )}
            </Card>

            {error && <Card className="border-red-400/35 bg-red-950/20 p-4 text-sm text-red-100"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div></Card>}
            {decoded?.result.metadata.warnings.map((warning) => <Card key={warning} className="p-4 text-xs leading-5 text-orange-50/55"><div className="flex gap-2"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" /><span>{warning}</span></div></Card>)}
            <Card className="p-4 text-xs leading-5 text-orange-50/45"><div className="flex gap-2"><Wind className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>Streaklines are integrated from the returned CFD velocity vectors using bilinear interpolation and midpoint stepping.</span></div></Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#111720] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-orange-50/40">{label}</p><p className="mt-1 font-mono text-sm text-white">{value}</p></div>;
}
