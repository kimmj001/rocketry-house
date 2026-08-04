import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMotorParameters,
  evaluatePropellantBurnRate,
  simulateMotor
} from "../../lib/motor-simulation/index";

function closeTo(actual: number, expected: number, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

test("KNSB uses the published pressure-regime burn-rate coefficients", () => {
  const profile = "KNSB 65/35 - strand-burner data";
  closeTo(evaluatePropellantBurnRate(profile, 0.103), 10.71 * 0.103 ** 0.625);
  closeTo(evaluatePropellantBurnRate(profile, 1), 8.763);
  closeTo(evaluatePropellantBurnRate(profile, 2), 7.852 * 2 ** -0.013);
  closeTo(evaluatePropellantBurnRate(profile, 5), 3.907 * 5 ** 0.535);
  closeTo(evaluatePropellantBurnRate(profile, 9), 9.653 * 9 ** 0.064);
});

test("default motor produces a finite ignition transient, burn, and tail-off", () => {
  const result = simulateMotor(defaultMotorParameters);
  assert.equal(result.curve[0].thrust, 0);
  assert.equal(result.curve[0].pressure, 0);
  assert.equal(result.curve.at(-1)?.thrust, 0);
  assert.equal(result.curve.at(-1)?.pressure, 0);
  assert.ok(result.curve.some((point) => point.thrust > 0 && point.pressure > 0.2));
  assert.ok(result.curve.every((point) => Object.values(point).every((value) => value === undefined || Number.isFinite(value))));
  assert.ok(result.totalImpulseNs > 0);
  assert.ok(result.burnTimeS > 0);
  closeTo(result.totalImpulseNs / result.burnTimeS, result.averageThrustN, 1);
});

test("throat area changes pressure in the expected direction", () => {
  const smallerThroat = simulateMotor({ ...defaultMotorParameters, nozzleThroatMm: 7, nozzleExitMm: 18 });
  const largerThroat = simulateMotor({ ...defaultMotorParameters, nozzleThroatMm: 9, nozzleExitMm: 18 });
  assert.ok(smallerThroat.maxPressureMPa! > largerThroat.maxPressureMPa!);
});

test("BATES axial regression changes the curve when segment ends are inhibited", () => {
  const exposedEnds = simulateMotor({ ...defaultMotorParameters, endsSurface: "Exposed" });
  const inhibitedEnds = simulateMotor({ ...defaultMotorParameters, endsSurface: "Inhibited" });
  assert.notEqual(exposedEnds.burnTimeS, inhibitedEnds.burnTimeS);
  assert.notEqual(exposedEnds.peakThrustN, inhibitedEnds.peakThrustN);
});

test("unsupported perimeter modes are not hidden behind empirical area multipliers", () => {
  const result = simulateMotor({ ...defaultMotorParameters, grainConfiguration: "Star" });
  assert.ok(result.warnings.some((warning) => warning.includes("equivalent circular port")));
});
