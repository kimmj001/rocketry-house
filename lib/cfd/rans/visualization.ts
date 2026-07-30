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
  domainLengthM,
  farfieldRadiusM
}: {
  xM: number;
  radiusM: number;
  nozzleExitXM: number;
  exitRadiusM: number;
  domainLengthM: number;
  farfieldRadiusM: number;
}) {
  if (xM <= nozzleExitXM) return 1;

  const externalLengthM = Math.max(domainLengthM - nozzleExitXM, 1e-8);
  const downstreamDistanceM = xM - nozzleExitXM;
  const targetCoreRadiusM = Math.max(exitRadiusM, farfieldRadiusM * 0.7);
  const spreadSlope = (targetCoreRadiusM - exitRadiusM) / externalLengthM;
  const coreRadiusM = exitRadiusM + downstreamDistanceM * spreadSlope;
  if (radiusM <= coreRadiusM) return 1;

  const featherWidthM = Math.max(exitRadiusM * 0.2, farfieldRadiusM * 0.08, 1e-6);
  return 1 - smoothStep((radiusM - coreRadiusM) / featherWidthM);
}
