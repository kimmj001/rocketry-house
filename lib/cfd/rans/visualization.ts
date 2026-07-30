const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothStep = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

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
