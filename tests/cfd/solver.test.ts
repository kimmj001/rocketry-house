import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import {
  radialFaceRadius,
  resolutionDimensions,
  throatX,
  wallRadiusAt
} from "../../lib/cfd/rans/geometry";
import { savedNozzleToGeometry } from "../../lib/nozzle-library";
import { AxisymmetricRansSolver } from "../../lib/cfd/rans/solver";
import {
  DEFAULT_RANS_CONFIG,
  INTERACTIVE_RANS_DIMENSIONS,
  type ResolutionPreset
} from "../../lib/cfd/rans/types";

test("saved nozzle dimensions become the exact conical CFD wall profile", () => {
  const geometry = savedNozzleToGeometry({
    id: "nozzle-test",
    name: "Test nozzle",
    sourceMotorName: "Test motor",
    chamberDiameterMm: 48,
    throatDiameterMm: 8,
    exitDiameterMm: 31,
    chamberLengthMm: 82,
    convergenceLengthMm: 11.5,
    divergenceLengthMm: 25.8,
    convergenceAngleDeg: 60,
    divergenceAngleDeg: 24,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z"
  }, DEFAULT_RANS_CONFIG.geometry);

  assert.equal(geometry.chamberRadiusM, 0.024);
  assert.equal(geometry.throatRadiusM, 0.004);
  assert.equal(geometry.exitRadiusM, 0.0155);
  assert.equal(geometry.chamberLengthM, 0.082);
  assert.equal(geometry.convergentLengthM, 0.0115);
  assert.equal(geometry.divergentLengthM, 0.0258);

  const throat = throatX(geometry);
  const convergenceMidpoint = geometry.chamberLengthM + geometry.convergentLengthM / 2;
  const divergenceMidpoint = throat + geometry.divergentLengthM / 2;
  assert.ok(Math.abs(wallRadiusAt(convergenceMidpoint, geometry) - 0.014) < 1e-12);
  assert.ok(Math.abs(wallRadiusAt(throat, geometry) - 0.004) < 1e-12);
  assert.ok(Math.abs(wallRadiusAt(divergenceMidpoint, geometry) - 0.00975) < 1e-12);
});

test("interactive resolution presets use one quarter of the production cell count", () => {
  const presets: ResolutionPreset[] = ["development", "standard", "high"];
  for (const preset of presets) {
    const production = resolutionDimensions(preset);
    const interactive = INTERACTIVE_RANS_DIMENSIONS[preset];
    const productionCells = (production.nozzleNx + production.externalNx) * production.nr;
    assert.equal(interactive.nx * interactive.nr, productionCells / 4);
  }
});

test("low-resolution nozzle remains finite and accelerates downstream", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 36,
    nr: 14,
    resolution: "development",
    initializationMode: "quasiSteady",
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
  const downstreamMach = snapshot.fields.mach[Math.min(solver.mesh.nozzleExitIndex, throatI + 8) * nr];
  assert.ok(downstreamMach > chamberMach, `${downstreamMach} should exceed ${chamberMach}`);
  assert.ok(downstreamMach > 1);
});

test("SSP-RK2 is the default and performs a distinct two-stage conservative update", () => {
  assert.equal(DEFAULT_RANS_CONFIG.timeIntegrator, "sspRk2");
  const shared = {
    ...DEFAULT_RANS_CONFIG,
    nx: 30,
    nr: 10,
    resolution: "development" as const,
    initializationMode: "coldStart" as const,
    turbulence: "laminar" as const,
    reconstruction: "firstOrder" as const,
    fixedTimeStepS: 1e-8,
    cflRamp: false
  };
  const rk2 = new AxisymmetricRansSolver({ ...shared, timeIntegrator: "sspRk2" });
  const euler = new AxisymmetricRansSolver({ ...shared, timeIntegrator: "forwardEuler" });
  const rk2Snapshot = rk2.step(1);
  const eulerSnapshot = euler.step(1);
  const pressureDifference = rk2Snapshot.fields.pressure.reduce(
    (sum, value, index) => sum + Math.abs(value - eulerSnapshot.fields.pressure[index]),
    0
  );

  assert.equal(rk2Snapshot.diagnostics.timeIntegrator, "sspRk2");
  assert.equal(rk2Snapshot.diagnostics.failed, false, rk2Snapshot.diagnostics.failureReason);
  assert.equal(rk2Snapshot.diagnostics.nanCount, 0);
  assert.ok(rk2Snapshot.diagnostics.minDensityKgM3 > 0);
  assert.ok(rk2Snapshot.diagnostics.minPressurePa > 0);
  assert.ok(pressureDifference > 1e-6, "RK2 must recompute and apply the second-stage flux");
});

test("default mesh includes a long, finite external plume domain at one atmosphere", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    turbulence: "laminar",
    reconstruction: "firstOrder",
    cfl: 0.01,
    cflRamp: false
  });
  const snapshot = solver.createSnapshot();
  assert.equal(solver.config.ambientPressurePa, 101325);
  assert.equal(solver.config.initializationMode, "coldStart");
  assert.ok(snapshot.mesh.lengthM / snapshot.mesh.nozzleLengthM > 6);
  assert.ok(snapshot.mesh.nozzleExitIndex < snapshot.mesh.nx - 2);
  assert.ok(snapshot.mesh.nozzleExitIndex + 1 < snapshot.mesh.nx * 0.45);
  assert.ok(snapshot.mesh.wallFaces.at(-1)! > solver.config.geometry.exitRadiusM * 3);
  assert.ok(
    snapshot.mesh.wallFaces[snapshot.mesh.nozzleExitIndex + 2] >
      solver.config.geometry.exitRadiusM * 1.2
  );
  const externalIndex = (snapshot.mesh.nozzleExitIndex + 4) * snapshot.mesh.nr;
  assert.ok(Number.isFinite(snapshot.fields.mach[externalIndex]));
  assert.equal(snapshot.fields.velocity[externalIndex], 0);
  assert.ok(snapshot.fields.velocity.every((value) => value === 0));
  assert.ok(snapshot.fields.pressure.every((value) => Math.abs(value - 101325) < 1));
});

test("external mesh provides an ambient annulus immediately around the initialized jet", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    initializationMode: "quasiSteady",
    turbulence: "laminar",
    reconstruction: "firstOrder"
  });
  const snapshot = solver.createSnapshot();
  const i = Math.min(snapshot.mesh.nx - 1, snapshot.mesh.nozzleExitIndex + 4);
  const innerIndex = i * snapshot.mesh.nr;
  const outerIndex = innerIndex + snapshot.mesh.nr - 1;

  assert.ok(snapshot.fields.mach[innerIndex] > 1);
  assert.ok(snapshot.fields.mach[outerIndex] < snapshot.fields.mach[innerIndex] * 0.1);
  assert.ok(
    Math.abs(snapshot.fields.pressure[outerIndex] - solver.config.ambientPressurePa) <
      solver.config.ambientPressurePa * 0.02
  );
});

test("nozzle exit interface conservatively partitions plume and ambient annular area", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 18,
    turbulence: "laminar"
  });
  const { mesh } = solver;
  const leftI = mesh.nozzleExitIndex;
  const rightI = leftI + 1;
  const exitRadius = solver.config.geometry.exitRadiusM;
  const farfieldRadius = solver.config.geometry.farfieldRadiusM;
  const internalArea = Math.PI * radialFaceRadius(mesh, leftI, "right", mesh.nr) ** 2;
  const externalArea = Math.PI * radialFaceRadius(mesh, rightI, "left", mesh.nr) ** 2;
  assert.ok(Math.abs(internalArea - Math.PI * exitRadius ** 2) < 1e-12);
  assert.ok(Math.abs(externalArea - Math.PI * farfieldRadius ** 2) < 1e-12);
  assert.ok(externalArea > internalArea * 20);
});

test("uniform quiescent flow is preserved to machine precision", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    thermoModel: "constantGas",
    gamma: 1.4,
    gasConstant: 287,
    chamberPressurePa: 101325,
    chamberTemperatureK: 288.15,
    ambientPressurePa: 101325,
    turbulence: "laminar",
    reconstruction: "musclVenkatakrishnan"
  });
  const snapshot = solver.step(100);
  const primitive = solver.getPrimitive();
  assert.ok(snapshot.diagnostics.maxVelocityMS < 1e-9);
  assert.ok(
    Math.max(...primitive.p) - Math.min(...primitive.p) < 1e-8,
    "uniform pressure changed under the discrete geometric source"
  );
  assert.ok(snapshot.diagnostics.residual.continuity < 1e-10);
  assert.ok(snapshot.diagnostics.residual.radialMomentum < 1e-10);
});

test("cold start applies chamber pressure at the inlet before it reaches the nozzle", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    turbulence: "laminar",
    reconstruction: "firstOrder",
    cfl: 0.05,
    cflRamp: false
  });
  const initial = solver.createSnapshot();
  assert.ok(initial.fields.velocity.every((value) => value === 0));

  const firstStep = solver.step(1);
  const nr = firstStep.mesh.nr;
  const inletPressure = firstStep.fields.pressure[0];
  const throatPressure = firstStep.fields.pressure[solver.mesh.throatIndex * nr];
  const exitPressure = firstStep.fields.pressure[solver.mesh.nozzleExitIndex * nr];
  assert.ok(inletPressure > DEFAULT_RANS_CONFIG.ambientPressurePa * 1.05);
  assert.ok(Math.abs(throatPressure - DEFAULT_RANS_CONFIG.ambientPressurePa) < 100);
  assert.ok(Math.abs(exitPressure - DEFAULT_RANS_CONFIG.ambientPressurePa) < 1);
  assert.equal(firstStep.diagnostics.failed, false, firstStep.diagnostics.failureReason);
});

test("SA roundoff limiting remains separate from conservative positivity recovery", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14
  });
  const snapshot = solver.step(200);
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.equal(snapshot.diagnostics.positivityCorrections, 0);
  assert.equal(snapshot.diagnostics.turbulenceClips, 0);
  assert.equal(snapshot.diagnostics.rejectedSteps, 0);
  assert.ok(snapshot.diagnostics.cfl >= 0.01, `CFL collapsed to ${snapshot.diagnostics.cfl}`);
  assert.ok(snapshot.diagnostics.cfl <= 0.12, `CFL exceeded the MUSCL stability cap: ${snapshot.diagnostics.cfl}`);
});

test("cold-start shock crosses the former stall point without collapsing the timestep", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14
  });
  const snapshot = solver.step(3000);
  let frontColumn = 0;
  for (let i = 0; i < snapshot.mesh.nx; i += 1) {
    for (let j = 0; j < snapshot.mesh.nr; j += 1) {
      const index = i * snapshot.mesh.nr + j;
      if (
        snapshot.fields.pressure[index] > DEFAULT_RANS_CONFIG.ambientPressurePa * 1.03 ||
        Math.abs(snapshot.fields.axialVelocity[index]) > 10
      ) {
        frontColumn = i;
      }
    }
  }
  const frontX = 0.5 * (
    snapshot.mesh.xFaces[frontColumn] + snapshot.mesh.xFaces[frontColumn + 1]
  );
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.equal(snapshot.diagnostics.rejectedSteps, 0);
  assert.equal(snapshot.diagnostics.positivityCorrections, 0);
  assert.equal(snapshot.diagnostics.turbulenceClips, 0);
  assert.ok(
    frontX > solver.mesh.nozzleLengthM + 0.05,
    `pressure front stalled at x=${frontX.toFixed(3)} m`
  );
  assert.ok(
    snapshot.diagnostics.minDensityKgM3 > 1e-3,
    `front density collapsed to ${snapshot.diagnostics.minDensityKgM3}`
  );
  assert.ok(
    snapshot.diagnostics.dtS > 5e-9,
    `shock or SA source collapsed the timestep to ${snapshot.diagnostics.dtS}`
  );
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

test("long external-plume run survives an aggressive CFL and near-vacuum farfield", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    initializationMode: "quasiSteady",
    ambientPressurePa: 1013.25,
    cfl: 0.5,
    cflRamp: false
  });
  const snapshot = solver.step(300);
  assert.equal(snapshot.diagnostics.iteration, 300);
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.equal(snapshot.diagnostics.nanCount, 0);
  assert.ok(snapshot.diagnostics.minDensityKgM3 > 0);
  assert.ok(snapshot.diagnostics.minPressurePa > 0);
  assert.ok(snapshot.fields.mach.every(Number.isFinite));
});

test("positivity recovery limits an oversized timestep instead of failing the run", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 48,
    nr: 14,
    initializationMode: "quasiSteady",
    fixedTimeStepS: 1e-5
  });
  const snapshot = solver.step(3);
  assert.equal(snapshot.diagnostics.failed, false, snapshot.diagnostics.failureReason);
  assert.ok(snapshot.diagnostics.positivityCorrections > 0);
  assert.ok(snapshot.diagnostics.minDensityKgM3 > 0);
  assert.ok(snapshot.diagnostics.minPressurePa > 0);
  assert.ok(snapshot.diagnostics.minTemperatureK > 0);
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

test("first-order mode does not report deliberate first-order faces as MUSCL fallbacks", () => {
  const solver = new AxisymmetricRansSolver({
    ...DEFAULT_RANS_CONFIG,
    nx: 36,
    nr: 14,
    initializationMode: "quasiSteady",
    reconstruction: "firstOrder",
    turbulence: "laminar",
    cflRamp: false
  });
  const diagnostics = solver.step(4).diagnostics;
  assert.equal(diagnostics.firstOrderFallbacks, 0);
  assert.ok(diagnostics.massFlow.every((station) => Number.isFinite(station.massFlowKgS)));
});
