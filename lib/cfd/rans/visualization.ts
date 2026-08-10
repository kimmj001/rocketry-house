const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const PRESSURE_AMBIENT_POSITION = 0.75;

export function colorSensitivityPosition(position: number, sensitivity: number) {
  const safeSensitivity = Math.max(0.5, Math.min(2.5, sensitivity));
  return clamp01(0.5 + (position - 0.5) * safeSensitivity);
}

export function pressureContrastScale(
  _pressurePa: ArrayLike<number>,
  ambientPressurePa: number,
  _firstExternalIndex: number
) {
  void _firstExternalIndex;
  const safeAmbientPressurePa = Number.isFinite(ambientPressurePa)
    ? Math.max(0, ambientPressurePa)
    : 0;
  return Math.max(safeAmbientPressurePa * 0.18, 2500);
}

export function pressureContrastPosition(
  pressurePa: number,
  ambientPressurePa: number,
  contrastScalePa: number
) {
  const delta = pressurePa - ambientPressurePa;
  if (Math.abs(delta) < 1e-12) return PRESSURE_AMBIENT_POSITION;
  const linearScalePa = Math.max(ambientPressurePa * 0.03, 500);
  const denominator = Math.log1p(Math.max(contrastScalePa, linearScalePa) / linearScalePa);
  const magnitude = clamp01(Math.log1p(Math.abs(delta) / linearScalePa) / denominator);
  const enhanced = magnitude ** 1.12;
  const availableSpan = delta < 0 ? PRESSURE_AMBIENT_POSITION : 1 - PRESSURE_AMBIENT_POSITION;
  return PRESSURE_AMBIENT_POSITION + Math.sign(delta) * availableSpan * enhanced;
}
