import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { AxisymmetricRansSolver } from "../../lib/cfd/rans/solver";
import { DEFAULT_RANS_CONFIG } from "../../lib/cfd/rans/types";

test("low-resolution nozzle remains finite and accelerates downstream", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 36,
    nr: 14,
    resolution: "development",
    turbulence: "laminar",
    reconstruction: "firstOrder",
    cfl: 0.02,
    cflRamp: false
  });
  const snapshot = solver.step(8);
  const diagnostics = snapshot.diagnostics;
  assert.equal(diagnostics.failed, false, diagnostics.failureReason);
  assert.equal(diagnostics.nanCount, 0);
  assert.ok(diagnostics.minDensityKgM3 > 0);
  assert.ok(diagnostics.minPressurePa > 0);
  assert.ok(diagnostics.minTemperatureK > 0);
  assert.ok(snapshot.fields.mach.every(Number.isFinite));

  const nr = snapshot.mesh.nr;
  const throatI = solver.mesh.throatIndex;
  const chamberMach = snapshot.fields.mach[Math.max(1, throatI - 8) * nr];
  const downstreamMach = snapshot.fields.mach[Math.min(snapshot.mesh.nx - 2, throatI + 8) * nr];
  assert.ok(downstreamMach > chamberMach, `${downstreamMach} should exceed ${chamberMach}`);
  assert.ok(downstreamMach > 1);
});

test("axisymmetric SA step has positive wall distance and no axis singularity", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 30,
    nr: 12,
    resolution: "development",
    turbulence: "spalartAllmaras",
    reconstruction: "musclVenkatakrishnan",
    cfl: 0.01,
    cflRamp: false
  });
  assert.ok(Array.from(solver.mesh.wallDistance).every((distance) => Number.isFinite(distance) && distance > 0));
  const snapshot = solver.step(3);
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.ok(Object.values(snapshot.fields).every((field) => field.every(Number.isFinite)));
  assert.equal(snapshot.diagnostics.nanCount, 0);
});

test("development iteration stays within the interactive performance envelope", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 18,
    resolution: "development",
    cfl: 0.01,
    cflRamp: false
  });
  const startedAt = performance.now();
  const snapshot = solver.step(1);
  const elapsedMs = performance.now() - startedAt;
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.ok(elapsedMs < 5000, `one 864-cell iteration took ${elapsedMs.toFixed(1)} ms`);
});
