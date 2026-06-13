import type { NozzleCfdInputs } from "@/types/cfd";

export type NozzleGeometry = {
  chamberRadiusM: number;
  throatRadiusM: number;
  exitRadiusM: number;
  convergenceLengthM: number;
  divergenceLengthM: number;
  totalLengthM: number;
  maxRadiusM: number;
};

export function buildNozzleGeometry(inputs: NozzleCfdInputs): NozzleGeometry {
  const chamberRadiusM = Math.max(inputs.chamberDiameterMm / 2000, 1e-4);
  const throatRadiusM = Math.max(inputs.throatDiameterMm / 2000, 5e-5);
  const exitRadiusM = Math.max(inputs.exitDiameterMm / 2000, throatRadiusM);
  const convergenceLengthM = Math.max(inputs.convergenceLengthMm / 1000, 1e-4);
  const divergenceLengthM = Math.max(inputs.divergenceLengthMm / 1000, 1e-4);

  return {
    chamberRadiusM,
    throatRadiusM,
    exitRadiusM,
    convergenceLengthM,
    divergenceLengthM,
    totalLengthM: convergenceLengthM + divergenceLengthM,
    maxRadiusM: Math.max(chamberRadiusM, exitRadiusM)
  };
}

export function nozzleWallRadius(xM: number, geometry: NozzleGeometry) {
  if (xM <= geometry.convergenceLengthM) {
    const t = xM / geometry.convergenceLengthM;
    const eased = t * t * (3 - 2 * t);
    return geometry.chamberRadiusM + (geometry.throatRadiusM - geometry.chamberRadiusM) * eased;
  }

  const t = (xM - geometry.convergenceLengthM) / geometry.divergenceLengthM;
  const eased = t * t * (3 - 2 * t);
  return geometry.throatRadiusM + (geometry.exitRadiusM - geometry.throatRadiusM) * eased;
}

export function nozzleWallSlope(xM: number, geometry: NozzleGeometry) {
  const h = geometry.totalLengthM / 800;
  const left = nozzleWallRadius(Math.max(0, xM - h), geometry);
  const right = nozzleWallRadius(Math.min(geometry.totalLengthM, xM + h), geometry);
  return (right - left) / (2 * h);
}
