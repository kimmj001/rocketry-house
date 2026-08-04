import assert from "node:assert/strict";
import test from "node:test";
import { defaultMotorParameters } from "../../lib/motor-simulation";
import {
  applySavedNozzleToMotor,
  createSavedNozzleDesign,
  motorMatchesSavedNozzle
} from "../../lib/nozzle-library";

test("saving a motor nozzle produces an exact linked revision", () => {
  const parameters = {
    ...defaultMotorParameters,
    casingInnerDiameterMm: 48,
    nozzleThroatMm: 8,
    nozzleExitMm: 31,
    convergenceAngleDeg: 60,
    divergenceAngleDeg: 24
  };
  const saved = createSavedNozzleDesign(parameters, {
    id: "nozzle-linked",
    name: "Linked nozzle",
    now: "2026-08-05T00:00:00.000Z"
  });

  assert.equal(saved.chamberDiameterMm, 48);
  assert.equal(saved.throatDiameterMm, 8);
  assert.equal(saved.exitDiameterMm, 31);
  assert.equal(saved.convergenceLengthMm, 11.547);
  assert.equal(saved.divergenceLengthMm, 25.829);
  assert.equal(motorMatchesSavedNozzle(parameters, saved), true);
});

test("loading a saved nozzle updates only the motor nozzle geometry", () => {
  const original = {
    ...defaultMotorParameters,
    grainCount: 7,
    grainLengthMm: 64,
    propellantProfileName: "KNSB"
  };
  const saved = createSavedNozzleDesign({
    ...defaultMotorParameters,
    casingInnerDiameterMm: 52,
    nozzleThroatMm: 9,
    nozzleExitMm: 27,
    convergenceAngleDeg: 55,
    divergenceAngleDeg: 18
  }, {
    id: "nozzle-imported",
    name: "Imported nozzle",
    now: "2026-08-05T00:00:00.000Z"
  });

  const synchronized = applySavedNozzleToMotor(original, saved);

  assert.equal(synchronized.casingInnerDiameterMm, 52);
  assert.equal(synchronized.nozzleThroatMm, 9);
  assert.equal(synchronized.nozzleExitMm, 27);
  assert.equal(synchronized.expansionRatio, 9);
  assert.equal(synchronized.grainCount, original.grainCount);
  assert.equal(synchronized.grainLengthMm, original.grainLengthMm);
  assert.equal(synchronized.propellantProfileName, original.propellantProfileName);
  assert.equal(motorMatchesSavedNozzle(synchronized, saved), true);

  assert.equal(motorMatchesSavedNozzle({ ...synchronized, nozzleExitMm: 28 }, saved), false);
});
