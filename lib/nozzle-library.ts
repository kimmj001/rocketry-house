import type { NozzleGeometryConfig } from "@/lib/cfd/rans/types";
import type { MotorParameters } from "@/types/motor";
import type { SavedNozzleDesign } from "@/types/nozzle";

function positive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nozzleAngle(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(89, value as number)) : fallback;
}

export function motorNozzleDimensions(parameters: MotorParameters) {
  const convergenceAngleDeg = nozzleAngle(parameters.convergenceAngleDeg, 60);
  const divergenceAngleDeg = nozzleAngle(parameters.divergenceAngleDeg, 24);
  const chamberRadiusMm = parameters.casingInnerDiameterMm / 2;
  const throatRadiusMm = parameters.nozzleThroatMm / 2;
  const exitRadiusMm = parameters.nozzleExitMm / 2;

  return {
    chamberDiameterMm: parameters.casingInnerDiameterMm,
    throatDiameterMm: parameters.nozzleThroatMm,
    exitDiameterMm: parameters.nozzleExitMm,
    chamberLengthMm: Number(Math.max(parameters.casingInnerDiameterMm * 1.7, 60).toFixed(2)),
    convergenceLengthMm: Number((Math.max(chamberRadiusMm - throatRadiusMm, 0) / Math.tan((convergenceAngleDeg * Math.PI) / 180)).toFixed(3)),
    divergenceLengthMm: Number((Math.max(exitRadiusMm - throatRadiusMm, 0) / Math.tan((divergenceAngleDeg * Math.PI) / 180)).toFixed(3)),
    convergenceAngleDeg,
    divergenceAngleDeg
  };
}

export function createSavedNozzleDesign(
  parameters: MotorParameters,
  metadata: { id: string; name: string; now: string; createdAt?: string }
): SavedNozzleDesign {
  return {
    id: metadata.id,
    name: metadata.name,
    sourceMotorName: parameters.projectName,
    ...motorNozzleDimensions(parameters),
    createdAt: metadata.createdAt ?? metadata.now,
    updatedAt: metadata.now
  };
}

export function applySavedNozzleToMotor(
  parameters: MotorParameters,
  nozzle: SavedNozzleDesign
): MotorParameters {
  const throatDiameterMm = positive(nozzle.throatDiameterMm, parameters.nozzleThroatMm);
  const exitDiameterMm = Math.max(positive(nozzle.exitDiameterMm, parameters.nozzleExitMm), throatDiameterMm);
  return {
    ...parameters,
    casingInnerDiameterMm: Math.max(positive(nozzle.chamberDiameterMm, parameters.casingInnerDiameterMm), throatDiameterMm),
    nozzleThroatMm: throatDiameterMm,
    nozzleExitMm: exitDiameterMm,
    expansionRatio: Number(((exitDiameterMm / throatDiameterMm) ** 2).toFixed(2)),
    convergenceAngleDeg: nozzleAngle(nozzle.convergenceAngleDeg, parameters.convergenceAngleDeg ?? 60),
    divergenceAngleDeg: nozzleAngle(nozzle.divergenceAngleDeg, parameters.divergenceAngleDeg ?? 24)
  };
}

export function motorMatchesSavedNozzle(
  parameters: MotorParameters,
  nozzle: SavedNozzleDesign,
  tolerance = 0.02
) {
  const current = motorNozzleDimensions(parameters);
  const keys = [
    "chamberDiameterMm",
    "throatDiameterMm",
    "exitDiameterMm",
    "convergenceLengthMm",
    "divergenceLengthMm",
    "convergenceAngleDeg",
    "divergenceAngleDeg"
  ] as const;
  return keys.every((key) => Math.abs(current[key] - nozzle[key]) <= tolerance);
}

export function savedNozzleToGeometry(
  nozzle: SavedNozzleDesign,
  current: NozzleGeometryConfig
): NozzleGeometryConfig {
  const chamberRadiusM = positive(nozzle.chamberDiameterMm / 2000, current.chamberRadiusM);
  const throatRadiusM = Math.min(
    positive(nozzle.throatDiameterMm / 2000, current.throatRadiusM),
    chamberRadiusM
  );
  const exitRadiusM = Math.max(
    positive(nozzle.exitDiameterMm / 2000, current.exitRadiusM),
    throatRadiusM
  );

  return {
    ...current,
    chamberRadiusM,
    throatRadiusM,
    exitRadiusM,
    chamberLengthM: positive(nozzle.chamberLengthMm / 1000, current.chamberLengthM),
    convergentLengthM: positive(nozzle.convergenceLengthMm / 1000, current.convergentLengthM),
    divergentLengthM: positive(nozzle.divergenceLengthMm / 1000, current.divergentLengthM),
    farfieldRadiusM: Math.max(current.farfieldRadiusM, exitRadiusM * 4, chamberRadiusM * 2)
  };
}

export function isSavedNozzleDesign(value: unknown): value is SavedNozzleDesign {
  if (!value || typeof value !== "object") return false;
  const nozzle = value as Partial<SavedNozzleDesign>;
  return Boolean(
    nozzle.id &&
    nozzle.name?.trim() &&
    typeof nozzle.updatedAt === "string" &&
    positive(nozzle.chamberDiameterMm ?? 0, 0) &&
    positive(nozzle.throatDiameterMm ?? 0, 0) &&
    positive(nozzle.exitDiameterMm ?? 0, 0) &&
    positive(nozzle.convergenceLengthMm ?? 0, 0) &&
    positive(nozzle.divergenceLengthMm ?? 0, 0)
  );
}
