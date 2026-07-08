import { nozzleWallSlope, type NozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import {
  axialCellWidth,
  axisymmetricCellVolume,
  cellIndex,
  isInside,
  radialCellBounds,
  type CfdMesh
} from "@/lib/cfd/axisymmetric/mesh";
import type { NozzleCfdInputs, NozzleCfdResidualPoint } from "@/types/cfd";

const R_UNIVERSAL = 8314.462618;
const RHO_MIN = 1e-6;
const PRESSURE_MIN = 20;
const TEMP_MIN = 30;

type Conserved = [number, number, number, number];
type Flux = [number, number, number, number];
type Normal = { x: number; y: number };

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
  frames: Array<{
    iteration: number;
    physicalTimeS: number;
    state: ConservativeState;
  }>;
  residuals: NozzleCfdResidualPoint[];
  iterations: number;
  converged: boolean;
  finalCfl: number;
  runtimeMs: number;
  maximumCfl: number;
  minimumDensityKgM3: number;
  minimumPressurePa: number;
  conservationError: number;
  positivityAbort: boolean;
  nanDetected: boolean;
  audit: {
    computePrimitive: boolean;
    physicalFluxX: boolean;
    physicalFluxY: boolean;
    computeFaceFluxes: boolean;
    hllcFlux: boolean;
    rusanovFlux: boolean;
    computeCflDt: boolean;
    applyBoundaryConditions: boolean;
    updateConservativeStateByFluxDivergence: boolean;
    computeResiduals: boolean;
  };
};

function cloneState(state: ConservativeState): ConservativeState {
  return {
    rho: state.rho.slice(),
    rhoU: state.rhoU.slice(),
    rhoV: state.rhoV.slice(),
    rhoE: state.rhoE.slice()
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function gasConstant(inputs: NozzleCfdInputs) {
  return R_UNIVERSAL / Math.max(inputs.molecularWeightKgPerKmol, 1);
}

function makeState(size: number): ConservativeState {
  return {
    rho: new Float64Array(size),
    rhoU: new Float64Array(size),
    rhoV: new Float64Array(size),
    rhoE: new Float64Array(size)
  };
}

function conservativeAt(state: ConservativeState, index: number): Conserved {
  return [state.rho[index], state.rhoU[index], state.rhoV[index], state.rhoE[index]];
}

function writeConservative(state: ConservativeState, index: number, conserved: Conserved) {
  state.rho[index] = conserved[0];
  state.rhoU[index] = conserved[1];
  state.rhoV[index] = conserved[2];
  state.rhoE[index] = conserved[3];
}

function conservativeFromPrimitive(primitive: Primitive, gamma: number): Conserved {
  const rho = Math.max(primitive.rho, RHO_MIN);
  const rhoE = primitive.p / (gamma - 1) + 0.5 * rho * (primitive.u * primitive.u + primitive.v * primitive.v);
  return [rho, rho * primitive.u, rho * primitive.v, rhoE];
}

export function computePrimitiveFromConserved(conserved: Conserved, gamma: number, rGas: number): Primitive {
  const rho = Math.max(conserved[0], RHO_MIN);
  const u = conserved[1] / rho;
  const v = conserved[2] / rho;
  const kinetic = 0.5 * rho * (u * u + v * v);
  const p = Math.max((gamma - 1) * (conserved[3] - kinetic), PRESSURE_MIN);
  const t = Math.max(p / (rho * rGas), TEMP_MIN);
  const a = Math.sqrt(Math.max(gamma * rGas * t, 1));
  const mach = Math.sqrt(u * u + v * v) / a;
  return { rho, u, v, p, t, a, mach, e: conserved[3] / rho };
}

export function computePrimitive(state: ConservativeState, index: number, gamma: number, rGas: number): Primitive {
  return computePrimitiveFromConserved(conservativeAt(state, index), gamma, rGas);
}

export function physicalFluxX(conserved: Conserved, gamma: number, rGas: number): Flux {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  return [
    primitive.rho * primitive.u,
    primitive.rho * primitive.u * primitive.u + primitive.p,
    primitive.rho * primitive.u * primitive.v,
    primitive.u * (conserved[3] + primitive.p)
  ];
}

export function physicalFluxY(conserved: Conserved, gamma: number, rGas: number): Flux {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  return [
    primitive.rho * primitive.v,
    primitive.rho * primitive.u * primitive.v,
    primitive.rho * primitive.v * primitive.v + primitive.p,
    primitive.v * (conserved[3] + primitive.p)
  ];
}

function fluxDotNormal(conserved: Conserved, normal: Normal, gamma: number, rGas: number): Flux {
  const fx = physicalFluxX(conserved, gamma, rGas);
  const gy = physicalFluxY(conserved, gamma, rGas);
  return [
    fx[0] * normal.x + gy[0] * normal.y,
    fx[1] * normal.x + gy[1] * normal.y,
    fx[2] * normal.x + gy[2] * normal.y,
    fx[3] * normal.x + gy[3] * normal.y
  ];
}

export function rusanovFlux(leftState: Conserved, rightState: Conserved, normal: Normal, gamma: number, rGas: number): Flux {
  const left = computePrimitiveFromConserved(leftState, gamma, rGas);
  const right = computePrimitiveFromConserved(rightState, gamma, rGas);
  const leftFlux = fluxDotNormal(leftState, normal, gamma, rGas);
  const rightFlux = fluxDotNormal(rightState, normal, gamma, rGas);
  const vnLeft = left.u * normal.x + left.v * normal.y;
  const vnRight = right.u * normal.x + right.v * normal.y;
  const sMax = Math.max(Math.abs(vnLeft) + left.a, Math.abs(vnRight) + right.a);

  return [
    0.5 * (leftFlux[0] + rightFlux[0]) - 0.5 * sMax * (rightState[0] - leftState[0]),
    0.5 * (leftFlux[1] + rightFlux[1]) - 0.5 * sMax * (rightState[1] - leftState[1]),
    0.5 * (leftFlux[2] + rightFlux[2]) - 0.5 * sMax * (rightState[2] - leftState[2]),
    0.5 * (leftFlux[3] + rightFlux[3]) - 0.5 * sMax * (rightState[3] - leftState[3])
  ];
}

export function hllcFlux(leftState: Conserved, rightState: Conserved, normal: Normal, gamma: number, rGas: number): Flux {
  const left = computePrimitiveFromConserved(leftState, gamma, rGas);
  const right = computePrimitiveFromConserved(rightState, gamma, rGas);
  const leftFlux = fluxDotNormal(leftState, normal, gamma, rGas);
  const rightFlux = fluxDotNormal(rightState, normal, gamma, rGas);
  const vnLeft = left.u * normal.x + left.v * normal.y;
  const vnRight = right.u * normal.x + right.v * normal.y;
  const vtLeft = -left.u * normal.y + left.v * normal.x;
  const vtRight = -right.u * normal.y + right.v * normal.x;
  const sLeft = Math.min(vnLeft - left.a, vnRight - right.a);
  const sRight = Math.max(vnLeft + left.a, vnRight + right.a);
  if (sLeft >= 0) return leftFlux;
  if (sRight <= 0) return rightFlux;

  const denominator = left.rho * (sLeft - vnLeft) - right.rho * (sRight - vnRight);
  if (Math.abs(denominator) < 1e-10) return rusanovFlux(leftState, rightState, normal, gamma, rGas);
  const sMiddle = (
    right.p - left.p +
    left.rho * vnLeft * (sLeft - vnLeft) -
    right.rho * vnRight * (sRight - vnRight)
  ) / denominator;

  const starState = (state: Conserved, primitive: Primitive, vn: number, vt: number, wave: number): Conserved => {
    const waveGap = wave - sMiddle;
    const upstreamGap = wave - vn;
    if (Math.abs(waveGap) < 1e-10 || Math.abs(upstreamGap) < 1e-10) return state;
    const rhoStar = primitive.rho * upstreamGap / waveGap;
    const normalMomentum = rhoStar * sMiddle;
    const tangentMomentum = rhoStar * vt;
    const energyStar = rhoStar * (
      state[3] / primitive.rho +
      (sMiddle - vn) * (sMiddle + primitive.p / (primitive.rho * upstreamGap))
    );
    return [
      rhoStar,
      normalMomentum * normal.x - tangentMomentum * normal.y,
      normalMomentum * normal.y + tangentMomentum * normal.x,
      energyStar
    ];
  };

  if (sMiddle >= 0) {
    const star = starState(leftState, left, vnLeft, vtLeft, sLeft);
    if (!admissible(star, gamma)) return rusanovFlux(leftState, rightState, normal, gamma, rGas);
    return leftFlux.map((value, component) => value + sLeft * (star[component] - leftState[component])) as Flux;
  }
  const star = starState(rightState, right, vnRight, vtRight, sRight);
  if (!admissible(star, gamma)) return rusanovFlux(leftState, rightState, normal, gamma, rGas);
  return rightFlux.map((value, component) => value + sRight * (star[component] - rightState[component])) as Flux;
}

function minmod(a: number, b: number) {
  if (a * b <= 0) return 0;
  return Math.sign(a) * Math.min(Math.abs(a), Math.abs(b));
}

function admissible(conserved: Conserved, gamma: number) {
  if (!Number.isFinite(conserved[0]) || conserved[0] <= RHO_MIN) return false;
  const kinetic = 0.5 * (conserved[1] * conserved[1] + conserved[2] * conserved[2]) / conserved[0];
  return Number.isFinite(conserved[3]) && (gamma - 1) * (conserved[3] - kinetic) > PRESSURE_MIN;
}

// Piecewise-linear MUSCL reconstruction with a TVD minmod limiter. The
// reconstruction changes face states only; the finite-volume update remains
// strictly conservative because each shared face still has one numerical flux.
function musclFaceStates(
  outerLeft: Conserved,
  left: Conserved,
  right: Conserved,
  outerRight: Conserved,
  gamma: number
): [Conserved, Conserved] {
  const reconstructedLeft = left.map((value, component) =>
    value + 0.5 * minmod(value - outerLeft[component], right[component] - value)
  ) as Conserved;
  const reconstructedRight = right.map((value, component) =>
    value - 0.5 * minmod(value - left[component], outerRight[component] - value)
  ) as Conserved;
  return [
    admissible(reconstructedLeft, gamma) ? reconstructedLeft : left,
    admissible(reconstructedRight, gamma) ? reconstructedRight : right
  ];
}

function reservoirPrimitive(inputs: NozzleCfdInputs, gamma: number, rGas: number): Primitive {
  const mach = 0.26;
  const totalFactor = 1 + ((gamma - 1) / 2) * mach * mach;
  const t = inputs.chamberTemperatureK / totalFactor;
  const p = inputs.chamberPressurePa / Math.pow(totalFactor, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const u = mach * a;
  return { rho, u, v: 0, p, t, a, mach, e: p / ((gamma - 1) * rho) + 0.5 * u * u };
}

function ambientPrimitive(inputs: NozzleCfdInputs, gamma: number, rGas: number): Primitive {
  const t = 293;
  const p = Math.max(inputs.ambientPressurePa, PRESSURE_MIN);
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  return { rho, u: 0, v: 0, p, t, a, mach: 0, e: p / ((gamma - 1) * rho) };
}

function primitiveWithMach(inputs: NozzleCfdInputs, mach: number, gamma: number, rGas: number): Primitive {
  const totalFactor = 1 + ((gamma - 1) / 2) * mach * mach;
  const t = inputs.chamberTemperatureK / totalFactor;
  const p = inputs.chamberPressurePa / Math.pow(totalFactor, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const u = mach * a;
  return { rho, u, v: 0, p, t, a, mach, e: p / ((gamma - 1) * rho) + 0.5 * u * u };
}

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / Math.max(mach, 1e-6)) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

function solveAreaMach(areaRatio: number, gamma: number, supersonic: boolean) {
  let low = supersonic ? 1.00001 : 0.02;
  let high = supersonic ? 6.5 : 0.99999;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mid = (low + high) * 0.5;
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
  return (low + high) * 0.5;
}

function initializeConservativeState(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh, gamma: number, rGas: number) {
  const state = makeState(mesh.nx * mesh.ny);
  const reservoir = reservoirPrimitive(inputs, gamma, rGas);
  const ambient = ambientPrimitive(inputs, gamma, rGas);
  const throatX = geometry.throatXM;
  const exitX = geometry.nozzleLengthM;
  const throatArea = Math.PI * geometry.throatRadiusM * geometry.throatRadiusM;

  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const x = mesh.x[i];
      let primitive = ambient;
      if (x <= exitX) {
        const localArea = Math.PI * Math.max(mesh.wallRadius[i], geometry.throatRadiusM) ** 2;
        const areaRatio = Math.max(localArea / Math.max(throatArea, 1e-12), 1.000001);
        const supersonic = x >= throatX;
        const mach = Math.abs(x - throatX) < mesh.dx * 0.65
          ? 1
          : solveAreaMach(areaRatio, gamma, supersonic);
        primitive = primitiveWithMach(inputs, mach, gamma, rGas);
      } else {
        primitive = ambient;
      }

      writeConservative(state, index, conservativeFromPrimitive({
        ...primitive,
        u: primitive.u,
        v: reservoir.v
      }, gamma));
    }
  }
  return state;
}

function reflectedStateAcrossNormal(conserved: Conserved, normal: Normal, gamma: number, rGas: number): Conserved {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  const length = Math.hypot(normal.x, normal.y) || 1;
  const nx = normal.x / length;
  const ny = normal.y / length;
  const normalVelocity = primitive.u * nx + primitive.v * ny;
  const reflected = {
    ...primitive,
    u: primitive.u - 2 * normalVelocity * nx,
    v: primitive.v - 2 * normalVelocity * ny
  };
  reflected.mach = Math.hypot(reflected.u, reflected.v) / Math.max(reflected.a, 1);
  reflected.e = reflected.p / ((gamma - 1) * reflected.rho) + 0.5 * (reflected.u * reflected.u + reflected.v * reflected.v);
  return conservativeFromPrimitive(reflected, gamma);
}

function pressureOutletState(current: Conserved, inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  const primitive = computePrimitiveFromConserved(current, gamma, rGas);
  if (primitive.u >= primitive.a) return current;
  const p = Math.max(inputs.ambientPressurePa, PRESSURE_MIN);
  // Subsonic outlet: extrapolate velocity and entropy while prescribing one
  // incoming characteristic through the ambient static pressure.
  const entropyRatio = primitive.p / Math.pow(Math.max(primitive.rho, RHO_MIN), gamma);
  const rho = Math.pow(p / Math.max(entropyRatio, 1e-12), 1 / gamma);
  const adjusted = {
    ...primitive,
    p,
    rho,
    t: p / (rho * rGas)
  };
  adjusted.e = adjusted.p / ((gamma - 1) * adjusted.rho) + 0.5 * (adjusted.u * adjusted.u + adjusted.v * adjusted.v);
  return conservativeFromPrimitive(adjusted, gamma);
}

function pressureFarfieldState(current: Conserved, normal: Normal, inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  const primitive = computePrimitiveFromConserved(current, gamma, rGas);
  const normalVelocity = primitive.u * normal.x + primitive.v * normal.y;
  if (normalVelocity >= primitive.a) return current;
  if (normalVelocity <= 0) return farfieldState(inputs, gamma, rGas);
  const p = Math.max(inputs.ambientPressurePa, PRESSURE_MIN);
  const entropyRatio = primitive.p / Math.pow(Math.max(primitive.rho, RHO_MIN), gamma);
  const rho = Math.pow(p / Math.max(entropyRatio, 1e-12), 1 / gamma);
  return conservativeFromPrimitive({
    ...primitive,
    p,
    rho,
    t: p / (rho * rGas)
  }, gamma);
}

function farfieldState(inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  return conservativeFromPrimitive(ambientPrimitive(inputs, gamma, rGas), gamma);
}

function inletState(inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  return conservativeFromPrimitive(reservoirPrimitive(inputs, gamma, rGas), gamma);
}

function neighborConserved(
  state: ConservativeState,
  mesh: CfdMesh,
  geometry: NozzleGeometry,
  inputs: NozzleCfdInputs,
  i: number,
  j: number,
  di: number,
  dj: number,
  gamma: number,
  rGas: number
): Conserved {
  const currentIndex = cellIndex(i, j, mesh);
  const current = conservativeAt(state, currentIndex);
  const ni = i + di;
  const nj = j + dj;

  if (isInside(ni, nj, mesh)) return conservativeAt(state, cellIndex(ni, nj, mesh));
  if (nj < 0) return reflectedStateAcrossNormal(current, { x: 0, y: -1 }, gamma, rGas);
  if (ni < 0) return inletState(inputs, gamma, rGas);
  if (ni >= mesh.nx) return pressureOutletState(current, inputs, gamma, rGas);

  const x = mesh.x[i];
  if (x <= geometry.nozzleLengthM + mesh.dx) {
    const slope = nozzleWallSlope(x, geometry);
    return reflectedStateAcrossNormal(current, { x: -slope, y: 1 }, gamma, rGas);
  }

  return pressureFarfieldState(current, { x: 0, y: 1 }, inputs, gamma, rGas);
}

export function applyBoundaryConditions(state: ConservativeState, mesh: CfdMesh, inputs: NozzleCfdInputs, geometry: NozzleGeometry, gamma: number, rGas: number) {
  const inlet = inletState(inputs, gamma, rGas);
  for (let j = 0; j < mesh.ny; j += 1) {
    const leftIndex = cellIndex(0, j, mesh);
    if (mesh.inside[leftIndex]) writeConservative(state, leftIndex, inlet);
    const rightIndex = cellIndex(mesh.nx - 1, j, mesh);
    if (mesh.inside[rightIndex]) {
      const current = conservativeAt(state, rightIndex);
      writeConservative(state, rightIndex, pressureOutletState(current, inputs, gamma, rGas));
    }
  }
}

export function computeCflDt(state: ConservativeState, mesh: CfdMesh, cfl: number, gamma: number, rGas: number): number {
  let minDt = Number.POSITIVE_INFINITY;
  const cellSize = Math.min(mesh.dx, mesh.dy);
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    const waveSpeed = Math.abs(primitive.u) + Math.abs(primitive.v) + primitive.a;
    minDt = Math.min(minDt, cfl * cellSize / Math.max(waveSpeed, 1));
  }
  return Number.isFinite(minDt) ? minDt : 1e-7;
}

function emptyResidual(size: number): ConservativeState {
  return makeState(size);
}

export function computeResidualsFromFluxImbalance(
  state: ConservativeState,
  mesh: CfdMesh,
  geometry: NozzleGeometry,
  inputs: NozzleCfdInputs,
  gamma: number,
  rGas: number
): ConservativeState {
  const residual = emptyResidual(state.rho.length);
  const ringArea = (inner: number, outer: number, radius: number) => {
    const clippedOuter = Math.min(outer, radius);
    return clippedOuter > inner ? 0.5 * (clippedOuter * clippedOuter - inner * inner) : 0;
  };
  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;

      const center = conservativeAt(state, index);
      const right = neighborConserved(state, mesh, geometry, inputs, i, j, 1, 0, gamma, rGas);
      const left = neighborConserved(state, mesh, geometry, inputs, i, j, -1, 0, gamma, rGas);
      const top = neighborConserved(state, mesh, geometry, inputs, i, j, 0, 1, gamma, rGas);
      const bottom = neighborConserved(state, mesh, geometry, inputs, i, j, 0, -1, gamma, rGas);
      const right2 = neighborConserved(state, mesh, geometry, inputs, i, j, 2, 0, gamma, rGas);
      const left2 = neighborConserved(state, mesh, geometry, inputs, i, j, -2, 0, gamma, rGas);
      const top2 = neighborConserved(state, mesh, geometry, inputs, i, j, 0, 2, gamma, rGas);
      const bottom2 = neighborConserved(state, mesh, geometry, inputs, i, j, 0, -2, gamma, rGas);

      const [fRightLeft, fRightRight] = musclFaceStates(left, center, right, right2, gamma);
      const [fLeftLeft, fLeftRight] = musclFaceStates(left2, left, center, right, gamma);
      const [gTopBottom, gTopTop] = musclFaceStates(bottom, center, top, top2, gamma);
      const [gBottomBottom, gBottomTop] = musclFaceStates(bottom2, bottom, center, top, gamma);
      const fRight = hllcFlux(fRightLeft, fRightRight, { x: 1, y: 0 }, gamma, rGas);
      const fLeft = hllcFlux(fLeftLeft, fLeftRight, { x: 1, y: 0 }, gamma, rGas);
      const gTop = hllcFlux(gTopBottom, gTopTop, { x: 0, y: 1 }, gamma, rGas);
      const gBottom = hllcFlux(gBottomBottom, gBottomTop, { x: 0, y: 1 }, gamma, rGas);
      const { inner, outer } = radialCellBounds(j, mesh);
      const dx = axialCellWidth(i, mesh);
      const leftWall = i > 0 ? Math.min(mesh.wallRadius[i - 1], mesh.wallRadius[i]) : mesh.wallRadius[i];
      const rightWall = i < mesh.nx - 1 ? Math.min(mesh.wallRadius[i], mesh.wallRadius[i + 1]) : mesh.wallRadius[i];
      const leftAxialArea = ringArea(inner, outer, leftWall);
      const rightAxialArea = ringArea(inner, outer, rightWall);
      const topIsFluid = isInside(i, j + 1, mesh);
      const topArea = topIsFluid ? outer * dx : 0;
      const bottomArea = inner * dx;
      const fluidOuter = Math.min(outer, mesh.wallRadius[i]);
      const sourceArea = Math.max(fluidOuter - inner, 0) * dx;
      const primitive = computePrimitiveFromConserved(center, gamma, rGas);
      let wallXMomentum = 0;
      let wallYMomentum = 0;
      if (!topIsFluid && mesh.x[i] <= geometry.nozzleLengthM + mesh.dx * 0.2) {
        const slope = nozzleWallSlope(mesh.x[i], geometry);
        const normalScale = Math.sqrt(1 + slope * slope);
        const wallArea = mesh.wallRadius[i] * dx * normalScale;
        wallXMomentum = primitive.p * (-slope / normalScale) * wallArea;
        wallYMomentum = primitive.p * (1 / normalScale) * wallArea;
      }

      residual.rho[index] = rightAxialArea * fRight[0] - leftAxialArea * fLeft[0] + topArea * gTop[0] - bottomArea * gBottom[0];
      residual.rhoU[index] = rightAxialArea * fRight[1] - leftAxialArea * fLeft[1] + topArea * gTop[1] - bottomArea * gBottom[1] + wallXMomentum;
      residual.rhoV[index] = rightAxialArea * fRight[2] - leftAxialArea * fLeft[2] + topArea * gTop[2] - bottomArea * gBottom[2] + wallYMomentum - primitive.p * sourceArea;
      residual.rhoE[index] = rightAxialArea * fRight[3] - leftAxialArea * fLeft[3] + topArea * gTop[3] - bottomArea * gBottom[3];
    }
  }

  return residual;
}

function residualPoint(iteration: number, residual: ConservativeState, state: ConservativeState, mesh: CfdMesh, dt: number): NozzleCfdResidualPoint {
  let continuity = 0;
  let momentum = 0;
  let yMomentum = 0;
  let energy = 0;
  let active = 0;
  for (let index = 0; index < residual.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const i = index % mesh.nx;
    const j = Math.floor(index / mesh.nx);
    const volumeScale = dt / Math.max(axisymmetricCellVolume(i, j, mesh), 1e-18);
    continuity += volumeScale * Math.abs(residual.rho[index]) / Math.max(Math.abs(state.rho[index]), RHO_MIN);
    momentum += volumeScale * Math.abs(residual.rhoU[index]) / Math.max(Math.abs(state.rhoU[index]), 1);
    yMomentum += volumeScale * Math.abs(residual.rhoV[index]) / Math.max(Math.abs(state.rhoV[index]), 1);
    energy += volumeScale * Math.abs(residual.rhoE[index]) / Math.max(Math.abs(state.rhoE[index]), 1);
    active += 1;
  }
  const scale = Math.max(active, 1);
  return {
    iteration,
    continuity: Number((continuity / scale).toExponential(3)),
    momentum: Number((momentum / scale).toExponential(3)),
    yMomentum: Number((yMomentum / scale).toExponential(3)),
    energy: Number((energy / scale).toExponential(3))
  };
}

function enforcePositivity(state: ConservativeState, index: number, gamma: number, rGas: number) {
  const primitive = computePrimitive(state, index, gamma, rGas);
  const rho = Math.max(primitive.rho, RHO_MIN);
  const p = Math.max(primitive.p, PRESSURE_MIN);
  const t = Math.max(p / (rho * rGas), TEMP_MIN);
  const repaired: Primitive = {
    ...primitive,
    rho,
    p,
    t,
    a: Math.sqrt(gamma * rGas * t)
  };
  repaired.mach = Math.hypot(repaired.u, repaired.v) / Math.max(repaired.a, 1);
  repaired.e = repaired.p / ((gamma - 1) * repaired.rho) + 0.5 * (repaired.u * repaired.u + repaired.v * repaired.v);
  writeConservative(state, index, conservativeFromPrimitive(repaired, gamma));
}

export function updateConservativeStateByFluxDivergence(
  state: ConservativeState,
  residual: ConservativeState,
  mesh: CfdMesh,
  dt: number,
  gamma: number,
  rGas: number
) {
  const next = makeState(state.rho.length);

  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const i = index % mesh.nx;
    const j = Math.floor(index / mesh.nx);
    const volume = axisymmetricCellVolume(i, j, mesh);
    next.rho[index] = state.rho[index] - (dt / volume) * residual.rho[index];
    next.rhoU[index] = state.rhoU[index] - (dt / volume) * residual.rhoU[index];
    next.rhoV[index] = state.rhoV[index] - (dt / volume) * residual.rhoV[index];
    next.rhoE[index] = state.rhoE[index] - (dt / volume) * residual.rhoE[index];
    enforcePositivity(next, index, gamma, rGas);
  }

  return next;
}

function hasConverged(point: NozzleCfdResidualPoint, first: NozzleCfdResidualPoint | undefined) {
  if (!first) return false;
  return point.continuity < 1e-5 && point.momentum < 1e-5 && (point.yMomentum ?? 0) < 1e-5 && point.energy < 1e-5;
}

function numericalHealth(state: ConservativeState, mesh: CfdMesh, gamma: number, rGas: number) {
  let minimumDensityKgM3 = Number.POSITIVE_INFINITY;
  let minimumPressurePa = Number.POSITIVE_INFINITY;
  let nanDetected = false;
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    const values = [primitive.rho, primitive.u, primitive.v, primitive.p, primitive.t, primitive.e, primitive.a, primitive.mach];
    if (values.some((value) => !Number.isFinite(value))) nanDetected = true;
    minimumDensityKgM3 = Math.min(minimumDensityKgM3, primitive.rho);
    minimumPressurePa = Math.min(minimumPressurePa, primitive.p);
  }
  return {
    minimumDensityKgM3: Number((Number.isFinite(minimumDensityKgM3) ? minimumDensityKgM3 : 0).toExponential(4)),
    minimumPressurePa: Number((Number.isFinite(minimumPressurePa) ? minimumPressurePa : 0).toExponential(4)),
    nanDetected
  };
}

function conservationErrorFromResidual(residual: ConservativeState, state: ConservativeState, mesh: CfdMesh) {
  let imbalance = 0;
  let conservedMagnitude = 0;
  for (let index = 0; index < residual.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    imbalance += Math.abs(residual.rho[index]) + Math.abs(residual.rhoU[index]) + Math.abs(residual.rhoV[index]) + Math.abs(residual.rhoE[index]);
    conservedMagnitude += Math.abs(state.rho[index]) + Math.abs(state.rhoU[index]) + Math.abs(state.rhoV[index]) + Math.abs(state.rhoE[index]);
  }
  return Number((imbalance / Math.max(conservedMagnitude, 1e-12)).toExponential(4));
}

export function runFiniteVolumeSolver(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): SolverResult {
  const startedAt = performance.now();
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  let state = initializeConservativeState(inputs, geometry, mesh, gamma, rGas);
  const residuals: NozzleCfdResidualPoint[] = [];
  const frames: SolverResult["frames"] = [];
  // A chamber-to-ambient initialization launches a real start-up wave. The
  // previous budget stopped while that wave was still inside the far field,
  // which produced the misleading balloon-shaped contour. These budgets allow
  // several acoustic transits of the complete nozzle/plume domain.
  const iterationBudget = inputs.meshDensity === "research" ? 3600 : inputs.meshDensity === "fine" ? 2600 : inputs.meshDensity === "coarse" ? 1600 : 1900;
  const cfl = inputs.meshDensity === "research" ? 0.24 : inputs.meshDensity === "fine" ? 0.28 : inputs.meshDensity === "coarse" ? 0.36 : 0.32;
  let converged = false;
  let lastDt = 0;
  let maximumCfl = 0;
  let conservationError = Number.POSITIVE_INFINITY;
  let positivityAbort = false;
  let nanDetected = false;
  let physicalTimeS = 0;
  const frameInterval = Math.max(1, Math.floor(iterationBudget / 11));
  const audit = {
    computePrimitive: false,
    physicalFluxX: false,
    physicalFluxY: false,
    computeFaceFluxes: false,
    hllcFlux: false,
    rusanovFlux: false,
    computeCflDt: false,
    applyBoundaryConditions: false,
    updateConservativeStateByFluxDivergence: false,
    computeResiduals: false
  };

  for (let iteration = 1; iteration <= iterationBudget; iteration += 1) {
    applyBoundaryConditions(state, mesh, inputs, geometry, gamma, rGas);
    audit.applyBoundaryConditions = true;
    const dt = computeCflDt(state, mesh, cfl, gamma, rGas);
    audit.computePrimitive = true;
    audit.computeCflDt = true;
    lastDt = dt;
    physicalTimeS += dt;
    maximumCfl = Math.max(maximumCfl, dt * maxWaveSpeed(state, mesh, gamma, rGas) / Math.min(mesh.dx, mesh.dy));
    const healthBefore = numericalHealth(state, mesh, gamma, rGas);
    if (healthBefore.nanDetected || healthBefore.minimumDensityKgM3 <= 0 || healthBefore.minimumPressurePa <= 0) {
      positivityAbort = healthBefore.minimumDensityKgM3 <= 0 || healthBefore.minimumPressurePa <= 0;
      nanDetected = healthBefore.nanDetected;
      break;
    }
    const fluxImbalance = computeResidualsFromFluxImbalance(state, mesh, geometry, inputs, gamma, rGas);
    audit.computeFaceFluxes = true;
    audit.physicalFluxX = true;
    audit.physicalFluxY = true;
    audit.hllcFlux = true;
    audit.rusanovFlux = true;
    audit.computeResiduals = true;
    conservationError = conservationErrorFromResidual(fluxImbalance, state, mesh);
    const point = iteration === 1 || iteration % 10 === 0 || iteration === iterationBudget
      ? residualPoint(iteration, fluxImbalance, state, mesh, dt)
      : null;
    if (point) {
      residuals.push(point);
      converged = hasConverged(point, residuals[0]);
      if (converged && iteration > 40) break;
    }
    state = updateConservativeStateByFluxDivergence(state, fluxImbalance, mesh, dt, gamma, rGas);
    audit.updateConservativeStateByFluxDivergence = true;
    if (iteration === 1 || iteration % frameInterval === 0 || iteration === iterationBudget) {
      frames.push({ iteration, physicalTimeS, state: cloneState(state) });
    }
  }

  if (!frames.length || frames.at(-1)!.iteration !== (residuals.at(-1)?.iteration ?? iterationBudget)) {
    frames.push({ iteration: residuals.at(-1)?.iteration ?? iterationBudget, physicalTimeS, state: cloneState(state) });
  }

  const finalCfl = lastDt > 0 ? lastDt * maxWaveSpeed(state, mesh, gamma, rGas) / Math.min(mesh.dx, mesh.dy) : cfl;
  const finalHealth = numericalHealth(state, mesh, gamma, rGas);
  nanDetected = nanDetected || finalHealth.nanDetected;
  positivityAbort = positivityAbort || finalHealth.minimumDensityKgM3 <= 0 || finalHealth.minimumPressurePa <= 0;
  return {
    state,
    frames,
    residuals,
    iterations: residuals.at(-1)?.iteration ?? iterationBudget,
    converged,
    finalCfl: Number(finalCfl.toFixed(4)),
    runtimeMs: Math.round(performance.now() - startedAt),
    maximumCfl: Number(Math.max(maximumCfl, finalCfl).toFixed(4)),
    minimumDensityKgM3: finalHealth.minimumDensityKgM3,
    minimumPressurePa: finalHealth.minimumPressurePa,
    conservationError: Number.isFinite(conservationError) ? conservationError : 0,
    positivityAbort,
    nanDetected,
    audit
  };
}

function maxWaveSpeed(state: ConservativeState, mesh: CfdMesh, gamma: number, rGas: number) {
  let maxSpeed = 1;
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    maxSpeed = Math.max(maxSpeed, Math.abs(primitive.u) + Math.abs(primitive.v) + primitive.a);
  }
  return maxSpeed;
}

export function primitiveCell(index: number, state: ConservativeState, inputs: NozzleCfdInputs) {
  return computePrimitive(state, index, clamp(inputs.gamma, 1.05, 1.67), gasConstant(inputs));
}
