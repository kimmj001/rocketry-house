import {
  CFD_AMBIENT_DENSITY_KG_M3,
  CFD_AMBIENT_PRESSURE_PA,
  CFD_AMBIENT_TEMPERATURE_K,
  CFD_GAMMA,
  CFD_SPEED_OF_SOUND_M_S,
  EXTERNAL_CFD_PRESETS,
  EXTERNAL_CFD_TIMEOUT_MS
} from "./constants";
import { conservedToPrimitive, hllcFlux, minmod, mirrorState, primitiveToConserved, type PrimitiveState } from "./numerics";
import { computeVorticity } from "./postprocess";
import { ExternalCfdError, type ExternalCfdProgressCallback, type NormalizedExternalCfdInput, type RawExternalCfdFields, type SolverGrid } from "./types";

type Scratch = {
  primitive: Float64Array;
  slopeX: Float64Array;
  slopeY: Float64Array;
  rhs: Float64Array;
};

function primitiveAt(values: Float64Array, index: number): PrimitiveState {
  const base = index * 4;
  return { rho: values[base], u: values[base + 1], v: values[base + 2], p: values[base + 3] };
}

function limited(state: PrimitiveState): PrimitiveState {
  return { rho: Math.max(1e-5, state.rho), u: state.u, v: state.v, p: Math.max(1e-6, state.p) };
}

function reconstructed(values: Float64Array, slopes: Float64Array, index: number, sign: number) {
  const base = index * 4;
  return limited({
    rho: values[base] + sign * 0.5 * slopes[base],
    u: values[base + 1] + sign * 0.5 * slopes[base + 1],
    v: values[base + 2] + sign * 0.5 * slopes[base + 2],
    p: values[base + 3] + sign * 0.5 * slopes[base + 3]
  });
}

function fillPrimitive(state: Float64Array, scratch: Scratch, grid: SolverGrid, farfield: PrimitiveState) {
  const count = grid.width * grid.height;
  for (let i = 0; i < count; i += 1) {
    const base = i * 4;
    const value = grid.mask[i] ? farfield : conservedToPrimitive(state[base], state[base + 1], state[base + 2], state[base + 3]);
    scratch.primitive[base] = value.rho;
    scratch.primitive[base + 1] = value.u;
    scratch.primitive[base + 2] = value.v;
    scratch.primitive[base + 3] = value.p;
  }
}

function fillSlopes(scratch: Scratch, grid: SolverGrid) {
  const { width, height, mask } = grid;
  scratch.slopeX.fill(0);
  scratch.slopeY.fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (mask[i]) continue;
      const left = i - 1;
      const right = i + 1;
      const down = i - width;
      const up = i + width;
      const base = i * 4;
      for (let field = 0; field < 4; field += 1) {
        if (!mask[left] && !mask[right]) {
          scratch.slopeX[base + field] = minmod(
            scratch.primitive[base + field] - scratch.primitive[left * 4 + field],
            scratch.primitive[right * 4 + field] - scratch.primitive[base + field]
          );
        }
        if (!mask[down] && !mask[up]) {
          scratch.slopeY[base + field] = minmod(
            scratch.primitive[base + field] - scratch.primitive[down * 4 + field],
            scratch.primitive[up * 4 + field] - scratch.primitive[base + field]
          );
        }
      }
    }
  }
}

function addFlux(rhs: Float64Array, index: number, flux: readonly number[], scale: number) {
  const base = index * 4;
  for (let field = 0; field < 4; field += 1) rhs[base + field] += flux[field] * scale;
}

function computeRhs(state: Float64Array, scratch: Scratch, grid: SolverGrid, farfield: PrimitiveState) {
  const { width, height, mask, dxM, dyM } = grid;
  scratch.rhs.fill(0);
  fillPrimitive(state, scratch, grid, farfield);
  fillSlopes(scratch, grid);

  for (let y = 0; y < height; y += 1) {
    for (let face = 0; face <= width; face += 1) {
      const left = face > 0 ? y * width + face - 1 : -1;
      const right = face < width ? y * width + face : -1;
      const leftSolid = left >= 0 && mask[left] === 1;
      const rightSolid = right >= 0 && mask[right] === 1;
      if (leftSolid && rightSolid) continue;
      let leftState: PrimitiveState;
      let rightState: PrimitiveState;
      if (left < 0) {
        leftState = farfield;
        rightState = reconstructed(scratch.primitive, scratch.slopeX, right, -1);
      } else if (right < 0) {
        leftState = reconstructed(scratch.primitive, scratch.slopeX, left, 1);
        rightState = leftState;
      } else if (leftSolid) {
        rightState = primitiveAt(scratch.primitive, right);
        leftState = mirrorState(rightState, "x");
      } else if (rightSolid) {
        leftState = primitiveAt(scratch.primitive, left);
        rightState = mirrorState(leftState, "x");
      } else {
        leftState = reconstructed(scratch.primitive, scratch.slopeX, left, 1);
        rightState = reconstructed(scratch.primitive, scratch.slopeX, right, -1);
      }
      const flux = hllcFlux(leftState, rightState, "x");
      if (left >= 0 && !leftSolid) addFlux(scratch.rhs, left, flux, -1 / dxM);
      if (right >= 0 && !rightSolid) addFlux(scratch.rhs, right, flux, 1 / dxM);
    }
  }

  for (let face = 0; face <= height; face += 1) {
    for (let x = 0; x < width; x += 1) {
      const down = face > 0 ? (face - 1) * width + x : -1;
      const up = face < height ? face * width + x : -1;
      const downSolid = down >= 0 && mask[down] === 1;
      const upSolid = up >= 0 && mask[up] === 1;
      if (downSolid && upSolid) continue;
      let downState: PrimitiveState;
      let upState: PrimitiveState;
      if (down < 0) {
        downState = farfield;
        upState = reconstructed(scratch.primitive, scratch.slopeY, up, -1);
      } else if (up < 0) {
        downState = reconstructed(scratch.primitive, scratch.slopeY, down, 1);
        upState = farfield;
      } else if (downSolid) {
        upState = primitiveAt(scratch.primitive, up);
        downState = mirrorState(upState, "y");
      } else if (upSolid) {
        downState = primitiveAt(scratch.primitive, down);
        upState = mirrorState(downState, "y");
      } else {
        downState = reconstructed(scratch.primitive, scratch.slopeY, down, 1);
        upState = reconstructed(scratch.primitive, scratch.slopeY, up, -1);
      }
      const flux = hllcFlux(downState, upState, "y");
      if (down >= 0 && !downSolid) addFlux(scratch.rhs, down, flux, -1 / dyM);
      if (up >= 0 && !upSolid) addFlux(scratch.rhs, up, flux, 1 / dyM);
    }
  }
}

function stableState(state: Float64Array, grid: SolverGrid, farfieldConserved: readonly number[]) {
  const count = grid.width * grid.height;
  for (let i = 0; i < count; i += 1) {
    const base = i * 4;
    if (grid.mask[i]) {
      for (let field = 0; field < 4; field += 1) state[base + field] = farfieldConserved[field];
      continue;
    }
    const primitive = conservedToPrimitive(state[base], state[base + 1], state[base + 2], state[base + 3]);
    if (![primitive.rho, primitive.u, primitive.v, primitive.p].every(Number.isFinite) || Math.hypot(primitive.u, primitive.v) > 12) return false;
    const conserved = primitiveToConserved(primitive);
    for (let field = 0; field < 4; field += 1) state[base + field] = conserved[field];
  }
  return true;
}

function timestep(state: Float64Array, grid: SolverGrid) {
  let maxX = 1e-6;
  let maxY = 1e-6;
  for (let i = 0; i < grid.width * grid.height; i += 1) {
    if (grid.mask[i]) continue;
    const base = i * 4;
    const primitive = conservedToPrimitive(state[base], state[base + 1], state[base + 2], state[base + 3]);
    const sound = Math.sqrt(CFD_GAMMA * primitive.p / primitive.rho);
    maxX = Math.max(maxX, Math.abs(primitive.u) + sound);
    maxY = Math.max(maxY, Math.abs(primitive.v) + sound);
  }
  return 0.36 / (maxX / grid.dxM + maxY / grid.dyM);
}

function yieldToRuntime() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function solveCompressibleExternalFlow(
  input: NormalizedExternalCfdInput,
  grid: SolverGrid,
  onProgress?: ExternalCfdProgressCallback
): Promise<RawExternalCfdFields> {
  const count = grid.width * grid.height;
  const angle = -input.angleOfAttack * Math.PI / 180;
  const farfield: PrimitiveState = { rho: 1, u: input.mach * Math.cos(angle), v: input.mach * Math.sin(angle), p: 1 / CFD_GAMMA };
  const farfieldConserved = primitiveToConserved(farfield);
  const state = new Float64Array(count * 4);
  const stage = new Float64Array(count * 4);
  const original = new Float64Array(count * 4);
  const scratch: Scratch = {
    primitive: new Float64Array(count * 4),
    slopeX: new Float64Array(count * 4),
    slopeY: new Float64Array(count * 4),
    rhs: new Float64Array(count * 4)
  };
  for (let i = 0; i < count; i += 1) for (let field = 0; field < 4; field += 1) state[i * 4 + field] = farfieldConserved[field];
  const maxIterations = EXTERNAL_CFD_PRESETS[input.resolution].compressibleIterations;
  const started = Date.now();
  let simulationTime = 0;
  let residual = 1;
  let previousPressure = farfield.p;
  await onProgress?.({ state: "initializing", progress: 0.12, iterations: maxIterations, message: "Initializing compressible conserved variables" });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (Date.now() - started > EXTERNAL_CFD_TIMEOUT_MS) throw new ExternalCfdError("TIMEOUT", "The compressible CFD solver exceeded its execution time limit.");
    const dt = timestep(state, grid);
    if (!Number.isFinite(dt) || dt <= 0) throw new ExternalCfdError("NUMERICAL_INSTABILITY", "The compressible solver produced an invalid CFL time step.");
    original.set(state);
    computeRhs(state, scratch, grid, farfield);
    for (let i = 0; i < state.length; i += 1) stage[i] = state[i] + dt * scratch.rhs[i];
    if (!stableState(stage, grid, farfieldConserved)) throw new ExternalCfdError("NUMERICAL_INSTABILITY", "The compressible solver diverged during its first RK stage.");
    computeRhs(stage, scratch, grid, farfield);
    for (let i = 0; i < state.length; i += 1) state[i] = 0.5 * original[i] + 0.5 * (stage[i] + dt * scratch.rhs[i]);
    if (!stableState(state, grid, farfieldConserved)) throw new ExternalCfdError("NUMERICAL_INSTABILITY", "The compressible solver diverged during its second RK stage.");
    simulationTime += dt;

    if (iteration % 5 === 4 || iteration === maxIterations - 1) {
      let averagePressure = 0;
      let samples = 0;
      for (let i = 0; i < count; i += 17) {
        if (grid.mask[i]) continue;
        const base = i * 4;
        averagePressure += conservedToPrimitive(state[base], state[base + 1], state[base + 2], state[base + 3]).p;
        samples += 1;
      }
      averagePressure /= Math.max(1, samples);
      residual = Math.abs(averagePressure - previousPressure) / Math.max(averagePressure, 1e-8);
      previousPressure = averagePressure;
      await onProgress?.({ state: "solving", progress: 0.15 + 0.72 * (iteration + 1) / maxIterations, iteration: iteration + 1, iterations: maxIterations, message: `Compressible solver iteration ${iteration + 1}` });
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
  for (let i = 0; i < count; i += 1) {
    if (grid.mask[i]) continue;
    const base = i * 4;
    const primitive = conservedToPrimitive(state[base], state[base + 1], state[base + 2], state[base + 3]);
    const sound = Math.sqrt(CFD_GAMMA * primitive.p / primitive.rho);
    velocityX[i] = primitive.u * CFD_SPEED_OF_SOUND_M_S;
    velocityY[i] = primitive.v * CFD_SPEED_OF_SOUND_M_S;
    velocity[i] = Math.hypot(velocityX[i], velocityY[i]);
    mach[i] = Math.hypot(primitive.u, primitive.v) / sound;
    density[i] = primitive.rho * CFD_AMBIENT_DENSITY_KG_M3;
    pressure[i] = primitive.p * CFD_GAMMA * CFD_AMBIENT_PRESSURE_PA;
    temperature[i] = CFD_AMBIENT_TEMPERATURE_K * (primitive.p * CFD_GAMMA) / primitive.rho;
  }
  const vorticity = computeVorticity(velocityX, velocityY, grid.mask, grid.width, grid.height, grid.dxM, grid.dyM);
  return {
    velocityX, velocityY, velocity, mach, pressure, temperature, density, vorticity,
    iterations: maxIterations,
    simulationTime,
    residual,
    converged: residual < 0.01,
    warnings: ["Compressible mode solves the inviscid Euler equations; boundary layers and viscous separation require a later Navier-Stokes turbulence model."]
  };
}
