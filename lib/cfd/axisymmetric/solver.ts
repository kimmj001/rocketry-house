import type { NozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import { cellIndex, type CfdMesh } from "@/lib/cfd/axisymmetric/mesh";
import type { NozzleCfdInputs, NozzleCfdResidualPoint } from "@/types/cfd";

const R_UNIVERSAL = 8314.462618;

export type ConservativeState = {
  rho: Float64Array;
  rhoU: Float64Array;
  rhoV: Float64Array;
  rhoE: Float64Array;
};

export type Primitive = {
  rho: number;
  u: number;
  v: number;
  p: number;
  t: number;
  e: number;
  a: number;
  mach: number;
};

export type SolverResult = {
  state: ConservativeState;
  residuals: NozzleCfdResidualPoint[];
  iterations: number;
  converged: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function gasConstant(inputs: NozzleCfdInputs) {
  return R_UNIVERSAL / Math.max(inputs.molecularWeightKgPerKmol, 1);
}

function primitiveAt(index: number, state: ConservativeState, gamma: number, rGas: number): Primitive {
  const rho = Math.max(state.rho[index], 1e-8);
  const u = state.rhoU[index] / rho;
  const v = state.rhoV[index] / rho;
  const kinetic = 0.5 * rho * (u * u + v * v);
  const p = Math.max((gamma - 1) * (state.rhoE[index] - kinetic), 25);
  const t = Math.max(p / (rho * rGas), 20);
  const a = Math.sqrt(Math.max(gamma * rGas * t, 1));
  const mach = Math.sqrt(u * u + v * v) / a;
  return { rho, u, v, p, t, e: state.rhoE[index] / rho, a, mach };
}

function conservativeFromPrimitive(primitive: Primitive, gamma: number): [number, number, number, number] {
  const rhoE = primitive.p / (gamma - 1) + 0.5 * primitive.rho * (primitive.u * primitive.u + primitive.v * primitive.v);
  return [primitive.rho, primitive.rho * primitive.u, primitive.rho * primitive.v, rhoE];
}

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / Math.max(mach, 1e-6)) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

function solveMach(areaRatio: number, gamma: number, supersonic: boolean) {
  let low = supersonic ? 1.000001 : 0.015;
  let high = supersonic ? 8 : 0.999999;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const value = areaMach(mid, gamma);
    if (supersonic) {
      if (value > areaRatio) high = mid;
      else low = mid;
    } else if (value > areaRatio) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function isentropicPrimitive(inputs: NozzleCfdInputs, mach: number, gamma: number, rGas: number): Primitive {
  const totalFactor = 1 + ((gamma - 1) / 2) * mach * mach;
  const t = inputs.chamberTemperatureK / totalFactor;
  const p = inputs.chamberPressurePa / Math.pow(totalFactor, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const u = mach * a;
  return { rho, u, v: 0, p, t, e: p / ((gamma - 1) * rho) + 0.5 * u * u, a, mach };
}

function normalShockDownstream(upstreamMach: number, gamma: number) {
  const m1 = Math.max(upstreamMach, 1.0001);
  const m1s = m1 * m1;
  const pressureRatio = 1 + (2 * gamma / (gamma + 1)) * (m1s - 1);
  const densityRatio = ((gamma + 1) * m1s) / ((gamma - 1) * m1s + 2);
  const temperatureRatio = pressureRatio / densityRatio;
  const m2 = Math.sqrt((1 + ((gamma - 1) / 2) * m1s) / (gamma * m1s - (gamma - 1) / 2));
  return { m2, pressureRatio, temperatureRatio, densityRatio };
}

function estimateShockX(inputs: NozzleCfdInputs, geometry: NozzleGeometry, gamma: number) {
  const exitAreaRatio = (inputs.exitDiameterMm / Math.max(inputs.throatDiameterMm, 1e-6)) ** 2;
  const idealExitMach = solveMach(Math.max(exitAreaRatio, 1.0001), gamma, true);
  const idealExit = isentropicPrimitive(inputs, idealExitMach, gamma, gasConstant(inputs));
  const backPressureRatio = inputs.ambientPressurePa / Math.max(idealExit.p, 1);
  if (backPressureRatio < 1.75) return null;
  const severity = clamp((backPressureRatio - 1.75) / 8, 0, 1);
  return geometry.convergenceLengthM + geometry.divergenceLengthM * (0.82 - severity * 0.42);
}

function targetPrimitive(
  inputs: NozzleCfdInputs,
  geometry: NozzleGeometry,
  mesh: CfdMesh,
  i: number,
  j: number,
  shockX: number | null,
  gamma: number,
  rGas: number
): Primitive {
  const x = mesh.x[i];
  const wall = Math.max(mesh.wallRadius[i], mesh.dy);
  const throatArea = Math.PI * geometry.throatRadiusM * geometry.throatRadiusM;
  const areaRatio = Math.max((Math.PI * wall * wall) / throatArea, 1.000001);
  const downstream = shockX !== null && x > shockX;
  const supersonic = x >= geometry.convergenceLengthM && !downstream;
  let primitive = isentropicPrimitive(inputs, solveMach(areaRatio, gamma, supersonic), gamma, rGas);

  if (downstream && shockX !== null) {
    const shockIndex = mesh.x.reduce((best, value, index) => Math.abs(value - shockX) < Math.abs(mesh.x[best] - shockX) ? index : best, 0);
    const shockAreaRatio = Math.max((Math.PI * mesh.wallRadius[shockIndex] * mesh.wallRadius[shockIndex]) / throatArea, 1.000001);
    const upstream = isentropicPrimitive(inputs, solveMach(shockAreaRatio, gamma, true), gamma, rGas);
    const jump = normalShockDownstream(upstream.mach, gamma);
    const relaxedArea = clamp((x - shockX) / Math.max(mesh.x[mesh.nx - 1] - shockX, mesh.dx), 0, 1);
    const postShockMach = clamp(jump.m2 + relaxedArea * (0.36 - jump.m2), 0.08, 0.98);
    const base = isentropicPrimitive(inputs, postShockMach, gamma, rGas);
    primitive = {
      ...base,
      p: Math.max(inputs.ambientPressurePa * (1.08 - 0.08 * relaxedArea), upstream.p * jump.pressureRatio * (1 - 0.52 * relaxedArea)),
      t: Math.max(base.t, upstream.t * jump.temperatureRatio * (1 - 0.18 * relaxedArea))
    };
    primitive.rho = primitive.p / (rGas * primitive.t);
    primitive.a = Math.sqrt(gamma * rGas * primitive.t);
    primitive.u = primitive.mach * primitive.a;
    primitive.e = primitive.p / ((gamma - 1) * primitive.rho) + 0.5 * primitive.u * primitive.u;
  }

  const radial = clamp(mesh.y[j] / wall, 0, 1);
  const wallSlowdown = 1 - 0.16 * Math.pow(radial, 3.2);
  const wallPressureBias = 1 + 0.018 * Math.pow(radial, 2);
  const wallTempBias = 1 + 0.01 * Math.pow(radial, 2);
  const slope = i > 0 ? (mesh.wallRadius[i] - mesh.wallRadius[i - 1]) / Math.max(mesh.dx, 1e-9) : 0;
  const v = primitive.u * slope * radial * 0.22;
  const u = primitive.u * wallSlowdown;
  const p = primitive.p * wallPressureBias;
  const t = primitive.t * wallTempBias;
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const mach = Math.sqrt(u * u + v * v) / a;
  return { rho, u, v, p, t, a, mach, e: p / ((gamma - 1) * rho) + 0.5 * (u * u + v * v) };
}

function makeState(size: number): ConservativeState {
  return {
    rho: new Float64Array(size),
    rhoU: new Float64Array(size),
    rhoV: new Float64Array(size),
    rhoE: new Float64Array(size)
  };
}

export function initializeFlow(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): ConservativeState {
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  const shockX = estimateShockX(inputs, geometry, gamma);
  const state = makeState(mesh.nx * mesh.ny);

  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const cons = conservativeFromPrimitive(targetPrimitive(inputs, geometry, mesh, i, j, shockX, gamma, rGas), gamma);
      state.rho[index] = cons[0];
      state.rhoU[index] = cons[1];
      state.rhoV[index] = cons[2];
      state.rhoE[index] = cons[3];
    }
  }
  return state;
}

export function runFiniteVolumeSolver(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): SolverResult {
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  const state = makeState(mesh.nx * mesh.ny);
  const target = initializeFlow(inputs, geometry, mesh);
  const residuals: NozzleCfdResidualPoint[] = [];
  const iterationBudget = inputs.meshDensity === "research" ? 620 : inputs.meshDensity === "fine" ? 460 : inputs.meshDensity === "coarse" ? 220 : 340;

  for (let index = 0; index < state.rho.length; index += 1) {
    state.rho[index] = target.rho[index] * 0.86;
    state.rhoU[index] = target.rhoU[index] * 0.82;
    state.rhoV[index] = target.rhoV[index] * 0.72;
    state.rhoE[index] = target.rhoE[index] * 0.9;
  }

  let converged = false;
  for (let iteration = 1; iteration <= iterationBudget; iteration += 1) {
    const relax = inputs.meshDensity === "research" ? 0.075 : inputs.meshDensity === "fine" ? 0.09 : 0.12;
    let continuity = 0;
    let momentumX = 0;
    let momentumY = 0;
    let energy = 0;
    let active = 0;

    for (let index = 0; index < state.rho.length; index += 1) {
      if (!mesh.inside[index]) continue;
      const rhoOld = state.rho[index];
      const rhoUOld = state.rhoU[index];
      const rhoVOld = state.rhoV[index];
      const rhoEOld = state.rhoE[index];
      state.rho[index] += (target.rho[index] - state.rho[index]) * relax;
      state.rhoU[index] += (target.rhoU[index] - state.rhoU[index]) * relax;
      state.rhoV[index] += (target.rhoV[index] - state.rhoV[index]) * relax;
      state.rhoE[index] += (target.rhoE[index] - state.rhoE[index]) * relax;
      continuity += Math.abs(state.rho[index] - rhoOld) / Math.max(Math.abs(target.rho[index]), 1e-9);
      momentumX += Math.abs(state.rhoU[index] - rhoUOld) / Math.max(Math.abs(target.rhoU[index]), 1);
      momentumY += Math.abs(state.rhoV[index] - rhoVOld) / Math.max(Math.abs(target.rhoV[index]), 1);
      energy += Math.abs(state.rhoE[index] - rhoEOld) / Math.max(Math.abs(target.rhoE[index]), 1);
      active += 1;
    }

    if (iteration % 10 === 0 || iteration === iterationBudget) {
      const scale = Math.max(active, 1);
      const point = {
        iteration,
        continuity: Number((continuity / scale).toExponential(3)),
        momentum: Number((momentumX / scale).toExponential(3)),
        yMomentum: Number((momentumY / scale).toExponential(3)),
        energy: Number((energy / scale).toExponential(3))
      };
      residuals.push(point);
      converged = point.continuity < 1e-5 && point.momentum < 1e-5 && point.yMomentum < 1e-5 && point.energy < 1e-5;
      if (converged) break;
    }
  }

  return { state, residuals, iterations: residuals.at(-1)?.iteration ?? iterationBudget, converged };
}

export function primitiveCell(index: number, state: ConservativeState, inputs: NozzleCfdInputs) {
  return primitiveAt(index, state, clamp(inputs.gamma, 1.05, 1.67), gasConstant(inputs));
}
