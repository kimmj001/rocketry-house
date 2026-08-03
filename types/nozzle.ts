export const SAVED_NOZZLE_COLLECTION = "saved_nozzles";

export type SavedNozzleDesign = {
  id: string;
  name: string;
  sourceMotorName: string;
  chamberDiameterMm: number;
  throatDiameterMm: number;
  exitDiameterMm: number;
  chamberLengthMm: number;
  convergenceLengthMm: number;
  divergenceLengthMm: number;
  convergenceAngleDeg: number;
  divergenceAngleDeg: number;
  createdAt: string;
  updatedAt: string;
};
