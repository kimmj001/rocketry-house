const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function colorSensitivityPosition(position: number, sensitivity: number) {
  const safeSensitivity = Math.max(0.5, Math.min(2.5, sensitivity));
  return clamp01(0.5 + (position - 0.5) * safeSensitivity);
}

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
  const percentileIndex = Math.floor(Math.max(0, deviations.length - 1) * 0.82);
  const minimumScalePa = Math.max(ambientPressurePa * 0.05, 750);
  const maximumScalePa = Math.max(ambientPressurePa * 0.18, minimumScalePa);
  const representativeScalePa = (deviations[percentileIndex] ?? 0) * 1.2;
  return Math.min(Math.max(representativeScalePa, minimumScalePa), maximumScalePa);
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
