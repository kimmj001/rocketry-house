import type { NozzleGeometryConfig } from "@/lib/cfd/rans/types";
import type { SavedNozzleDesign } from "@/types/nozzle";

function positive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
