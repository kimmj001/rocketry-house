import { ransCellIndex, ringAreaAtCell } from "./geometry";
import { AxisymmetricRansSolver } from "./solver";
import type { CfdFieldName, RansSolverConfig } from "./types";
import { validateAgainstIsentropicTheory } from "../axisymmetric/validation";
import type {
  NozzleCfdCell,
  NozzleCfdField,
  NozzleCfdFieldName,
  NozzleCfdInputs,
  NozzleCfdResult
} from "@/types/cfd";

const G0 = 9.80665;
const R_UNIVERSAL = 8314.462618;

function configFromInputs(inputs: NozzleCfdInputs): Partial<RansSolverConfig> {
  const chamberRadiusM = Math.max(inputs.chamberDiameterMm / 2000, inputs.throatDiameterMm / 2000 * 1.2);
  const resolution = inputs.meshDensity === "research" || inputs.meshDensity === "fine"
    ? "high"
    : inputs.meshDensity === "standard"
      ? "standard"
      : "development";
  return {
    geometry: {
      chamberRadiusM,
      throatRadiusM: inputs.throatDiameterMm / 2000,
      exitRadiusM: inputs.exitDiameterMm / 2000,
      chamberLengthM: Math.max(chamberRadiusM * 2.5, inputs.convergenceLengthMm / 1000),
      convergentLengthM: inputs.convergenceLengthMm / 1000,
      divergentLengthM: inputs.divergenceLengthMm / 1000
    },
    resolution,
    chamberPressurePa: inputs.chamberPressurePa,
    chamberTemperatureK: inputs.chamberTemperatureK,
    ambientPressurePa: inputs.ambientPressurePa,
    gamma: inputs.gamma,
    gasConstant: R_UNIVERSAL / Math.max(inputs.molecularWeightKgPerKmol, 1),
    thermoModel: inputs.thermoModel ?? "hydroloxFrozen",
    turbulence: inputs.turbulence ?? "spalartAllmaras",
    reconstruction: inputs.reconstruction ?? "musclVenkatakrishnan",
    cfl: inputs.cfl ?? 0.05,
    cflRamp: inputs.cflRamp ?? true,
    turbulentPrandtl: inputs.turbulentPrandtl ?? 0.9,
    nx: inputs.meshDensity === "coarse" ? 68 : undefined,
    nr: inputs.meshDensity === "coarse" ? 28 : undefined
  };
}

function fieldStats(cells: NozzleCfdCell[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    if (!Number.isFinite(cell.value)) continue;
    min = Math.min(min, cell.value);
    max = Math.max(max, cell.value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (Math.abs(max - min) < 1e-12) return { min, max: min + 1 };
  return { min, max };
}

function makeField(
  name: NozzleCfdFieldName,
  label: string,
  unit: string,
  values: Float32Array,
  solver: AxisymmetricRansSolver,
  scale = 1
): NozzleCfdField {
  const cells: NozzleCfdCell[] = [];
  const { mesh } = solver;
  for (let i = 0; i < mesh.nx; i += 1) {
    const wall = mesh.wallCenters[i];
    for (let j = 0; j < mesh.nr; j += 1) {
      const index = ransCellIndex(i, j, mesh);
      cells.push({
        x: mesh.cellX[index] / mesh.lengthM,
        y: mesh.cellR[index] / mesh.maxRadiusM,
        physicalY: mesh.cellR[index] / mesh.maxRadiusM,
        wallY: mesh.cellR[index] / wall,
        inNozzle: true,
        value: values[index] * scale
      });
    }
  }
  return { name, label, unit, cells, ...fieldStats(cells) };
}

function expansionState(exitPressurePa: number, ambientPressurePa: number) {
  const ratio = exitPressurePa / Math.max(ambientPressurePa, 1);
  if (ratio > 1.12) return "underexpanded" as const;
  if (ratio < 0.88) return "overexpanded" as const;
  return "optimal" as const;
}

export function solveRansNozzleCfd(inputs: NozzleCfdInputs): NozzleCfdResult {
  const solver = new AxisymmetricRansSolver(configFromInputs(inputs));
  const iterations = inputs.meshDensity === "research"
    ? 320
    : inputs.meshDensity === "fine"
      ? 240
      : inputs.meshDensity === "standard"
        ? 180
        : 120;
  const startedAt = performance.now();
  const snapshot = solver.step(iterations);
  const runtimeMs = performance.now() - startedAt;
  const primitive = solver.getPrimitive();
  const residualHistory = solver.getResidualHistory();
  const diagnostics = snapshot.diagnostics;
  const { mesh } = solver;
  const fieldDefinitions: Array<[NozzleCfdFieldName, CfdFieldName, string, string, number]> = [
    ["mach", "mach", "Mach number", "", 1],
    ["pressure", "pressure", "Static pressure", "kPa", 1 / 1000],
    ["temperature", "temperature", "Static temperature", "K", 1],
    ["density", "density", "Density", "kg/m3", 1],
    ["velocity", "velocity", "Velocity magnitude", "m/s", 1],
    ["axialVelocity", "axialVelocity", "Axial velocity", "m/s", 1],
    ["turbulentViscosityRatio", "turbulentViscosityRatio", "Turbulent viscosity ratio", "mu_t/mu", 1],
    ["residualMagnitude", "residual", "Update magnitude", "", 1]
  ];
  const fields = fieldDefinitions.map(([name, source, label, unit, scale]) =>
    makeField(name, label, unit, snapshot.fields[source], solver, scale)
  );

  const centerline = Array.from({ length: mesh.nx }, (_, i) => {
    const index = ransCellIndex(i, 0, mesh);
    return {
      x: Number((mesh.xCenters[i] / mesh.lengthM).toFixed(5)),
      mach: Number(primitive.mach[index].toFixed(5)),
      pressurePa: Number(primitive.p[index].toFixed(2)),
      temperatureK: Number(primitive.temperature[index].toFixed(3)),
      densityKgM3: Number(primitive.rho[index].toFixed(7)),
      velocityMS: Number(Math.hypot(primitive.u[index], primitive.v[index]).toFixed(3))
    };
  });

  const exitI = mesh.nx - 1;
  let massFlowKgS = 0;
  let thrustN = 0;
  let exitPressureWeighted = 0;
  let exitTemperatureWeighted = 0;
  let exitMachWeighted = 0;
  for (let j = 0; j < mesh.nr; j += 1) {
    const index = ransCellIndex(exitI, j, mesh);
    const area = ringAreaAtCell(mesh, exitI, j);
    const mass = Math.max(primitive.rho[index] * primitive.u[index], 0) * area;
    massFlowKgS += mass;
    thrustN += mass * primitive.u[index] + (primitive.p[index] - inputs.ambientPressurePa) * area;
    exitPressureWeighted += primitive.p[index] * area;
    exitTemperatureWeighted += primitive.temperature[index] * mass;
    exitMachWeighted += primitive.mach[index] * mass;
  }
  const exitArea = Math.PI * solver.config.geometry.exitRadiusM ** 2;
  const throatArea = Math.PI * solver.config.geometry.throatRadiusM ** 2;
  const exitPressurePa = exitPressureWeighted / exitArea;
  const exitTemperatureK = exitTemperatureWeighted / Math.max(massFlowKgS, 1e-12);
  const exitMach = exitMachWeighted / Math.max(massFlowKgS, 1e-12);
  const thrustCoefficient = thrustN / Math.max(inputs.chamberPressurePa * throatArea, 1e-12);
  const characteristicVelocityMS = inputs.chamberPressurePa * throatArea / Math.max(massFlowKgS, 1e-12);
  const specificImpulseS = thrustN / Math.max(massFlowKgS * G0, 1e-12);

  const result: NozzleCfdResult = {
    id: `rans-${Date.now()}`,
    status: diagnostics.failed ? "failed" : diagnostics.converged ? "converged" : "running",
    solver: "Rocketry House axisymmetric RANS CFD",
    mesh: {
      nx: mesh.nx,
      ny: mesh.nr,
      cells: mesh.cells,
      throatRefinementRatio: 1,
      nozzleExitX: 1,
      domainLengthRatio: 1
    },
    solverAudit: {
      cells: mesh.cells,
      iterations: diagnostics.iteration,
      finalCfl: diagnostics.cfl,
      finalResiduals: {
        continuity: diagnostics.residual.continuity,
        xMomentum: diagnostics.residual.axialMomentum,
        yMomentum: diagnostics.residual.radialMomentum,
        energy: diagnostics.residual.energy,
        turbulence: diagnostics.residual.turbulence
      },
      numericalSteps: {
        computePrimitive: true,
        physicalFluxX: true,
        physicalFluxY: true,
        computeFaceFluxes: true,
        hllcFlux: true,
        rusanovFlux: true,
        computeCflDt: true,
        applyBoundaryConditions: true,
        updateConservativeStateByFluxDivergence: true,
        computeResiduals: true,
        weightedLeastSquaresGradients: true,
        musclVenkatakrishnan: solver.config.reconstruction === "musclVenkatakrishnan",
        viscousFlux: true,
        spalartAllmaras: solver.config.turbulence === "spalartAllmaras"
      },
      runtimeMs,
      physicalTimeS: diagnostics.pseudoTimeS,
      flowThroughTimes: diagnostics.pseudoTimeS /
        Math.max(mesh.lengthM / Math.max(diagnostics.maxVelocityMS, 1), 1e-12),
      maximumCfl: diagnostics.cfl,
      minimumDensityKgM3: diagnostics.minDensityKgM3,
      minimumPressurePa: diagnostics.minPressurePa,
      minimumTemperatureK: diagnostics.minTemperatureK,
      maximumMach: diagnostics.maxMach,
      maximumTurbulentViscosityRatio: diagnostics.maxTurbulentViscosityRatio,
      limitedFaces: diagnostics.limitedFaces,
      hllcFallbacks: diagnostics.hllcFallbacks,
      firstOrderFallbacks: diagnostics.firstOrderFallbacks,
      positivityCorrections: diagnostics.positivityCorrections,
      rejectedSteps: diagnostics.rejectedSteps,
      nanCount: diagnostics.nanCount,
      floorApplications: diagnostics.floorApplications,
      massFlowStations: diagnostics.massFlow,
      conservationError: diagnostics.residual.continuity,
      positivityAbort: diagnostics.failed,
      nanDetected: diagnostics.nanCount > 0,
      skippedSteps: []
    },
    residuals: residualHistory
      .filter((_, index) => index === 0 || index % 5 === 0 || index === residualHistory.length - 1)
      .map((point) => ({
        iteration: point.iteration,
        continuity: point.continuity,
        momentum: point.axialMomentum,
        yMomentum: point.radialMomentum,
        energy: point.energy,
        turbulence: point.turbulence
      })),
    fields,
    transientFrames: [{
      iteration: diagnostics.iteration,
      physicalTimeS: diagnostics.pseudoTimeS,
      fields: Object.fromEntries(fieldDefinitions.map(([name, source, , , scale]) => [
        name,
        Array.from(snapshot.fields[source], (value) => value * scale)
      ]))
    }],
    centerline,
    shocks: centerline.flatMap((point, index) => {
      if (index < 2 || index > centerline.length - 3) return [];
      const left = centerline[index - 2];
      const right = centerline[index + 2];
      if (left.mach > 1.1 && right.mach < left.mach - 0.2 && right.pressurePa > left.pressurePa * 1.12) {
        return [{ x: point.x, strength: Math.min(1, left.mach - right.mach), note: "computed pressure/Mach discontinuity" }];
      }
      return [];
    }).slice(0, 4),
    metrics: {
      exitMach,
      exitPressurePa,
      exitTemperatureK,
      massFlowKgS,
      thrustCoefficient,
      specificImpulseS,
      characteristicVelocityMS,
      areaRatio: exitArea / throatArea,
      expansionState: expansionState(exitPressurePa, inputs.ambientPressurePa)
    },
    createdAt: new Date().toISOString()
  };
  return {
    ...result,
    validation: validateAgainstIsentropicTheory(inputs, result)
  };
}
