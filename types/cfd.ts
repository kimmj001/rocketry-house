export type NozzleExpansionState = "underexpanded" | "optimal" | "overexpanded" | "unknown";

export type NozzleCfdInputs = {
  chamberPressurePa: number;
  chamberTemperatureK: number;
  gamma: number;
  molecularWeightKgPerKmol: number;
  throatDiameterMm: number;
  exitDiameterMm: number;
  chamberDiameterMm: number;
  convergenceAngleDeg: number;
  divergenceAngleDeg: number;
  convergenceLengthMm: number;
  divergenceLengthMm: number;
  ambientPressurePa: number;
  meshDensity: "coarse" | "standard" | "fine";
};

export type NozzleCfdResidualPoint = {
  iteration: number;
  continuity: number;
  momentum: number;
  energy: number;
};

export type NozzleCfdCell = {
  x: number;
  y: number;
  value: number;
};

export type NozzleCfdFieldName = "mach" | "pressure" | "temperature" | "density" | "velocity";

export type NozzleCfdField = {
  name: NozzleCfdFieldName;
  label: string;
  unit: string;
  min: number;
  max: number;
  cells: NozzleCfdCell[];
};

export type NozzleCfdCenterlinePoint = {
  x: number;
  mach: number;
  pressurePa: number;
  temperatureK: number;
  densityKgM3: number;
  velocityMS: number;
};

export type NozzleCfdResult = {
  id: string;
  status: "queued" | "running" | "converged" | "failed";
  solver: "Rocketry House internal density-based nozzle CFD" | "OpenFOAM rhoCentralFoam";
  mesh: {
    cells: number;
    throatRefinementRatio: number;
    yPlusEstimate?: number;
  };
  residuals: NozzleCfdResidualPoint[];
  fields: NozzleCfdField[];
  centerline: NozzleCfdCenterlinePoint[];
  shocks: Array<{ x: number; strength: number; note: string }>;
  metrics: {
    exitMach: number;
    exitPressurePa: number;
    exitTemperatureK: number;
    massFlowKgS: number;
    thrustCoefficient: number;
    specificImpulseS: number;
    characteristicVelocityMS: number;
    areaRatio: number;
    expansionState: NozzleExpansionState;
  };
  vtkUrl?: string;
  createdAt: string;
};

export type NozzleCfdUnavailable = {
  configured: false;
  message: string;
  requiredEnvironment: string[];
  architecture: string[];
};
