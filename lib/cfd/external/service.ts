import { createHash } from "node:crypto";
import { getExternalCfdCache, setExternalCfdCache } from "./cache";
import { encodeBytes, encodeFloat32, encodeScalarField } from "./encoding";
import { buildRocketGrid } from "./geometry";
import { solveLbmExternalFlow } from "./lbm-solver";
import { solveCompressibleExternalFlow } from "./compressible-solver";
import {
  ExternalCfdError,
  type ExternalCfdInput,
  type ExternalCfdProgressCallback,
  type ExternalCfdResult,
  type NormalizedExternalCfdInput
} from "./types";

const VALID_SOLVERS = new Set(["auto", "fast", "compressible"]);
const VALID_RESOLUTIONS = new Set(["low", "medium", "high"]);

function rounded(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

export function normalizeExternalCfdInput(value: unknown): NormalizedExternalCfdInput {
  if (!value || typeof value !== "object") throw new ExternalCfdError("INVALID_INPUT", "CFD input must be a JSON object.");
  const input = value as Partial<ExternalCfdInput>;
  const components = input.rocket?.components;
  if (!Array.isArray(components) || !components.length) throw new ExternalCfdError("INVALID_GEOMETRY", "A saved RocketryHouse rocket design is required.");
  const mach = Number(input.mach);
  const angleOfAttack = Number(input.angleOfAttack);
  if (!Number.isFinite(mach) || mach < 0.05 || mach > 3) throw new ExternalCfdError("INVALID_INPUT", "Mach number must be between 0.05 and 3.0.");
  if (!Number.isFinite(angleOfAttack) || angleOfAttack < -20 || angleOfAttack > 20) throw new ExternalCfdError("INVALID_INPUT", "Angle of attack must be between -20 and 20 degrees.");
  const requestedSolver = VALID_SOLVERS.has(input.solver ?? "auto") ? input.solver ?? "auto" : "auto";
  const resolution = VALID_RESOLUTIONS.has(input.resolution ?? "medium") ? input.resolution ?? "medium" : "medium";
  const solver = requestedSolver === "auto" ? (mach < 0.3 ? "fast" : "compressible") : requestedSolver === "fast" && mach >= 0.3 ? "compressible" : requestedSolver;
  return {
    rocket: { components },
    mach: rounded(mach),
    angleOfAttack: rounded(angleOfAttack),
    requestedSolver,
    solver,
    resolution,
    visualization: input.visualization ?? "mach"
  };
}

export function createExternalCfdCacheKey(input: NormalizedExternalCfdInput) {
  const geometry = input.rocket.components
    .map((component) => ({
      id: component.id,
      type: component.type,
      length: rounded(component.length),
      diameter: rounded(component.diameter),
      position: rounded(component.position),
      finRootChord: rounded(component.finRootChord ?? 0),
      finTipChord: rounded(component.finTipChord ?? 0),
      finSpan: rounded(component.finSpan ?? 0),
      finSweep: rounded(component.finSweep ?? 0),
      noseShape: component.noseShape ?? null,
      foreDiameter: rounded(component.foreDiameter ?? 0),
      aftDiameter: rounded(component.aftDiameter ?? 0)
    }))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify({ geometry, mach: input.mach, angleOfAttack: input.angleOfAttack, solver: input.solver, resolution: input.resolution, version: 2 })).digest("hex").slice(0, 24);
}

export function prepareExternalCfdRun(value: unknown) {
  const input = normalizeExternalCfdInput(value);
  const cacheKey = createExternalCfdCacheKey(input);
  return { input, cacheKey, cached: getExternalCfdCache(cacheKey) };
}

export async function runExternalCfd(
  input: NormalizedExternalCfdInput,
  cacheKey: string,
  onProgress?: ExternalCfdProgressCallback
): Promise<ExternalCfdResult> {
  const started = Date.now();
  await onProgress?.({ state: "preparing_geometry", progress: 0.05, message: "Rasterizing the saved rocket profile" });
  const grid = buildRocketGrid(input.rocket.components, input.resolution);
  const raw = input.solver === "fast"
    ? await solveLbmExternalFlow(input, grid, onProgress)
    : await solveCompressibleExternalFlow(input, grid, onProgress);
  await onProgress?.({ state: "postprocessing", progress: 0.9, message: "Computing physical fields and transfer buffers" });
  const warnings = [...raw.warnings];
  if (input.requestedSolver === "fast" && input.solver === "compressible") warnings.unshift("FAST mode is not valid at Mach 0.3 or above, so the run was switched to the compressible solver.");
  if (!raw.converged) warnings.push("The iteration cap was reached before the residual convergence target. Treat the field as a developing-flow result.");
  const result: ExternalCfdResult = {
    status: "completed",
    solver: input.solver,
    grid: { width: grid.width, height: grid.height },
    domain: { xMinM: grid.xMinM, xMaxM: grid.xMaxM, yMinM: grid.yMinM, yMaxM: grid.yMaxM },
    rocketMask: encodeBytes(grid.mask),
    fields: {
      velocity: encodeScalarField(raw.velocity, grid.mask, "m/s"),
      mach: encodeScalarField(raw.mach, grid.mask, "Mach"),
      pressure: encodeScalarField(raw.pressure, grid.mask, "Pa"),
      temperature: encodeScalarField(raw.temperature, grid.mask, "K"),
      density: encodeScalarField(raw.density, grid.mask, "kg/m3"),
      vorticity: encodeScalarField(raw.vorticity, grid.mask, "1/s")
    },
    vectors: { x: encodeFloat32(raw.velocityX), y: encodeFloat32(raw.velocityY), unit: "m/s" },
    metadata: {
      iterations: raw.iterations,
      elapsedMs: Date.now() - started,
      residual: raw.residual,
      simulationTime: raw.simulationTime,
      mach: input.mach,
      angleOfAttack: input.angleOfAttack,
      resolution: input.resolution,
      cacheKey,
      cacheHit: false,
      converged: raw.converged,
      warnings
    }
  };
  setExternalCfdCache(cacheKey, result);
  await onProgress?.({ state: "completed", progress: 1, message: "CFD run completed" });
  return result;
}
