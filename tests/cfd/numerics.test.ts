import assert from "node:assert/strict";
import test from "node:test";
import { createBodyFittedMesh } from "../../lib/cfd/rans/geometry";
import {
  conservativeFromPrimitive,
  hllcFlux,
  noSlipAdiabaticWallGhost,
  primitiveFromConservative,
  symmetryAxisGhost,
  weightedLeastSquaresGradient,
  type FacePrimitive
} from "../../lib/cfd/rans/numerics";
import { DEFAULT_RANS_CONFIG } from "../../lib/cfd/rans/types";

const thermo = {
  gamma: 1.4,
  gasConstant: 287,
  viscosity: 1.8e-5,
  conductivity: 0.026,
  prandtl: 0.72,
  cp: 1004.5
};

const face = (patch: Partial<FacePrimitive> = {}): FacePrimitive => ({
  rho: 1.2,
  u: 320,
  v: 12,
  p: 101325,
  temperature: 294.2,
  nuTilde: 0,
  thermo,
  ...patch
});

test("conservative and primitive conversion round-trips a physical state", () => {
  const original = face();
  const conserved = conservativeFromPrimitive(original);
  const decoded = primitiveFromConservative(conserved, thermo, DEFAULT_RANS_CONFIG);
  assert.ok(Math.abs(decoded.rho - original.rho) < 1e-12);
  assert.ok(Math.abs(decoded.u - original.u) < 1e-10);
  assert.ok(Math.abs(decoded.v - original.v) < 1e-10);
  assert.ok(Math.abs(decoded.p - original.p) < 1e-7);
  assert.equal(decoded.floorCount, 0);
  assert.ok(Math.abs(decoded.p - decoded.rho * thermo.gasConstant * decoded.temperature) < 1e-6);
  assert.ok(Math.abs(decoded.soundSpeed - Math.sqrt(thermo.gamma * thermo.gasConstant * decoded.temperature)) < 1e-10);
});

test("HLLC equals the physical Euler flux for identical states", () => {
  const state = face();
  const result = hllcFlux(state, state, 1, 0);
  const conserved = conservativeFromPrimitive(state);
  const expected = [
    state.rho * state.u,
    state.rho * state.u * state.u + state.p,
    state.rho * state.u * state.v,
    (conserved[3] + state.p) * state.u
  ];
  result.flux.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < Math.abs(expected[index]) * 1e-10 + 1e-8));
  assert.equal(result.usedFallback, false);
});

test("HLLC keeps contact and Sod shock-tube states finite", () => {
  const contact = hllcFlux(face({ rho: 1, u: 80, v: 0 }), face({ rho: 0.25, u: 80, v: 0 }), 1, 0);
  assert.ok(contact.flux.every(Number.isFinite));
  assert.ok(contact.massFlux > 0);

  const sod = hllcFlux(
    face({ rho: 1, u: 0, v: 0, p: 100000, temperature: 348.43 }),
    face({ rho: 0.125, u: 0, v: 0, p: 10000, temperature: 278.75 }),
    1,
    0
  );
  assert.ok(sod.flux.every(Number.isFinite));
  assert.ok(sod.flux[0] > 0);
  assert.ok(sod.flux[1] > 0);
});

test("weighted least-squares gradients recover a linear field", () => {
  const mesh = createBodyFittedMesh(DEFAULT_RANS_CONFIG.geometry, "development", 28, 14);
  const a = 3.25;
  const b = -1.7;
  const values = Float64Array.from(mesh.cellX, (x, index) => a * x + b * mesh.cellR[index] + 4.2);
  const gradient = weightedLeastSquaresGradient(values, mesh);
  for (let i = 2; i < mesh.nx - 2; i += 1) {
    for (let j = 2; j < mesh.nr - 2; j += 1) {
      const index = i * mesh.nr + j;
      assert.ok(Math.abs(gradient.x[index] - a) < 1e-8);
      assert.ok(Math.abs(gradient.r[index] - b) < 1e-8);
    }
  }
});

test("axis and adiabatic no-slip wall ghost states apply the required reflection", () => {
  const interior = face({ u: 210, v: 35, temperature: 1200, nuTilde: 2e-5 });
  const axis = symmetryAxisGhost(interior);
  assert.equal(axis.u, interior.u);
  assert.equal(axis.v, -interior.v);
  assert.equal(axis.temperature, interior.temperature);

  const wall = noSlipAdiabaticWallGhost(interior);
  assert.equal(wall.u, -interior.u);
  assert.equal(wall.v, -interior.v);
  assert.equal(wall.temperature, interior.temperature);
  assert.equal(wall.nuTilde, 0);
});
