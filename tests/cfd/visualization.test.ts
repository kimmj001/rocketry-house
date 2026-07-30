import assert from "node:assert/strict";
import test from "node:test";
import {
  externalFieldVisibility,
  externalFlowActivity,
  flowStructureColorPosition,
  pressureContrastPosition,
  pressureContrastScale,
  transportedThermalEnergy
} from "../../lib/cfd/rans/visualization";

const domain = {
  nozzleExitXM: 0.265,
  exitRadiusM: 0.03,
  outerRadiusM: 0.16,
  flowActivity: 1
};

test("external visualization keeps the nozzle interior and active exit connected", () => {
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
  assert.ok(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + 1e-5,
    radiusM: domain.exitRadiusM * 1.35
  }) < 0.1);
  assert.ok(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + domain.exitRadiusM * 0.5,
    radiusM: domain.exitRadiusM * 1.2
  }) < 0.05);
});

test("external visualization follows flow activity and fades only at the farfield boundary", () => {
  const activeVisibility = externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + 0.2,
    radiusM: 0.07
  });
  assert.ok(activeVisibility > 0.9);
  assert.equal(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + 0.2,
    radiusM: 0.07,
    flowActivity: 0
  }), 0);
  assert.equal(externalFieldVisibility({
    ...domain,
    xM: domain.nozzleExitXM + 0.2,
    radiusM: domain.outerRadiusM
  }), 0);
});

test("external flow activity rejects still ambient gas and retains moving thermal flow", () => {
  assert.equal(externalFlowActivity({
    mach: 0,
    pressurePa: 101325,
    ambientPressurePa: 101325,
    temperatureK: 288.15
  }), 0);
  assert.ok(externalFlowActivity({
    mach: 0.5,
    pressurePa: 101325,
    ambientPressurePa: 101325,
    temperatureK: 288.15
  }) > 0.9);
  assert.ok(externalFlowActivity({
    mach: 0,
    pressurePa: 101325,
    ambientPressurePa: 101325,
    temperatureK: 900
  }) > 0.9);
});

test("transported thermal energy excludes stationary heat and cold pressure waves", () => {
  const base = {
    maximumTemperatureK: 3500,
    maximumAxialVelocityMS: 2500
  };
  assert.equal(transportedThermalEnergy({
    ...base,
    temperatureK: 1800,
    axialVelocityMS: 0
  }), 0);
  assert.equal(transportedThermalEnergy({
    ...base,
    temperatureK: 288.15,
    axialVelocityMS: 1200
  }), 0);
  assert.ok(transportedThermalEnergy({
    ...base,
    temperatureK: 2400,
    axialVelocityMS: 1800
  }) > 0.5);
});

test("flow structure hue separates pressure deficits, ambient, and compression", () => {
  const base = {
    ambientPressurePa: 101325,
    contrastScalePa: 50000
  };
  const low = flowStructureColorPosition({ ...base, pressurePa: 80000 });
  const ambient = flowStructureColorPosition({ ...base, pressurePa: 101325 });
  const high = flowStructureColorPosition({ ...base, pressurePa: 135000 });
  assert.ok(low < ambient);
  assert.ok(ambient < high);
  assert.ok(high - low > 0.35);
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
  assert.ok(
    pressureContrastPosition(90000, ambientPressurePa, scale) > 0.15,
    "moderate pressure deficits should not immediately saturate the palette"
  );
  assert.ok(
    pressureContrastPosition(120000, ambientPressurePa, scale) < 0.85,
    "moderate pressure rises should not immediately saturate the palette"
  );
});
