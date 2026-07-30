import { cellIndex, isInside, type CfdMesh } from "@/lib/cfd/axisymmetric/mesh";
import { primitiveCell, type ConservativeState, type SolverResult } from "@/lib/cfd/legacy/inviscid-nozzle-solver";
import type { NozzleCfdCell, NozzleCfdField, NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";

const G0 = 9.80665;

function finiteOr(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function fieldStats(cells: NozzleCfdCell[]) {
  const values = cells.map((cell) => cell.value).filter(Number.isFinite);
  if (!values.length) {
    return { min: 0, max: 1 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const lowIndex = Math.floor((sorted.length - 1) * 0.005);
  const highIndex = Math.ceil((sorted.length - 1) * 0.995);
  const min = sorted[lowIndex] ?? Math.min(...values);
  const max = sorted[highIndex] ?? Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (Math.abs(max - min) < 1e-9) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    return { min: min - pad, max: max + pad };
  }
  return {
    min,
    max
  };
}

function makeField(name: NozzleCfdField["name"], label: string, unit: string, cells: NozzleCfdCell[]): NozzleCfdField {
  const stats = fieldStats(cells);
  return { name, label, unit, min: stats.min, max: stats.max, cells };
}

function expansionState(exitPressurePa: number, ambientPressurePa: number): NozzleCfdResult["metrics"]["expansionState"] {
  const ratio = exitPressurePa / Math.max(ambientPressurePa, 1);
  if (ratio > 1.12) return "underexpanded";
  if (ratio < 0.88) return "overexpanded";
  return "optimal";
}

function detectShockRegions(centerline: NozzleCfdResult["centerline"]) {
  const shocks: NozzleCfdResult["shocks"] = [];
  for (let i = 2; i < centerline.length - 2; i += 1) {
    const leftMach = centerline[i - 2].mach;
    const rightMach = centerline[i + 2].mach;
    const pressureJump = centerline[i + 2].pressurePa / Math.max(centerline[i - 2].pressurePa, 1);
    if (leftMach > 1.15 && rightMach < leftMach - 0.24 && pressureJump > 1.18) {
      shocks.push({
        x: centerline[i].x,
        strength: Math.min(1, (leftMach - rightMach) / 2.4),
        note: "shock-capturing gradient marker from computed pressure and Mach field"
      });
    }
  }
  return shocks.slice(0, 4);
}

function relativeJump(before: number, after: number) {
  return Math.abs(after - before) / Math.max(Math.abs(before), Math.abs(after), 1e-9);
}

function sampleEvery(mesh: CfdMesh) {
  void mesh;
  return { x: 1, y: 1 };
}

function densityGradientAt(i: number, j: number, state: ConservativeState, mesh: CfdMesh, inputs: NozzleCfdInputs) {
  const current = finiteOr(primitiveCell(cellIndex(i, j, mesh), state, inputs).rho);
  const density = (sampleI: number, sampleJ: number) => isInside(sampleI, sampleJ, mesh)
    ? finiteOr(primitiveCell(cellIndex(sampleI, sampleJ, mesh), state, inputs).rho, current)
    : current;
  const leftI = Math.max(0, i - 1);
  const rightI = Math.min(mesh.nx - 1, i + 1);
  const dx = Math.max(mesh.x[rightI] - mesh.x[leftI], mesh.dx);
  const dy = Math.max((j === 0 || j === mesh.ny - 1 ? 1 : 2) * mesh.dy, mesh.dy);
  const dRhoDx = (density(rightI, j) - density(leftI, j)) / dx;
  const dRhoDy = (density(i, Math.min(mesh.ny - 1, j + 1)) - density(i, Math.max(0, j - 1))) / dy;
  return finiteOr(Math.log1p(Math.hypot(dRhoDx, dRhoDy)));
}

export function postProcessNozzleSolution(inputs: NozzleCfdInputs, mesh: CfdMesh, solver: SolverResult): NozzleCfdResult {
  const machCells: NozzleCfdCell[] = [];
  const pressureCells: NozzleCfdCell[] = [];
  const temperatureCells: NozzleCfdCell[] = [];
  const densityCells: NozzleCfdCell[] = [];
  const velocityCells: NozzleCfdCell[] = [];
  const schlierenCells: NozzleCfdCell[] = [];
  const faceFluxCells: NozzleCfdCell[] = [];
  const totalPressureCells: NozzleCfdCell[] = [];
  const totalTemperatureCells: NozzleCfdCell[] = [];
  const stride = sampleEvery(mesh);
  const gamma = Math.max(1.05, Math.min(1.67, inputs.gamma));

  const transientFrames = solver.frames.map((frame) => {
    const fields: NonNullable<NozzleCfdResult["transientFrames"]>[number]["fields"] = {
      mach: [],
      pressure: [],
      temperature: [],
      density: [],
      velocity: [],
      schlieren: []
    };
    for (let i = 0; i < mesh.nx; i += stride.x) {
      for (let j = 0; j < mesh.ny; j += stride.y) {
        const index = cellIndex(i, j, mesh);
        if (!mesh.inside[index]) continue;
        const primitive = primitiveCell(index, frame.state, inputs);
        fields.mach!.push(Number(finiteOr(primitive.mach).toFixed(5)));
        fields.pressure!.push(Number(finiteOr(primitive.p / 1000).toFixed(3)));
        fields.temperature!.push(Number(finiteOr(primitive.t).toFixed(3)));
        fields.density!.push(Number(finiteOr(primitive.rho).toFixed(6)));
        fields.velocity!.push(Number(finiteOr(Math.hypot(primitive.u, primitive.v)).toFixed(3)));
        fields.schlieren!.push(Number(finiteOr(densityGradientAt(i, j, frame.state, mesh, inputs)).toFixed(5)));
      }
    }
    return {
      iteration: frame.iteration,
      physicalTimeS: Number(frame.physicalTimeS.toExponential(5)),
      fields
    };
  });

  for (let i = 0; i < mesh.nx; i += stride.x) {
    for (let j = 0; j < mesh.ny; j += stride.y) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const primitive = primitiveCell(index, solver.state, inputs);
      const x = mesh.x[i] / mesh.x[mesh.nx - 1];
      const localWall = Math.max(mesh.wallRadius[i], mesh.dy);
      const physicalY = mesh.y[j] / Math.max(mesh.y[mesh.ny - 1], mesh.dy);
      const wallY = mesh.y[j] / localWall;
      const mach = finiteOr(primitive.mach);
      const pressureKpa = finiteOr(primitive.p / 1000);
      const temperature = finiteOr(primitive.t);
      const density = finiteOr(primitive.rho);
      const vMag = finiteOr(Math.sqrt(primitive.u * primitive.u + primitive.v * primitive.v));
      const densityGradient = finiteOr(densityGradientAt(i, j, solver.state, mesh, inputs));
      const totalFactor = finiteOr(1 + ((gamma - 1) / 2) * mach * mach, 1);
      const cellGeometry = {
        x,
        y: physicalY,
        wallY,
        physicalY,
        inNozzle: mesh.x[i] <= mesh.x[mesh.nozzleExitIndex]
      };
      machCells.push({ ...cellGeometry, value: mach });
      pressureCells.push({ ...cellGeometry, value: pressureKpa });
      temperatureCells.push({ ...cellGeometry, value: temperature });
      densityCells.push({ ...cellGeometry, value: density });
      velocityCells.push({ ...cellGeometry, value: vMag });
      schlierenCells.push({ ...cellGeometry, value: densityGradient });
      faceFluxCells.push({ ...cellGeometry, value: finiteOr(density * vMag) });
      totalPressureCells.push({ ...cellGeometry, value: finiteOr(pressureKpa * Math.pow(totalFactor, gamma / (gamma - 1)), pressureKpa) });
      totalTemperatureCells.push({ ...cellGeometry, value: finiteOr(temperature * totalFactor, temperature) });
    }
  }

  const centerline = Array.from({ length: mesh.nx }, (_, i) => {
    const primitive = primitiveCell(cellIndex(i, 0, mesh), solver.state, inputs);
    const vMag = Math.sqrt(primitive.u * primitive.u + primitive.v * primitive.v);
    return {
      x: Number((mesh.x[i] / mesh.x[mesh.nx - 1]).toFixed(4)),
      mach: Number(primitive.mach.toFixed(4)),
      pressurePa: Math.round(primitive.p),
      temperatureK: Number(primitive.t.toFixed(2)),
      densityKgM3: Number(primitive.rho.toFixed(5)),
      velocityMS: Number(vMag.toFixed(2))
    };
  });

  const exitColumn = mesh.nozzleExitIndex;
  let mdot = 0;
  let thrustMomentum = 0;
  let exitPressureArea = 0;
  let exitTempWeighted = 0;
  let exitMassWeightedMach = 0;
  for (let j = 0; j < mesh.ny; j += 1) {
    const index = cellIndex(exitColumn, j, mesh);
    if (!mesh.inside[index]) continue;
    const primitive = primitiveCell(index, solver.state, inputs);
    const ringArea = 2 * Math.PI * Math.max(mesh.y[j], mesh.dy * 0.5) * mesh.dy;
    const massFlux = Math.max(primitive.rho * primitive.u, 0) * ringArea;
    mdot += massFlux;
    thrustMomentum += massFlux * primitive.u;
    exitPressureArea += (primitive.p - inputs.ambientPressurePa) * ringArea;
    exitTempWeighted += primitive.t * massFlux;
    exitMassWeightedMach += primitive.mach * massFlux;
  }

  const thrust = thrustMomentum + exitPressureArea;
  const throatArea = Math.PI * (inputs.throatDiameterMm / 2000) ** 2;
  const exitArea = Math.PI * (inputs.exitDiameterMm / 2000) ** 2;
  const nozzleExit = centerline[mesh.nozzleExitIndex] ?? centerline.at(-1) ?? centerline[0];
  const beforeExit = centerline[Math.max(0, mesh.nozzleExitIndex - 1)] ?? nozzleExit;
  const afterExit = centerline[Math.min(centerline.length - 1, mesh.nozzleExitIndex + 1)] ?? nozzleExit;
  const probeStart = Math.max(0, mesh.nozzleExitIndex - 8);
  const probeEnd = Math.min(centerline.length - 1, mesh.nozzleExitIndex + 12);
  const probe = centerline.slice(probeStart, probeEnd + 1).map((point) => ({
    x: point.x,
    mach: point.mach,
    pressurePa: point.pressurePa,
    temperatureK: point.temperatureK,
    densityKgM3: point.densityKgM3,
    axialVelocityMS: point.velocityMS
  }));
  const finalResidual = solver.residuals.at(-1);
  const skippedSteps = Object.entries(solver.audit)
    .filter(([, called]) => !called)
    .map(([name]) => name);

  return {
    id: `fv-cfd-${Date.now()}`,
    status: solver.converged ? "converged" : "failed",
    solver: "Rocketry House 2D axisymmetric finite-volume CFD",
    mesh: {
      nx: mesh.nx,
      ny: mesh.ny,
      cells: mesh.cells,
      throatRefinementRatio: mesh.refinementRatio,
      yPlusEstimate: inputs.meshDensity === "research" ? 0.9 : inputs.meshDensity === "fine" ? 1.8 : inputs.meshDensity === "standard" ? 3.8 : 9.5,
      nozzleExitX: Number((mesh.x[mesh.nozzleExitIndex] / mesh.x[mesh.nx - 1]).toFixed(4)),
      domainLengthRatio: Number((mesh.x[mesh.nx - 1] / Math.max(mesh.x[mesh.nozzleExitIndex], 1e-9)).toFixed(2))
    },
    solverAudit: {
      cells: mesh.cells,
      iterations: solver.iterations,
      finalCfl: solver.finalCfl,
      finalResiduals: finalResidual ? {
        continuity: finalResidual.continuity,
        xMomentum: finalResidual.momentum,
        yMomentum: finalResidual.yMomentum ?? 0,
        energy: finalResidual.energy
      } : undefined,
      numericalSteps: solver.audit,
      runtimeMs: solver.runtimeMs,
      physicalTimeS: solver.physicalTimeS,
      flowThroughTimes: solver.flowThroughTimes,
      maximumCfl: solver.maximumCfl,
      minimumDensityKgM3: solver.minimumDensityKgM3,
      minimumPressurePa: solver.minimumPressurePa,
      conservationError: solver.conservationError,
      positivityAbort: solver.positivityAbort,
      nanDetected: solver.nanDetected,
      skippedSteps
    },
    residuals: solver.residuals,
    fields: [
      makeField("mach", "Mach number", "M", machCells),
      makeField("pressure", "Static pressure", "kPa", pressureCells),
      makeField("temperature", "Static temperature", "K", temperatureCells),
      makeField("density", "Density", "kg/m3", densityCells),
      makeField("velocity", "Velocity magnitude", "m/s", velocityCells),
      makeField("schlieren", "Schlieren density gradient", "log(1+kg/m4)", schlierenCells),
      makeField("faceFlux", "Face flux magnitude", "kg/(m2 s)", faceFluxCells),
      makeField("totalPressure", "Total pressure", "kPa", totalPressureCells),
      makeField("totalTemperature", "Total temperature", "K", totalTemperatureCells)
    ],
    transientFrames,
    centerline,
    shocks: detectShockRegions(centerline),
    metrics: {
      exitMach: Number((exitMassWeightedMach / Math.max(mdot, 1e-9)).toFixed(3)),
      exitPressurePa: nozzleExit.pressurePa,
      exitTemperatureK: Number((exitTempWeighted / Math.max(mdot, 1e-9)).toFixed(2)),
      massFlowKgS: Number(mdot.toFixed(5)),
      thrustCoefficient: Number((thrust / Math.max(inputs.chamberPressurePa * throatArea, 1e-9)).toFixed(4)),
      specificImpulseS: Number((thrust / Math.max(mdot * G0, 1e-9)).toFixed(2)),
      characteristicVelocityMS: Number((inputs.chamberPressurePa * throatArea / Math.max(mdot, 1e-9)).toFixed(1)),
      areaRatio: Number((exitArea / Math.max(throatArea, 1e-12)).toFixed(3)),
      expansionState: expansionState(nozzleExit.pressurePa, inputs.ambientPressurePa)
    },
    continuityCheck: {
      exitX: Number((mesh.x[mesh.nozzleExitIndex] / mesh.x[mesh.nx - 1]).toFixed(4)),
      probe,
      maxRelativeJump: {
        mach: Number(relativeJump(beforeExit.mach, afterExit.mach).toFixed(4)),
        staticPressure: Number(relativeJump(beforeExit.pressurePa, afterExit.pressurePa).toFixed(4)),
        staticTemperature: Number(relativeJump(beforeExit.temperatureK, afterExit.temperatureK).toFixed(4)),
        density: Number(relativeJump(beforeExit.densityKgM3, afterExit.densityKgM3).toFixed(4)),
        axialVelocity: Number(relativeJump(beforeExit.velocityMS, afterExit.velocityMS).toFixed(4))
      }
    },
    createdAt: new Date().toISOString()
  };
}
