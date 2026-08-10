import { CFD_GAMMA, EXTERNAL_CFD_DENSITY_FLOOR, EXTERNAL_CFD_PRESSURE_FLOOR } from "./constants";

export type PrimitiveState = { rho: number; u: number; v: number; p: number };
export type ConservedState = [number, number, number, number];

export function minmod(a: number, b: number) {
  if (a * b <= 0) return 0;
  return Math.sign(a) * Math.min(Math.abs(a), Math.abs(b));
}

export function primitiveToConserved(state: PrimitiveState): ConservedState {
  const rho = Math.max(EXTERNAL_CFD_DENSITY_FLOOR, state.rho);
  const p = Math.max(EXTERNAL_CFD_PRESSURE_FLOOR, state.p);
  return [rho, rho * state.u, rho * state.v, p / (CFD_GAMMA - 1) + 0.5 * rho * (state.u * state.u + state.v * state.v)];
}

export function conservedToPrimitive(rhoRaw: number, rhoU: number, rhoV: number, energy: number): PrimitiveState {
  const rho = Math.max(EXTERNAL_CFD_DENSITY_FLOOR, rhoRaw);
  const u = rhoU / rho;
  const v = rhoV / rho;
  const kinetic = 0.5 * rho * (u * u + v * v);
  const p = Math.max(EXTERNAL_CFD_PRESSURE_FLOOR, (CFD_GAMMA - 1) * (energy - kinetic));
  return { rho, u, v, p };
}

function physicalFlux(state: PrimitiveState, axis: "x" | "y"): ConservedState {
  const conserved = primitiveToConserved(state);
  const normalVelocity = axis === "x" ? state.u : state.v;
  if (axis === "x") return [conserved[1], conserved[1] * state.u + state.p, conserved[1] * state.v, (conserved[3] + state.p) * normalVelocity];
  return [conserved[2], conserved[2] * state.u, conserved[2] * state.v + state.p, (conserved[3] + state.p) * normalVelocity];
}

function rusanovFlux(left: PrimitiveState, right: PrimitiveState, axis: "x" | "y") {
  const ul = primitiveToConserved(left);
  const ur = primitiveToConserved(right);
  const fl = physicalFlux(left, axis);
  const fr = physicalFlux(right, axis);
  const al = Math.sqrt(CFD_GAMMA * left.p / left.rho);
  const ar = Math.sqrt(CFD_GAMMA * right.p / right.rho);
  const speed = Math.max(Math.abs(axis === "x" ? left.u : left.v) + al, Math.abs(axis === "x" ? right.u : right.v) + ar);
  return fl.map((value, index) => 0.5 * (value + fr[index]) - 0.5 * speed * (ur[index] - ul[index])) as ConservedState;
}

export function hllcFlux(leftInput: PrimitiveState, rightInput: PrimitiveState, axis: "x" | "y"): ConservedState {
  const left = { ...leftInput, rho: Math.max(leftInput.rho, EXTERNAL_CFD_DENSITY_FLOOR), p: Math.max(leftInput.p, EXTERNAL_CFD_PRESSURE_FLOOR) };
  const right = { ...rightInput, rho: Math.max(rightInput.rho, EXTERNAL_CFD_DENSITY_FLOOR), p: Math.max(rightInput.p, EXTERNAL_CFD_PRESSURE_FLOOR) };
  const unL = axis === "x" ? left.u : left.v;
  const unR = axis === "x" ? right.u : right.v;
  const utL = axis === "x" ? left.v : left.u;
  const utR = axis === "x" ? right.v : right.u;
  const aL = Math.sqrt(CFD_GAMMA * left.p / left.rho);
  const aR = Math.sqrt(CFD_GAMMA * right.p / right.rho);
  const sL = Math.min(unL - aL, unR - aR);
  const sR = Math.max(unL + aL, unR + aR);
  const denominator = left.rho * (sL - unL) - right.rho * (sR - unR);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) return rusanovFlux(left, right, axis);
  const sStar = (right.p - left.p + left.rho * unL * (sL - unL) - right.rho * unR * (sR - unR)) / denominator;
  const fluxL = physicalFlux(left, axis);
  const fluxR = physicalFlux(right, axis);
  if (sL >= 0) return fluxL;
  if (sR <= 0) return fluxR;

  const side = sStar >= 0 ? left : right;
  const sSide = sStar >= 0 ? sL : sR;
  const un = sStar >= 0 ? unL : unR;
  const ut = sStar >= 0 ? utL : utR;
  const conserved = primitiveToConserved(side);
  const factor = side.rho * (sSide - un) / (sSide - sStar);
  const energySpecific = conserved[3] / side.rho;
  const starEnergy = factor * (energySpecific + (sStar - un) * (sStar + side.p / (side.rho * (sSide - un))));
  const star: ConservedState = axis === "x"
    ? [factor, factor * sStar, factor * ut, starEnergy]
    : [factor, factor * ut, factor * sStar, starEnergy];
  const baseFlux = sStar >= 0 ? fluxL : fluxR;
  const baseState = conserved;
  const result = baseFlux.map((value, index) => value + sSide * (star[index] - baseState[index])) as ConservedState;
  return result.every(Number.isFinite) ? result : rusanovFlux(left, right, axis);
}

export function mirrorState(state: PrimitiveState, axis: "x" | "y") {
  return axis === "x" ? { ...state, u: -state.u } : { ...state, v: -state.v };
}
