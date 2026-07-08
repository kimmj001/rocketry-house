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
  meshDensity: "coarse" | "standard" | "fine" | "research";
};

export type NozzleCfdResidualPoint = {
  iteration: number;
  continuity: number;
  momentum: number;
  yMomentum?: number;
  energy: number;
};

export type NozzleCfdCell = {
  x: number;
  y: number;
  wallY?: number;
  physicalY?: number;
  inNozzle?: boolean;
  value: number;
};

export type NozzleCfdFieldName = "mach" | "pressure" | "temperature" | "density" | "velocity" | "faceFlux" | "totalPressure" | "totalTemperature";

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
  solver: "Rocketry House 2D axisymmetric finite-volume CFD" | "Rocketry House internal density-based nozzle CFD" | "OpenFOAM rhoCentralFoam";
  mesh: {
    cells: number;
    throatRefinementRatio: number;
    yPlusEstimate?: number;
    nozzleExitX?: number;
    domainLengthRatio?: number;
  };
  solverAudit?: {
    cells: number;
    iterations: number;
    finalCfl: number;
    finalResiduals?: {
      continuity: number;
      xMomentum: number;
      yMomentum: number;
      energy: number;
    };
    numericalSteps: {
      computePrimitive: boolean;
      physicalFluxX: boolean;
      physicalFluxY: boolean;
      computeFaceFluxes: boolean;
      hllcFlux: boolean;
      rusanovFlux: boolean;
      computeCflDt: boolean;
      applyBoundaryConditions: boolean;
      updateConservativeStateByFluxDivergence: boolean;
      computeResiduals: boolean;
    };
    runtimeMs: number;
    maximumCfl: number;
    minimumDensityKgM3: number;
    minimumPressurePa: number;
    conservationError: number;
    positivityAbort: boolean;
    nanDetected: boolean;
    skippedSteps: string[];
  };
  residuals: NozzleCfdResidualPoint[];
  fields: NozzleCfdField[];
  transientFrames?: Array<{
    iteration: number;
    physicalTimeS: number;
    fields: Partial<Record<NozzleCfdFieldName, number[]>>;
  }>;
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
  validation?: {
    throatMach: number;
    referenceExitMach: number;
    exitMachErrorPct: number;
    referenceExitPressurePa: number;
    exitPressureErrorPct: number;
    checks?: {
      throatChoked: boolean;
      centerlineMachIncreases: boolean;
      divergingMachIncreases: boolean;
      pressureDropsThroughNozzle: boolean;
      densityDropsThroughNozzle: boolean;
      velocityIncreasesThroughNozzle: boolean;
      checkerboardStable: boolean;
      exitContinuous: boolean;
      residualConverged: boolean;
      exitMachWithin10Pct: boolean;
      physicallyValid: boolean;
    };
    warnings?: string[];
    target: string;
  };
  continuityCheck?: {
    exitX: number;
    probe: Array<{
      x: number;
      mach: number;
      pressurePa: number;
      temperatureK: number;
      densityKgM3: number;
      axialVelocityMS: number;
    }>;
    maxRelativeJump: {
      mach: number;
      staticPressure: number;
      staticTemperature: number;
      density: number;
      axialVelocity: number;
    };
  };
  createdAt: string;
};

export type NozzleCfdUnavailable = {
  configured: false;
  message: string;
  requiredEnvironment: string[];
  architecture: string[];
};
