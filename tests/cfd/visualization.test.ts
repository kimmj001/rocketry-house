import assert from "node:assert/strict";
import test from "node:test";
import {
  externalFieldVisibility,
  pressureContrastPosition,
  pressureContrastScale
} from "../../lib/cfd/rans/visualization";

const domain = {
  nozzleExitXM: 0.265,
  exitRadiusM: 0.03,
  domainLengthM: 2.065,
  farfieldRadiusM: 0.16
};

test("external visualization joins the full nozzle exit without contracting", () => {
  assert.equal(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM,
    radiusM: domain.exitRadiusM
  }), 1);
  assert.equal(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + 1e-5,
    radiusM: domain.exitRadiusM
  }), 1);
});

test("external visualization expands monotonically and fades before the farfield boundary", () => {
  const earlyX = domain.nozzleExitXM + 0.1;
  const laterX = domain.nozzleExitXM + 0.8;
  const probeRadiusM = 0.055;
  const earlyVisibility = externalFieldVisibility({ ...domain, xM: earlyX, radiusM: probeRadiusM });
  const laterVisibility = externalFieldVisibility({ ...domain, xM: laterX, radiusM: probeRadiusM });

  assert.ok(laterVisibility >= earlyVisibility);
  assert.equal(externalFieldVisibility({
    ...domain,
    xM: domain.domainLengthM,
    radiusM: domain.farfieldRadiusM
  }), 0);
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
  assert.ok(scale < 100000, `external contrast was dominated by an outlier: ${scale}`);
  assert.equal(pressureContrastPosition(ambientPressurePa, ambientPressurePa, scale), 0.5);
  assert.ok(pressureContrastPosition(90000, ambientPressurePa, scale) < 0.5);
  assert.ok(pressureContrastPosition(120000, ambientPressurePa, scale) > 0.5);
});
