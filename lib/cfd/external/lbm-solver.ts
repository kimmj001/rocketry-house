import {
  CFD_AMBIENT_DENSITY_KG_M3,
  CFD_AMBIENT_PRESSURE_PA,
  CFD_AMBIENT_TEMPERATURE_K,
  CFD_SPEED_OF_SOUND_M_S,
  D2Q9_CX,
  D2Q9_CY,
  D2Q9_OPPOSITE,
  D2Q9_WEIGHT,
  EXTERNAL_CFD_PRESETS,
  EXTERNAL_CFD_TIMEOUT_MS
} from "./constants";
import { computeVorticity } from "./postprocess";
import { ExternalCfdError, type ExternalCfdProgressCallback, type NormalizedExternalCfdInput, type RawExternalCfdFields, type SolverGrid } from "./types";

function equilibrium(direction: number, rho: number, ux: number, uy: number) {
  const cu = D2Q9_CX[direction] * ux + D2Q9_CY[direction] * uy;
  return D2Q9_WEIGHT[direction] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * (ux * ux + uy * uy));
}

function yieldToRuntime() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function solveLbmExternalFlow(
  input: NormalizedExternalCfdInput,
  grid: SolverGrid,
  onProgress?: ExternalCfdProgressCallback
): Promise<RawExternalCfdFields> {
  const { width, height, mask } = grid;
  const count = width * height;
  const populations = new Float32Array(count * 9);
  const collided = new Float32Array(count * 9);
  const next = new Float32Array(count * 9);
  const angle = -input.angleOfAttack * Math.PI / 180;
  const latticeSpeed = 0.075;
  const freestreamX = latticeSpeed * Math.cos(angle);
  const freestreamY = latticeSpeed * Math.sin(angle);
  const referenceCells = Math.max(12, Math.round(grid.rocketLengthM / grid.dxM));
  const reynolds = 2_000;
  const viscosity = latticeSpeed * referenceCells / reynolds;
  const relaxation = 1 / Math.max(0.515, 0.5 + 3 * viscosity);
  const maxIterations = EXTERNAL_CFD_PRESETS[input.resolution].lbmIterations;
  const started = Date.now();
  let residual = 1;
  let priorProbe = 0;

  for (let i = 0; i < count; i += 1) {
    for (let k = 0; k < 9; k += 1) populations[i * 9 + k] = equilibrium(k, 1, freestreamX, freestreamY);
  }
  await onProgress?.({ state: "initializing", progress: 0.12, iterations: maxIterations, message: "Initializing D2Q9 populations" });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (Date.now() - started > EXTERNAL_CFD_TIMEOUT_MS) throw new ExternalCfdError("TIMEOUT", "The FAST CFD solver exceeded its execution time limit.");
    const bodyRamp = Math.min(1, (iteration + 1) / Math.min(100, Math.max(40, maxIterations * 0.18)));

    for (let i = 0; i < count; i += 1) {
      const base = i * 9;
      if (mask[i]) {
        for (let k = 0; k < 9; k += 1) collided[base + k] = populations[base + k];
        continue;
      }
      let rho = 0;
      let ux = 0;
      let uy = 0;
      for (let k = 0; k < 9; k += 1) {
        const value = populations[base + k];
        rho += value;
        ux += value * D2Q9_CX[k];
        uy += value * D2Q9_CY[k];
      }
      if (!Number.isFinite(rho) || rho <= 0) throw new ExternalCfdError("NUMERICAL_INSTABILITY", "FAST CFD produced an invalid density field.");
      ux /= rho;
      uy /= rho;
      if (ux * ux + uy * uy > 0.22) throw new ExternalCfdError("NUMERICAL_INSTABILITY", "FAST CFD exceeded the stable lattice-speed range.");
      for (let k = 0; k < 9; k += 1) {
        const current = populations[base + k];
        collided[base + k] = current + relaxation * (equilibrium(k, rho, ux, uy) - current);
      }
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const base = i * 9;
        if (mask[i]) continue;
        for (let k = 0; k < 9; k += 1) {
          const sx = x - D2Q9_CX[k];
          const sy = y - D2Q9_CY[k];
          if (sx < 0 || sy < 0 || sy >= height) {
            next[base + k] = equilibrium(k, 1, freestreamX, freestreamY);
          } else if (sx >= width) {
            next[base + k] = collided[(y * width + width - 2) * 9 + k];
          } else {
            const source = sy * width + sx;
            if (mask[source]) {
              let localDensity = 0;
              for (let direction = 0; direction < 9; direction += 1) localDensity += collided[base + direction];
              const wallX = freestreamX * (1 - bodyRamp);
              const wallY = freestreamY * (1 - bodyRamp);
              next[base + k] = collided[base + D2Q9_OPPOSITE[k]]
                + 6 * D2Q9_WEIGHT[k] * localDensity * (D2Q9_CX[k] * wallX + D2Q9_CY[k] * wallY);
            } else {
              next[base + k] = collided[source * 9 + k];
            }
          }
        }
        const outletBlend = x > width * 0.88 ? ((x / (width - 1) - 0.88) / 0.12) ** 2 * 0.08 : 0;
        const edgeDistance = Math.min(y, height - 1 - y);
        const farfieldBlend = edgeDistance < 5 ? (5 - edgeDistance) / 5 * 0.12 : 0;
        const blend = Math.min(0.2, outletBlend + farfieldBlend);
        if (blend) for (let k = 0; k < 9; k += 1) next[base + k] = next[base + k] * (1 - blend) + equilibrium(k, 1, freestreamX, freestreamY) * blend;
      }
    }
    populations.set(next);

    if (iteration % 15 === 14 || iteration === maxIterations - 1) {
      let probe = 0;
      let samples = 0;
      for (let y = 4; y < height - 4; y += 6) {
        for (let x = 4; x < width - 4; x += 6) {
          const i = y * width + x;
          if (mask[i]) continue;
          const base = i * 9;
          let rho = 0;
          let ux = 0;
          for (let k = 0; k < 9; k += 1) {
            rho += populations[base + k];
            ux += populations[base + k] * D2Q9_CX[k];
          }
          probe += ux / Math.max(rho, 1e-9);
          samples += 1;
        }
      }
      probe /= Math.max(samples, 1);
      residual = Math.abs(probe - priorProbe) / Math.max(Math.abs(probe), 1e-5);
      priorProbe = probe;
      await onProgress?.({ state: "solving", progress: 0.15 + 0.72 * (iteration + 1) / maxIterations, iteration: iteration + 1, iterations: maxIterations, message: `FAST solver iteration ${iteration + 1}` });
      await yieldToRuntime();
    }
  }

  const velocityX = new Float32Array(count);
  const velocityY = new Float32Array(count);
  const velocity = new Float32Array(count);
  const mach = new Float32Array(count);
  const pressure = new Float32Array(count);
  const temperature = new Float32Array(count);
  const density = new Float32Array(count);
  const physicalScale = input.mach * CFD_SPEED_OF_SOUND_M_S / latticeSpeed;
  for (let i = 0; i < count; i += 1) {
    if (mask[i]) continue;
    const base = i * 9;
    let rho = 0;
    let ux = 0;
    let uy = 0;
    for (let k = 0; k < 9; k += 1) {
      rho += populations[base + k];
      ux += populations[base + k] * D2Q9_CX[k];
      uy += populations[base + k] * D2Q9_CY[k];
    }
    ux = ux / rho * physicalScale;
    uy = uy / rho * physicalScale;
    velocityX[i] = ux;
    velocityY[i] = uy;
    velocity[i] = Math.hypot(ux, uy);
    mach[i] = velocity[i] / CFD_SPEED_OF_SOUND_M_S;
    density[i] = rho * CFD_AMBIENT_DENSITY_KG_M3;
    pressure[i] = CFD_AMBIENT_PRESSURE_PA + (rho - 1) / 3 * CFD_AMBIENT_DENSITY_KG_M3 * physicalScale * physicalScale;
    temperature[i] = CFD_AMBIENT_TEMPERATURE_K;
  }
  const vorticity = computeVorticity(velocityX, velocityY, mask, width, height, grid.dxM, grid.dyM);
  return {
    velocityX, velocityY, velocity, mach, pressure, temperature, density, vorticity,
    iterations: maxIterations,
    simulationTime: maxIterations,
    residual,
    converged: residual < 0.02,
    warnings: ["FAST mode uses an isothermal weakly-compressible D2Q9 model and is restricted to Mach numbers below 0.3."]
  };
}
