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

export function validateAgainstIsentropicTheory(inputs: NozzleCfdInputs, result: NozzleCfdResult) {
  const gamma = Math.max(1.05, Math.min(1.67, inputs.gamma));
  const areaRatio = Math.max((inputs.exitDiameterMm / inputs.throatDiameterMm) ** 2, 1.0001);
  const referenceExitMach = solveSupersonicMach(areaRatio, gamma);
  const referenceExitPressure = inputs.chamberPressurePa /
    Math.pow(1 + ((gamma - 1) / 2) * referenceExitMach * referenceExitMach, gamma / (gamma - 1));
  const throatX = inputs.convergenceLengthMm / Math.max(inputs.convergenceLengthMm + inputs.divergenceLengthMm, 1);
  const throatPoint = result.centerline.reduce((best, point) =>
    Math.abs(point.x - throatX) < Math.abs(best.x - throatX) ? point : best,
  result.centerline[0]);
  const exitPoint = result.centerline.at(-1) ?? result.centerline[0];

  const exitMachErrorPct = Math.abs(exitPoint.mach - referenceExitMach) / Math.max(referenceExitMach, 1e-6) * 100;
  const exitPressureErrorPct = Math.abs(exitPoint.pressurePa - referenceExitPressure) / Math.max(referenceExitPressure, 1) * 100;

  return {
    throatMach: throatPoint.mach,
    referenceExitMach: Number(referenceExitMach.toFixed(3)),
    exitMachErrorPct: Number(exitMachErrorPct.toFixed(2)),
    referenceExitPressurePa: Math.round(referenceExitPressure),
    exitPressureErrorPct: Number(exitPressureErrorPct.toFixed(2)),
    target: "<3% for clean isentropic validation cases"
  };
}
