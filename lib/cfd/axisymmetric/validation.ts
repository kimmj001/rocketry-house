import type { NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / mach) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

function solveSupersonicMach(areaRatio: number, gamma: number) {
  let low = 1.0001;
  let high = 8;
  for (let i = 0; i < 70; i += 1) {
    const mid = (low + high) / 2;
    if (areaMach(mid, gamma) > areaRatio) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function directionalTrend<T>(points: T[], selector: (point: T) => number, direction: "increase" | "decrease") {
  if (points.length < 4) return false;
  const values = points.map(selector).filter(Number.isFinite);
  if (values.length < 4) return false;
  const start = values[0];
  const end = values.at(-1)!;
  const range = Math.max(...values) - Math.min(...values);
  const tolerance = Math.max(Math.abs(start), Math.abs(end), range, 1) * 0.015;
  let violations = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (direction === "increase" && delta < -tolerance) violations += 1;
    if (direction === "decrease" && delta > tolerance) violations += 1;
  }
  const netOk = direction === "increase" ? end > start + tolerance : end < start - tolerance;
  return netOk && violations <= Math.max(1, Math.floor(values.length * 0.12));
}

export function validateAgainstIsentropicTheory(inputs: NozzleCfdInputs, result: NozzleCfdResult) {
  const gamma = Math.max(1.05, Math.min(1.67, inputs.gamma));
  const areaRatio = Math.max((inputs.exitDiameterMm / inputs.throatDiameterMm) ** 2, 1.0001);
  const referenceExitMach = solveSupersonicMach(areaRatio, gamma);
  const referenceExitPressure = inputs.chamberPressurePa /
    Math.pow(1 + ((gamma - 1) / 2) * referenceExitMach * referenceExitMach, gamma / (gamma - 1));
  const nozzleLength = inputs.convergenceLengthMm + inputs.divergenceLengthMm;
  const externalLength = Math.max(nozzleLength * 4.5, (inputs.exitDiameterMm / 2) * 16, (inputs.chamberDiameterMm / 2) * 5);
  const totalLength = nozzleLength + externalLength;
  const throatX = inputs.convergenceLengthMm / Math.max(totalLength, 1);
  const exitX = nozzleLength / Math.max(totalLength, 1);
  const throatWindowHalfWidth = Math.max(0.018, (inputs.throatDiameterMm / 2) / Math.max(totalLength, 1) * 3.2);
  const throatCandidates = result.centerline.filter((point) => Math.abs(point.x - throatX) <= throatWindowHalfWidth);
  const throatPoint = (throatCandidates.length ? throatCandidates : result.centerline).reduce((best, point) => {
    const pointScore = Math.abs(point.mach - 1) + Math.abs(point.x - throatX) * 0.35;
    const bestScore = Math.abs(best.mach - 1) + Math.abs(best.x - throatX) * 0.35;
    return pointScore < bestScore ? point : best;
  }, result.centerline[0]);
  const exitPoint = result.centerline.reduce((best, point) =>
    Math.abs(point.x - exitX) < Math.abs(best.x - exitX) ? point : best,
  result.centerline[0]);

  const exitMachErrorPct = Math.abs(exitPoint.mach - referenceExitMach) / Math.max(referenceExitMach, 1e-6) * 100;
  const exitPressureErrorPct = Math.abs(exitPoint.pressurePa - referenceExitPressure) / Math.max(referenceExitPressure, 1) * 100;
  const upstreamNozzle = result.centerline.filter((point) => point.x <= exitX);
  const divergingNozzle = result.centerline.filter((point) => point.x >= throatX && point.x <= exitX);
  const centerlineMachIncreases = upstreamNozzle.length > 3
    ? upstreamNozzle.at(-1)!.mach > upstreamNozzle[0].mach && throatPoint.mach > upstreamNozzle[0].mach
    : false;
  const divergingMachIncreases = directionalTrend(divergingNozzle, (point) => point.mach, "increase");
  const pressureDropsThroughNozzle = directionalTrend(upstreamNozzle, (point) => point.pressurePa, "decrease");
  const densityDropsThroughNozzle = directionalTrend(upstreamNozzle, (point) => point.densityKgM3, "decrease");
  const velocityIncreasesThroughNozzle = directionalTrend(upstreamNozzle, (point) => point.velocityMS, "increase");
  const continuity = result.continuityCheck?.maxRelativeJump;
  const maxExitJump = continuity
    ? Math.max(continuity.mach, continuity.staticPressure, continuity.staticTemperature, continuity.density, continuity.axialVelocity)
    : 1;
  const machField = result.fields.find((field) => field.name === "mach");
  const checkerboardScore = machField && machField.cells.length > 6
    ? machField.cells.slice(1).reduce((sum, cell, index) => sum + Math.abs(cell.value - machField.cells[index].value), 0) / machField.cells.length / Math.max(machField.max - machField.min, 1e-9)
    : 0;
  const finalResiduals = result.solverAudit?.finalResiduals;
  const residualConverged = Boolean(finalResiduals) &&
    finalResiduals!.continuity < 1e-5 &&
    finalResiduals!.xMomentum < 1e-5 &&
    finalResiduals!.yMomentum < 1e-5 &&
    finalResiduals!.energy < 1e-5;
  const throatChoked = throatPoint.mach > 0.95 && throatPoint.mach < 1.05;
  const checkerboardStable = checkerboardScore < 0.18;
  const exitContinuous = maxExitJump < 0.16;
  const exitMachWithin10Pct = exitMachErrorPct <= 10;
  const numericalHealthOk = !result.solverAudit?.nanDetected && !result.solverAudit?.positivityAbort;
  const physicallyValid = throatChoked &&
    centerlineMachIncreases &&
    divergingMachIncreases &&
    pressureDropsThroughNozzle &&
    densityDropsThroughNozzle &&
    velocityIncreasesThroughNozzle &&
    checkerboardStable &&
    exitContinuous &&
    residualConverged &&
    exitMachWithin10Pct &&
    numericalHealthOk;
  const warnings: string[] = [];
  if (!throatChoked) warnings.push("Throat Mach is outside choked-flow tolerance.");
  if (!exitMachWithin10Pct) warnings.push("Solver may not be converged.");
  if (!pressureDropsThroughNozzle) warnings.push("Static pressure does not decrease through the nozzle centerline.");
  if (!velocityIncreasesThroughNozzle) warnings.push("Velocity does not increase through the nozzle centerline.");
  if (!divergingMachIncreases) warnings.push("Mach does not increase through the diverging section.");
  if (!densityDropsThroughNozzle) warnings.push("Density does not decrease through the nozzle centerline.");
  if (!checkerboardStable) warnings.push("Checkerboard-like field oscillation detected.");
  if (!exitContinuous) warnings.push("Nozzle exit continuity jump is too large for a non-shock interface.");
  if (!residualConverged) warnings.push("Residual convergence target was not reached.");
  if (result.solverAudit?.skippedSteps.length) warnings.push(`Numerical audit failed: skipped ${result.solverAudit.skippedSteps.join(", ")}.`);
  if (result.solverAudit?.nanDetected) warnings.push("NaN detected; simulation aborted.");
  if (result.solverAudit?.positivityAbort) warnings.push("Non-positive density or pressure detected; simulation aborted.");

  return {
    throatMach: throatPoint.mach,
    referenceExitMach: Number(referenceExitMach.toFixed(3)),
    exitMachErrorPct: Number(exitMachErrorPct.toFixed(2)),
    referenceExitPressurePa: Math.round(referenceExitPressure),
    exitPressureErrorPct: Number(exitPressureErrorPct.toFixed(2)),
    checks: {
      throatChoked,
      centerlineMachIncreases,
      divergingMachIncreases,
      pressureDropsThroughNozzle,
      densityDropsThroughNozzle,
      velocityIncreasesThroughNozzle,
      checkerboardStable,
      exitContinuous,
      residualConverged,
      exitMachWithin10Pct,
      physicallyValid
    },
    warnings,
    target: "<3% for clean isentropic validation cases"
  };
}
