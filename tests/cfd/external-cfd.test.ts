import assert from "node:assert/strict";
import test from "node:test";
import { buildRocketGrid, rocketExtents } from "../../lib/cfd/external/geometry";
import { hllcFlux, minmod, type PrimitiveState } from "../../lib/cfd/external/numerics";
import { solveLbmExternalFlow } from "../../lib/cfd/external/lbm-solver";
import { solveCompressibleExternalFlow } from "../../lib/cfd/external/compressible-solver";
import { createExternalCfdCacheKey, normalizeExternalCfdInput } from "../../lib/cfd/external/service";
import type { RocketComponent } from "../../lib/types";
import type { NormalizedExternalCfdInput, SolverGrid } from "../../lib/cfd/external/types";

const rocket: RocketComponent[] = [
  { id: "nose", type: "nose_cone", name: "Ogive", noseShape: "Ogive", length: 240, diameter: 100, position: 0, wallThickness: 2, material: "G10", mass: 200 },
  { id: "body", type: "body_tube", name: "Airframe", length: 760, diameter: 100, position: 240, wallThickness: 2, material: "G10", mass: 800 },
  { id: "tail", type: "transition", name: "Boat tail", length: 100, diameter: 100, foreDiameter: 100, aftDiameter: 60, position: 1000, wallThickness: 2, material: "G10", mass: 90 },
  { id: "fins", type: "fins", name: "Fins", length: 210, diameter: 100, position: 790, wallThickness: 4, material: "G10", mass: 260, finRootChord: 210, finTipChord: 90, finSpan: 130, finSweep: 70, finCount: 4 }
];

function customGrid(width: number, height: number, mask = new Uint8Array(width * height)): SolverGrid {
  return { width, height, mask, xMinM: -0.5, xMaxM: 2.5, yMinM: -0.6, yMaxM: 0.6, dxM: 3 / (width - 1), dyM: 1.2 / (height - 1), rocketLengthM: 1 };
}

function input(patch: Partial<NormalizedExternalCfdInput> = {}): NormalizedExternalCfdInput {
  return { rocket: { components: rocket }, mach: 0.2, angleOfAttack: 0, solver: "fast", requestedSolver: "auto", resolution: "low", visualization: "mach", ...patch };
}

test("RocketryHouse geometry includes nose, body, boat tail, and fin span", () => {
  const extents = rocketExtents(rocket);
  assert.equal(extents.lengthMm, 1100);
  assert.ok(extents.maxRadiusMm >= 180);
  const grid = buildRocketGrid(rocket, "low");
  const mid = Math.floor(grid.height / 2);
  assert.ok(grid.mask.reduce((sum, value) => sum + value, 0) > 100);
  assert.ok(grid.mask[mid * grid.width + Math.round(grid.width * 0.16)] === 1);
});

test("normalization selects the physically valid solver and hashes deterministically", () => {
  const normalized = normalizeExternalCfdInput({ rocket: { components: rocket }, mach: 1.8, angleOfAttack: 4, solver: "fast", resolution: "low" });
  assert.equal(normalized.solver, "compressible");
  assert.equal(createExternalCfdCacheKey(normalized), createExternalCfdCacheKey(normalized));
});

test("minmod and HLLC preserve smooth uniform flow", () => {
  assert.equal(minmod(2, 3), 2);
  assert.equal(minmod(-2, -1), -1);
  assert.equal(minmod(-2, 1), 0);
  const state: PrimitiveState = { rho: 1, u: 0.8, v: 0.1, p: 1 / 1.4 };
  const flux = hllcFlux(state, state, "x");
  const energy = state.p / 0.4 + 0.5 * state.rho * (state.u ** 2 + state.v ** 2);
  const expected = [state.rho * state.u, state.rho * state.u ** 2 + state.p, state.rho * state.u * state.v, (energy + state.p) * state.u];
  flux.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-10));
});

test("D2Q9 keeps an empty-domain freestream nearly uniform", async () => {
  const grid = customGrid(64, 28);
  const result = await solveLbmExternalFlow(input(), grid);
  let maxDeviation = 0;
  for (let i = 0; i < result.mach.length; i += 1) maxDeviation = Math.max(maxDeviation, Math.abs(result.mach[i] - 0.2));
  assert.ok(maxDeviation < 0.01, `uniform-flow deviation ${maxDeviation}`);
});

test("D2Q9 produces a wake behind a circular body", async () => {
  const grid = customGrid(80, 34);
  const cx = 26;
  const cy = 17;
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 < 20) grid.mask[y * grid.width + x] = 1;
  const result = await solveLbmExternalFlow(input(), grid);
  const upstream = result.velocity[cy * grid.width + 8];
  const wake = result.velocity[cy * grid.width + cx + 8];
  assert.ok(wake < upstream * 0.9, `wake ${wake}, upstream ${upstream}`);
});

test("saved rocket flow is symmetric at zero AoA and becomes asymmetric at positive AoA", async () => {
  const grid = buildRocketGrid(rocket, "low");
  const zero = await solveLbmExternalFlow(input(), grid);
  const angled = await solveLbmExternalFlow(input({ angleOfAttack: 10 }), grid);
  let zeroDifference = 0;
  let angledDifference = 0;
  let baseline = 0;
  let samples = 0;
  for (let y = 5; y < Math.floor(grid.height / 2); y += 2) {
    const mirrorY = grid.height - 1 - y;
    for (let x = Math.floor(grid.width * 0.12); x < Math.floor(grid.width * 0.58); x += 3) {
      const top = y * grid.width + x;
      const bottom = mirrorY * grid.width + x;
      if (grid.mask[top] || grid.mask[bottom]) continue;
      zeroDifference += Math.abs(zero.velocity[top] - zero.velocity[bottom]);
      angledDifference += Math.abs(angled.velocity[top] - angled.velocity[bottom]);
      baseline += 0.5 * (zero.velocity[top] + zero.velocity[bottom]);
      samples += 1;
    }
  }
  assert.ok(zeroDifference / baseline < 0.04, `zero-AoA asymmetry ${zeroDifference / baseline}`);
  assert.ok(angledDifference / samples > zeroDifference / samples * 2, "positive AoA should produce a stronger top/bottom flow difference");
});

test("compressible HLLC flow creates a solver-derived supersonic pressure response", async () => {
  const grid = customGrid(72, 30);
  for (let x = 25; x < 45; x += 1) {
    const half = Math.max(1, Math.floor((x - 25) * 0.24));
    for (let y = 15 - half; y <= 15 + half; y += 1) grid.mask[y * grid.width + x] = 1;
  }
  const subsonic = await solveCompressibleExternalFlow(input({ solver: "compressible", mach: 0.8 }), grid);
  const result = await solveCompressibleExternalFlow(input({ solver: "compressible", mach: 1.8 }), grid);
  let maxPressure = 0;
  let subsonicMaxPressure = 0;
  let minMach = Number.POSITIVE_INFINITY;
  for (let i = 0; i < result.pressure.length; i += 1) {
    if (grid.mask[i]) continue;
    maxPressure = Math.max(maxPressure, result.pressure[i]);
    subsonicMaxPressure = Math.max(subsonicMaxPressure, subsonic.pressure[i]);
    minMach = Math.min(minMach, result.mach[i]);
  }
  assert.ok(maxPressure > 101_325 * 1.01, `max pressure ${maxPressure}`);
  assert.ok(maxPressure > subsonicMaxPressure, `supersonic pressure ${maxPressure}, subsonic pressure ${subsonicMaxPressure}`);
  assert.ok(minMach < 1.7, `minimum Mach ${minMach}`);
});
