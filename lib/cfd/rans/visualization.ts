const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothStep = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

export function pressureContrastScale(
  pressurePa: ArrayLike<number>,
  ambientPressurePa: number,
  firstExternalIndex: number
) {
  const deviations: number[] = [];
  for (let index = Math.max(0, firstExternalIndex); index < pressurePa.length; index += 1) {
    const deviation = Math.abs(pressurePa[index] - ambientPressurePa);
    if (Number.isFinite(deviation)) deviations.push(deviation);
  }
  deviations.sort((left, right) => left - right);
  const percentileIndex = Math.floor(Math.max(0, deviations.length - 1) * 0.97);
  return Math.max(
    ambientPressurePa * 0.15,
    (deviations[percentileIndex] ?? 0) * 1.75,
    750
  );
}

export function pressureContrastPosition(
  pressurePa: number,
  ambientPressurePa: number,
  contrastScalePa: number
) {
  const delta = pressurePa - ambientPressurePa;
  if (Math.abs(delta) < 1e-12) return 0.5;
  const linearScalePa = Math.max(ambientPressurePa * 0.03, 500);
  const denominator = Math.log1p(Math.max(contrastScalePa, linearScalePa) / linearScalePa);
  const magnitude = clamp01(Math.log1p(Math.abs(delta) / linearScalePa) / denominator);
  const enhanced = magnitude ** 1.08;
  return 0.5 + 0.5 * Math.sign(delta) * enhanced;
}

export function externalFieldVisibility({
  xM,
  radiusM,
  nozzleExitXM,
  exitRadiusM,
  outerRadiusM,
  flowActivity
}: {
  xM: number;
  radiusM: number;
  nozzleExitXM: number;
  exitRadiusM: number;
  outerRadiusM: number;
  flowActivity: number;
}) {
  if (xM <= nozzleExitXM) return 1;

  const edgeFeatherM = Math.max(exitRadiusM * 0.35, outerRadiusM * 0.12, 1e-6);
  const edgeVisibility = smoothStep((outerRadiusM - radiusM) / edgeFeatherM);
  return edgeVisibility * smoothStep((flowActivity - 0.015) / 0.985);
}

export function externalFlowActivity({
  mach,
  pressurePa,
  ambientPressurePa,
  temperatureK,
  ambientTemperatureK = 288.15
}: {
  mach: number;
  pressurePa: number;
  ambientPressurePa: number;
  temperatureK: number;
  ambientTemperatureK?: number;
}) {
  const machSignal = clamp01((mach - 0.015) / 0.42);
  const pressureSignal = clamp01(
    Math.abs(pressurePa - ambientPressurePa) / Math.max(ambientPressurePa * 0.12, 1200)
  );
  const temperatureSignal = clamp01(
    Math.abs(temperatureK - ambientTemperatureK) / Math.max(ambientTemperatureK * 0.55, 120)
  );
  return Math.max(machSignal, pressureSignal * 0.72, temperatureSignal);
}

export function transportedThermalEnergy({
  temperatureK,
  ambientTemperatureK = 288.15,
  maximumTemperatureK,
  axialVelocityMS,
  maximumAxialVelocityMS
}: {
  temperatureK: number;
  ambientTemperatureK?: number;
  maximumTemperatureK: number;
  axialVelocityMS: number;
  maximumAxialVelocityMS: number;
}) {
  const temperatureSignal = clamp01(
    (temperatureK - ambientTemperatureK) /
      Math.max(maximumTemperatureK - ambientTemperatureK, 200)
  );
  const axialVelocitySignal = clamp01(
    Math.max(axialVelocityMS, 0) / Math.max(maximumAxialVelocityMS, 1)
  );
  return Math.pow(temperatureSignal * axialVelocitySignal, 0.55);
}
