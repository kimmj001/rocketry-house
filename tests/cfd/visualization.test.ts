import assert from "node:assert/strict";
import test from "node:test";
import {
  colorSensitivityPosition,
  pressureContrastPosition,
  pressureContrastScale
} from "../../lib/cfd/rans/visualization";

test("color sensitivity expands contrast around the palette midpoint", () => {
  assert.equal(colorSensitivityPosition(0.5, 2), 0.5);
  assert.equal(colorSensitivityPosition(0.25, 2), 0);
  assert.equal(colorSensitivityPosition(0.75, 2), 1);
  assert.equal(colorSensitivityPosition(0.25, 1), 0.25);
});

test("pressure contrast ignores chamber extremes and separates pressure around ambient", () => {
  const ambientPressurePa = 101325;
  const pressure = Float32Array.from([
    4.8e6,
    4.2e6,
    82000,
    93000,
    ambientPressurePa,
    114000,
    131000,
    900000
  ]);
  const scale = pressureContrastScale(pressure, ambientPressurePa, 2);
  assert.ok(scale >= ambientPressurePa * 0.05, `ambient contrast became too narrow: ${scale}`);
  assert.ok(scale <= ambientPressurePa * 0.18, `external contrast was dominated by an outlier: ${scale}`);
  assert.equal(pressureContrastPosition(ambientPressurePa, ambientPressurePa, scale), 0.5);
  assert.ok(pressureContrastPosition(90000, ambientPressurePa, scale) < 0.5);
  assert.ok(pressureContrastPosition(120000, ambientPressurePa, scale) > 0.5);
  const nearbyDeficit = pressureContrastPosition(99000, ambientPressurePa, scale);
  const nearbyRise = pressureContrastPosition(104000, ambientPressurePa, scale);
  assert.ok(
    nearbyDeficit > 0.15 && nearbyDeficit < 0.5,
    "near-ambient pressure deficits should remain distinct"
  );
  assert.ok(
    nearbyRise > 0.5 && nearbyRise < 0.85,
    "near-ambient pressure rises should remain distinct"
  );
});

test("pressure legend stays tightly centered on one atmosphere", () => {
  const ambientPressurePa = 101325;
  const scale = pressureContrastScale(
    Float32Array.from([ambientPressurePa, 100900, 101700, 4.8e6]),
    ambientPressurePa,
    0
  );

  assert.equal(scale, ambientPressurePa * 0.05);
  assert.ok(ambientPressurePa - scale > 96000);
  assert.ok(ambientPressurePa + scale < 107000);
});
