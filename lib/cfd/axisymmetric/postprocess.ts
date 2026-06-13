import { cellIndex, type CfdMesh } from "@/lib/cfd/axisymmetric/mesh";
import { primitiveCell, type SolverResult } from "@/lib/cfd/axisymmetric/solver";
import type { NozzleCfdCell, NozzleCfdField, NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";

const G0 = 9.80665;

function fieldStats(cells: NozzleCfdCell[]) {
  const values = cells.map((cell) => cell.value).filter(Number.isFinite);
  return {
    min: Math.min(...values),
    max: Math.max(...values)
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

function sampleEvery(mesh: CfdMesh) {
  if (mesh.nx > 170) return { x: 3, y: 2 };
  if (mesh.nx > 90) return { x: 2, y: 1 };
  return { x: 1, y: 1 };
}

export function postProcessNozzleSolution(inputs: NozzleCfdInputs, mesh: CfdMesh, solver: SolverResult): NozzleCfdResult {
  const machCells: NozzleCfdCell[] = [];
  const pressureCells: NozzleCfdCell[] = [];
  const temperatureCells: NozzleCfdCell[] = [];
  const densityCells: NozzleCfdCell[] = [];
  const velocityCells: NozzleCfdCell[] = [];
  const totalPressureCells: NozzleCfdCell[] = [];
  const totalTemperatureCells: NozzleCfdCell[] = [];
  const stride = sampleEvery(mesh);
  const gamma = Math.max(1.05, Math.min(1.67, inputs.gamma));

  for (let i = 0; i < mesh.nx; i += stride.x) {
    for (let j = 0; j < mesh.ny; j += stride.y) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const primitive = primitiveCell(index, solver.state, inputs);
      const x = mesh.x[i] / mesh.x[mesh.nx - 1];
      const y = mesh.y[j] / Math.max(mesh.wallRadius[i], mesh.dy);
      if (y > 1.04) continue;
      const vMag = Math.sqrt(primitive.u * primitive.u + primitive.v * primitive.v);
      const totalFactor = 1 + ((gamma - 1) / 2) * primitive.mach * primitive.mach;
      machCells.push({ x, y: y * 0.46, value: primitive.mach });
      pressureCells.push({ x, y: y * 0.46, value: primitive.p / 1000 });
      temperatureCells.push({ x, y: y * 0.46, value: primitive.t });
      densityCells.push({ x, y: y * 0.46, value: primitive.rho });
      velocityCells.push({ x, y: y * 0.46, value: vMag });
      totalPressureCells.push({ x, y: y * 0.46, value: primitive.p * Math.pow(totalFactor, gamma / (gamma - 1)) / 1000 });
      totalTemperatureCells.push({ x, y: y * 0.46, value: primitive.t * totalFactor });
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

  const exitColumn = mesh.nx - 1;
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
  const exit = centerline.at(-1) ?? centerline[0];

  return {
    id: `fv-cfd-${Date.now()}`,
    status: solver.converged ? "converged" : "failed",
    solver: "Rocketry House 2D axisymmetric finite-volume CFD",
    mesh: {
      cells: mesh.cells,
      throatRefinementRatio: mesh.refinementRatio,
      yPlusEstimate: inputs.meshDensity === "research" ? 1.8 : inputs.meshDensity === "fine" ? 3.2 : inputs.meshDensity === "standard" ? 7.4 : 18.5
    },
    residuals: solver.residuals,
    fields: [
      makeField("mach", "Mach number", "M", machCells),
      makeField("pressure", "Static pressure", "kPa", pressureCells),
      makeField("temperature", "Static temperature", "K", temperatureCells),
      makeField("density", "Density", "kg/m3", densityCells),
      makeField("velocity", "Velocity magnitude", "m/s", velocityCells),
      makeField("totalPressure", "Total pressure", "kPa", totalPressureCells),
      makeField("totalTemperature", "Total temperature", "K", totalTemperatureCells)
    ],
    centerline,
    shocks: detectShockRegions(centerline),
    metrics: {
      exitMach: Number((exitMassWeightedMach / Math.max(mdot, 1e-9)).toFixed(3)),
      exitPressurePa: exit.pressurePa,
      exitTemperatureK: Number((exitTempWeighted / Math.max(mdot, 1e-9)).toFixed(2)),
      massFlowKgS: Number(mdot.toFixed(5)),
      thrustCoefficient: Number((thrust / Math.max(inputs.chamberPressurePa * throatArea, 1e-9)).toFixed(4)),
      specificImpulseS: Number((thrust / Math.max(mdot * G0, 1e-9)).toFixed(2)),
      characteristicVelocityMS: Number((inputs.chamberPressurePa * throatArea / Math.max(mdot, 1e-9)).toFixed(1)),
      areaRatio: Number((exitArea / Math.max(throatArea, 1e-12)).toFixed(3)),
      expansionState: expansionState(exit.pressurePa, inputs.ambientPressurePa)
    },
    createdAt: new Date().toISOString()
  };
}
