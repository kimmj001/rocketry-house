export type MotorVisibility = "private" | "public" | "marketplace";
export type MotorVerificationStatus = "Pre-flight analysis" | "Static fire attached" | "Measured thrust uploaded" | "Reviewed";

export type MotorParameters = {
  projectName: string;
  motorType: "Solid Rocket Motor";
  casingLengthMm: number;
  casingOuterDiameterMm: number;
  casingInnerDiameterMm: number;
  dryMassG: number;
  grainCount: number;
  grainLengthMm: number;
  grainOuterDiameterMm: number;
  coreDiameterMm: number;
  nozzleThroatMm: number;
  nozzleExitMm: number;
  expansionRatio: number;
  propellantProfileName: string;
  grainConfiguration?: "BATES" | "Hollow cylinder" | "Finocyl" | "Moon burner" | "C-slot" | "End burner" | "Rod and tube" | "Star" | "Custom";
  coreSurface?: "Exposed" | "Inhibited";
  outerSurface?: "Exposed" | "Inhibited";
  endsSurface?: "Exposed" | "Inhibited";
  slotOffsetMm?: number;
  slotWidthMm?: number;
  slotDepthMm?: number;
  convergenceAngleDeg?: number;
  divergenceAngleDeg?: number;
};

export type MotorCurvePoint = {
  time: number;
  thrust: number;
  pressure: number;
  kn: number;
  impulse: number;
  portDiameterMm?: number;
  massRemainingG?: number;
  massFlowKgS?: number;
  burnAreaCm2?: number;
  burnRateMmS?: number;
  specificImpulseS?: number;
};

export type MotorSimulationResult = {
  engineId?: string;
  engineName?: string;
  engineSource?: string;
  modelNotes?: string[];
  totalImpulseNs: number;
  averageThrustN: number;
  peakThrustN: number;
  burnTimeS: number;
  motorClass: string;
  propellantMassG: number;
  estimatedLoadedMassG: number;
  averagePressureMPa?: number;
  maxPressureMPa?: number;
  averageSpecificImpulseS?: number;
  combustionEfficiency?: number;
  nozzleEfficiency?: number;
  deliveredCharacteristicVelocityMS?: number;
  optimumExpansionRatio?: number;
  portToThroatRatio?: number;
  curve: MotorCurvePoint[];
  warnings: string[];
};

export type SavedMotor = {
  id: string;
  name: string;
  creator: string;
  description: string;
  visibility: MotorVisibility;
  license: string;
  priceCents: number;
  motorType: "Solid Rocket Motor";
  estimatedClass: string;
  totalImpulseNs: number;
  averageThrustN: number;
  peakThrustN: number;
  burnTimeS: number;
  propellantProfileName: string;
  verificationStatus: MotorVerificationStatus;
  parameters: MotorParameters;
  simulation: MotorSimulationResult;
  measuredCurve?: MotorCurvePoint[];
  createdAt: string;
  updatedAt: string;
};
