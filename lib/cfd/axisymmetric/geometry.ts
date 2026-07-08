import type { NozzleCfdInputs } from "@/types/cfd";

export type NozzleGeometry = {
  chamberRadiusM: number;
  chamberLengthM: number;
  throatRadiusM: number;
  exitRadiusM: number;
  convergenceLengthM: number;
  divergenceLengthM: number;
  throatXM: number;
  nozzleLengthM: number;
  externalLengthM: number;
  totalLengthM: number;
  maxRadiusM: number;
  farfieldRadiusM: number;
};

export function buildNozzleGeometry(inputs: NozzleCfdInputs): NozzleGeometry {
  const chamberRadiusM = Math.max(inputs.chamberDiameterMm / 2000, 1e-4);
  // A finite reservoir section is part of the solved domain. Previously x=0
  // started at the converging wall while the renderer drew a straight chamber,
  // offsetting the throat and exit probe from the actual CFD cells.
  const chamberLengthM = Math.max(chamberRadiusM * 3, inputs.convergenceLengthMm / 1000 * 1.5);
  const throatRadiusM = Math.max(inputs.throatDiameterMm / 2000, 5e-5);
  const exitRadiusM = Math.max(inputs.exitDiameterMm / 2000, throatRadiusM);
  const convergenceLengthM = Math.max(inputs.convergenceLengthMm / 1000, 1e-4);
  const divergenceLengthM = Math.max(inputs.divergenceLengthMm / 1000, 1e-4);
  const throatXM = chamberLengthM + convergenceLengthM;
  const nozzleLengthM = throatXM + divergenceLengthM;
  const activeNozzleLengthM = convergenceLengthM + divergenceLengthM;
  const externalLengthM = Math.max(activeNozzleLengthM * 4.5, exitRadiusM * 16, chamberRadiusM * 5);
  const farfieldRadiusM = Math.max(exitRadiusM * 5.5, chamberRadiusM * 2.8);

  return {
    chamberRadiusM,
    chamberLengthM,
    throatRadiusM,
    exitRadiusM,
    convergenceLengthM,
    divergenceLengthM,
    throatXM,
    nozzleLengthM,
    externalLengthM,
    totalLengthM: nozzleLengthM + externalLengthM,
    maxRadiusM: Math.max(chamberRadiusM, exitRadiusM, farfieldRadiusM),
    farfieldRadiusM
  };
}

export function nozzleWallRadius(xM: number, geometry: NozzleGeometry) {
  if (xM > geometry.nozzleLengthM) return geometry.farfieldRadiusM;
  if (xM <= geometry.chamberLengthM) return geometry.chamberRadiusM;
  if (xM <= geometry.throatXM) {
    const t = (xM - geometry.chamberLengthM) / geometry.convergenceLengthM;
    return geometry.chamberRadiusM + (geometry.throatRadiusM - geometry.chamberRadiusM) * t;
  }

  const t = (xM - geometry.throatXM) / geometry.divergenceLengthM;
  return geometry.throatRadiusM + (geometry.exitRadiusM - geometry.throatRadiusM) * t;
}

export function nozzleWallSlope(xM: number, geometry: NozzleGeometry) {
  if (xM > geometry.nozzleLengthM) return 0;
  const h = geometry.nozzleLengthM / 800;
  const left = nozzleWallRadius(Math.max(0, xM - h), geometry);
  const right = nozzleWallRadius(Math.min(geometry.nozzleLengthM, xM + h), geometry);
  return (right - left) / (2 * h);
}
