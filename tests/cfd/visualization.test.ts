import assert from "node:assert/strict";
import test from "node:test";
import {
  colorSensitivityPosition,
  PRESSURE_AMBIENT_POSITION,
  pressureContrastPosition,
  pressureContrastScale
} from "../../lib/cfd/rans/visualization";

test("color sensitivity expands contrast around the palette midpoint", () => {
  assert.equal(colorSensitivityPosition(0.5, 2), 0.5);
  assert.equal(colorSensitivityPosition(0.25, 2), 0);
  assert.equal(colorSensitivityPosition(0.75, 2), 1);
  assert.equal(colorSensitivityPosition(0.25, 1), 0.25);
});

test("pressure contrast remains stable between frames and separates pressure around ambient", () => {
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
  const nextFrameScale = pressureContrastScale(
    Float32Array.from([ambientPressurePa, 72000, 118000, 2.4e6]),
    ambientPressurePa,
    1
  );
  assert.equal(scale, ambientPressurePa * 0.18);
  assert.equal(nextFrameScale, scale);
  assert.equal(
    pressureContrastPosition(ambientPressurePa, ambientPressurePa, scale),
    PRESSURE_AMBIENT_POSITION
  );
  assert.ok(pressureContrastPosition(90000, ambientPressurePa, scale) < PRESSURE_AMBIENT_POSITION);
  assert.ok(pressureContrastPosition(120000, ambientPressurePa, scale) > PRESSURE_AMBIENT_POSITION);
  const nearbyDeficit = pressureContrastPosition(99000, ambientPressurePa, scale);
  const nearbyRise = pressureContrastPosition(104000, ambientPressurePa, scale);
  assert.ok(
    nearbyDeficit > 0.45 && nearbyDeficit < PRESSURE_AMBIENT_POSITION,
    "near-ambient pressure deficits should remain distinct"
  );
  assert.ok(
    nearbyRise > PRESSURE_AMBIENT_POSITION && nearbyRise < 0.9,
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

  assert.equal(scale, ambientPressurePa * 0.18);
  assert.ok(ambientPressurePa - scale > 83000);
  assert.ok(ambientPressurePa + scale < 120000);
});
