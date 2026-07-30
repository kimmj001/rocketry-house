import assert from "node:assert/strict";
import test from "node:test";
import {
  pressureContrastPosition,
  pressureContrastScale
} from "../../lib/cfd/rans/visualization";

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
  assert.ok(scale < 100000, `external contrast was dominated by an outlier: ${scale}`);
  assert.equal(pressureContrastPosition(ambientPressurePa, ambientPressurePa, scale), 0.5);
  assert.ok(pressureContrastPosition(90000, ambientPressurePa, scale) < 0.5);
  assert.ok(pressureContrastPosition(120000, ambientPressurePa, scale) > 0.5);
  assert.ok(
    pressureContrastPosition(90000, ambientPressurePa, scale) > 0.15,
    "moderate pressure deficits should not immediately saturate the palette"
  );
  assert.ok(
    pressureContrastPosition(120000, ambientPressurePa, scale) < 0.85,
    "moderate pressure rises should not immediately saturate the palette"
  );
});
