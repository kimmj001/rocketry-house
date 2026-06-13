import type { NozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import { cellIndex, isInside, type CfdMesh } from "@/lib/cfd/axisymmetric/mesh";
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

type Flux = [number, number, number, number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function gasConstant(inputs: NozzleCfdInputs) {
  return R_UNIVERSAL / Math.max(inputs.molecularWeightKgPerKmol, 1);
}

function primitiveAt(index: number, state: ConservativeState, gamma: number, rGas: number): Primitive {
  const rho = Math.max(state.rho[index], 1e-7);
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

function fluxX(primitive: Primitive): Flux {
  const rhoE = primitive.rho * primitive.e;
  return [
    primitive.rho * primitive.u,
    primitive.rho * primitive.u * primitive.u + primitive.p,
    primitive.rho * primitive.u * primitive.v,
    (rhoE + primitive.p) * primitive.u
  ];
}

function fluxY(primitive: Primitive): Flux {
  const rhoE = primitive.rho * primitive.e;
  return [
    primitive.rho * primitive.v,
    primitive.rho * primitive.u * primitive.v,
    primitive.rho * primitive.v * primitive.v + primitive.p,
    (rhoE + primitive.p) * primitive.v
  ];
}

function rusanovFlux(left: Primitive, right: Primitive, gamma: number, axis: "x" | "y"): Flux {
  const fLeft = axis === "x" ? fluxX(left) : fluxY(left);
  const fRight = axis === "x" ? fluxX(right) : fluxY(right);
  const uLeft = axis === "x" ? left.u : left.v;
  const uRight = axis === "x" ? right.u : right.v;
  const sMax = Math.max(Math.abs(uLeft) + left.a, Math.abs(uRight) + right.a);
  const uCons = conservativeFromPrimitive(left, gamma);
  const vCons = conservativeFromPrimitive(right, gamma);
  return [
    0.5 * (fLeft[0] + fRight[0]) - 0.5 * sMax * (vCons[0] - uCons[0]),
    0.5 * (fLeft[1] + fRight[1]) - 0.5 * sMax * (vCons[1] - uCons[1]),
    0.5 * (fLeft[2] + fRight[2]) - 0.5 * sMax * (vCons[2] - uCons[2]),
    0.5 * (fLeft[3] + fRight[3]) - 0.5 * sMax * (vCons[3] - uCons[3])
  ];
}

function totalToStatic(inputs: NozzleCfdInputs, mach: number, gamma: number, rGas: number): Primitive {
  const t = inputs.chamberTemperatureK / (1 + ((gamma - 1) / 2) * mach * mach);
  const p = inputs.chamberPressurePa / Math.pow(1 + ((gamma - 1) / 2) * mach * mach, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const u = mach * Math.sqrt(gamma * rGas * t);
  return { rho, u, v: 0, p, t, e: p / ((gamma - 1) * rho) + 0.5 * u * u, a: Math.sqrt(gamma * rGas * t), mach };
}

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / mach) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

function solveMach(areaRatio: number, gamma: number, supersonic: boolean) {
  let low = supersonic ? 1.0001 : 0.025;
  let high = supersonic ? 6.5 : 0.999;
  for (let i = 0; i < 60; i += 1) {
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

export function initializeFlow(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): ConservativeState {
  const size = mesh.nx * mesh.ny;
  const rho = new Float64Array(size);
  const rhoU = new Float64Array(size);
  const rhoV = new Float64Array(size);
  const rhoE = new Float64Array(size);
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  const throatArea = Math.PI * geometry.throatRadiusM * geometry.throatRadiusM;

  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const area = Math.PI * mesh.wallRadius[i] * mesh.wallRadius[i];
      const supersonic = mesh.x[i] >= geometry.convergenceLengthM;
      const mach = solveMach(Math.max(area / throatArea, 1.0001), gamma, supersonic);
      const radialDamping = 1 - 0.12 * (mesh.y[j] / Math.max(mesh.wallRadius[i], mesh.dy)) ** 2;
      const primitive = totalToStatic(inputs, clamp(mach * radialDamping, 0.03, 5.5), gamma, rGas);
      const cons = conservativeFromPrimitive(primitive, gamma);
      rho[index] = cons[0];
      rhoU[index] = cons[1];
      rhoV[index] = cons[2];
      rhoE[index] = cons[3];
    }
  }

  return { rho, rhoU, rhoV, rhoE };
}

function ghostPrimitive(
  i: number,
  j: number,
  neighborI: number,
  neighborJ: number,
  mesh: CfdMesh,
  state: ConservativeState,
  inputs: NozzleCfdInputs,
  gamma: number,
  rGas: number
) {
  const index = cellIndex(i, j, mesh);
  const insideNeighbor = isInside(neighborI, neighborJ, mesh);
  const primitive = primitiveAt(index, state, gamma, rGas);

  if (neighborI < 0) return totalToStatic(inputs, 0.18, gamma, rGas);
  if (neighborI >= mesh.nx) {
    const p = primitive.mach < 1 ? inputs.ambientPressurePa : primitive.p;
    const rho = Math.max(p / (rGas * primitive.t), 1e-7);
    return { ...primitive, rho, p, e: p / ((gamma - 1) * rho) + 0.5 * (primitive.u * primitive.u + primitive.v * primitive.v) };
  }
  if (neighborJ < 0) return { ...primitive, v: -primitive.v };
  if (!insideNeighbor) {
    return { ...primitive, v: -primitive.v };
  }
  return primitiveAt(cellIndex(neighborI, neighborJ, mesh), state, gamma, rGas);
}

function computeDt(mesh: CfdMesh, state: ConservativeState, gamma: number, rGas: number, cfl: number) {
  let maxWave = 1;
  for (let index = 0; index < mesh.inside.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = primitiveAt(index, state, gamma, rGas);
    maxWave = Math.max(maxWave, Math.abs(primitive.u) + Math.abs(primitive.v) + primitive.a);
  }
  return cfl * Math.min(mesh.dx, mesh.dy) / maxWave;
}

export function runFiniteVolumeSolver(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): SolverResult {
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  const state = initializeFlow(inputs, geometry, mesh);
  const size = mesh.nx * mesh.ny;
  const rhsRho = new Float64Array(size);
  const rhsRhoU = new Float64Array(size);
  const rhsRhoV = new Float64Array(size);
  const rhsRhoE = new Float64Array(size);
  const residuals: NozzleCfdResidualPoint[] = [];
  const iterationBudget = inputs.meshDensity === "research" ? 3200 : inputs.meshDensity === "fine" ? 2400 : inputs.meshDensity === "coarse" ? 1800 : 2200;
  const cfl = inputs.meshDensity === "research" ? 0.18 : inputs.meshDensity === "fine" ? 0.22 : 0.26;
  let converged = false;

  for (let iteration = 1; iteration <= iterationBudget; iteration += 1) {
    rhsRho.fill(0);
    rhsRhoU.fill(0);
    rhsRhoV.fill(0);
    rhsRhoE.fill(0);
    const dt = computeDt(mesh, state, gamma, rGas, cfl);

    for (let j = 0; j < mesh.ny; j += 1) {
      for (let i = 0; i < mesh.nx; i += 1) {
        const index = cellIndex(i, j, mesh);
        if (!mesh.inside[index]) continue;
        const center = primitiveAt(index, state, gamma, rGas);
        const east = ghostPrimitive(i, j, i + 1, j, mesh, state, inputs, gamma, rGas);
        const west = ghostPrimitive(i, j, i - 1, j, mesh, state, inputs, gamma, rGas);
        const north = ghostPrimitive(i, j, i, j + 1, mesh, state, inputs, gamma, rGas);
        const south = ghostPrimitive(i, j, i, j - 1, mesh, state, inputs, gamma, rGas);
        const fluxEast = rusanovFlux(center, east, gamma, "x");
        const fluxWest = rusanovFlux(west, center, gamma, "x");
        const fluxNorth = rusanovFlux(center, north, gamma, "y");
        const fluxSouth = rusanovFlux(south, center, gamma, "y");
        rhsRho[index] = -((fluxEast[0] - fluxWest[0]) / mesh.dx + (fluxNorth[0] - fluxSouth[0]) / mesh.dy);
        rhsRhoU[index] = -((fluxEast[1] - fluxWest[1]) / mesh.dx + (fluxNorth[1] - fluxSouth[1]) / mesh.dy);
        rhsRhoV[index] = -((fluxEast[2] - fluxWest[2]) / mesh.dx + (fluxNorth[2] - fluxSouth[2]) / mesh.dy);
        rhsRhoE[index] = -((fluxEast[3] - fluxWest[3]) / mesh.dx + (fluxNorth[3] - fluxSouth[3]) / mesh.dy);
      }
    }

    let continuity = 0;
    let momentumX = 0;
    let momentumY = 0;
    let energy = 0;
    let active = 0;

    for (let index = 0; index < size; index += 1) {
      if (!mesh.inside[index]) continue;
      const rhoOld = state.rho[index];
      const rhoUOld = state.rhoU[index];
      const rhoVOld = state.rhoV[index];
      const rhoEOld = state.rhoE[index];
      state.rho[index] = Math.max(1e-6, rhoOld + dt * rhsRho[index]);
      state.rhoU[index] = rhoUOld + dt * rhsRhoU[index];
      state.rhoV[index] = rhoVOld + dt * rhsRhoV[index];
      state.rhoE[index] = Math.max(1, rhoEOld + dt * rhsRhoE[index]);
      continuity += Math.abs(state.rho[index] - rhoOld) / Math.max(Math.abs(rhoOld), 1e-6);
      momentumX += Math.abs(state.rhoU[index] - rhoUOld) / Math.max(Math.abs(rhoUOld), 1);
      momentumY += Math.abs(state.rhoV[index] - rhoVOld) / Math.max(Math.abs(rhoVOld), 1);
      energy += Math.abs(state.rhoE[index] - rhoEOld) / Math.max(Math.abs(rhoEOld), 1);
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
  return primitiveAt(index, state, Math.max(1.05, Math.min(1.67, inputs.gamma)), gasConstant(inputs));
}
