export type ReconstructionMode = "firstOrder" | "musclVenkatakrishnan";
export type TurbulenceMode = "laminar" | "spalartAllmaras";
export type ThermoModel = "constantGas" | "hydroloxFrozen";
export type ResolutionPreset = "development" | "standard" | "high";
export type InitializationMode = "coldStart" | "quasiSteady";
export type TimeSteppingMode = "global" | "localPseudoTime";
export type TimeIntegrator = "forwardEuler" | "sspRk2";
export type CfdFieldName =
  | "mach"
  | "pressure"
  | "temperature"
  | "density"
  | "velocity"
  | "axialVelocity"
  | "turbulentViscosityRatio"
  | "residual";

export const INTERACTIVE_RANS_DIMENSIONS = {
  development: { nx: 112, nr: 22 },
  standard: { nx: 144, nr: 28 },
  high: { nx: 208, nr: 40 }
} satisfies Record<ResolutionPreset, { nx: number; nr: number }>;

export type NozzleGeometryConfig = {
  chamberRadiusM: number;
  throatRadiusM: number;
  exitRadiusM: number;
  chamberLengthM: number;
  convergentLengthM: number;
  divergentLengthM: number;
  externalLengthM: number;
  farfieldRadiusM: number;
};

export type RansSolverConfig = {
  geometry: NozzleGeometryConfig;
  resolution: ResolutionPreset;
  nx?: number;
  nr?: number;
  chamberPressurePa: number;
  chamberTemperatureK: number;
  ambientPressurePa: number;
  gamma: number;
  gasConstant: number;
  thermoModel: ThermoModel;
  initializationMode: InitializationMode;
  timeStepping: TimeSteppingMode;
  timeIntegrator: TimeIntegrator;
  turbulence: TurbulenceMode;
  reconstruction: ReconstructionMode;
  cfl: number;
  cflRamp: boolean;
  turbulentPrandtl: number;
  maxModifiedViscosityRatio: number;
  iterationsPerBatch: number;
  snapshotInterval: number;
  fixedTimeStepS?: number;
  rhoMin: number;
  pressureMin: number;
  temperatureMin: number;
};

export type ThermoProperties = {
  gamma: number;
  gasConstant: number;
  viscosity: number;
  conductivity: number;
  prandtl: number;
  cp: number;
};

export type BodyFittedMesh = {
  nx: number;
  nr: number;
  cells: number;
  lengthM: number;
  nozzleLengthM: number;
  maxRadiusM: number;
  throatIndex: number;
  nozzleExitIndex: number;
  xFaces: Float64Array;
  xCenters: Float64Array;
  etaFaces: Float64Array;
  etaCenters: Float64Array;
  wallFaces: Float64Array;
  wallCenters: Float64Array;
  radialFaceLeft: Float64Array;
  radialFaceRight: Float64Array;
  cellX: Float64Array;
  cellR: Float64Array;
  volumes: Float64Array;
  wallDistance: Float64Array;
  minCellLength: number;
};

export type ConservativeState = {
  rho: Float64Array;
  rhoU: Float64Array;
  rhoV: Float64Array;
  rhoE: Float64Array;
  rhoNuTilde: Float64Array;
};

export type PrimitiveArrays = {
  rho: Float64Array;
  u: Float64Array;
  v: Float64Array;
  p: Float64Array;
  temperature: Float64Array;
  soundSpeed: Float64Array;
  mach: Float64Array;
  gamma: Float64Array;
  gasConstant: Float64Array;
  cp: Float64Array;
  mu: Float64Array;
  conductivity: Float64Array;
  prandtl: Float64Array;
  nu: Float64Array;
  nuTilde: Float64Array;
  muT: Float64Array;
};

export type ScalarGradient = {
  x: Float64Array;
  r: Float64Array;
};

export type SolverResidualPoint = {
  iteration: number;
  continuity: number;
  axialMomentum: number;
  radialMomentum: number;
  energy: number;
  turbulence: number;
};

export type MassFlowDiagnostic = {
  station: "chamber" | "preThroat" | "throat" | "midDivergent" | "exit";
  xM: number;
  massFlowKgS: number;
};

export type SolverDiagnostics = {
  iteration: number;
  pseudoTimeS: number;
  cfl: number;
  dtS: number;
  maxLocalDtS: number;
  timeStepping: TimeSteppingMode;
  timeIntegrator: TimeIntegrator;
  minDensityKgM3: number;
  minPressurePa: number;
  minTemperatureK: number;
  maxMach: number;
  maxVelocityMS: number;
  maxTurbulentViscosityRatio: number;
  massFlowRelativeSpread: number;
  limitedFaces: number;
  hllcFallbacks: number;
  firstOrderFallbacks: number;
  positivityCorrections: number;
  turbulenceClips: number;
  rejectedSteps: number;
  nanCount: number;
  floorApplications: number;
  converged: boolean;
  failed: boolean;
  failureReason?: string;
  residual: SolverResidualPoint;
  massFlow: MassFlowDiagnostic[];
};

export type SolverSnapshot = {
  mesh: {
    nx: number;
    nr: number;
    lengthM: number;
    nozzleLengthM: number;
    nozzleExitIndex: number;
    maxRadiusM: number;
    xFaces: Float32Array;
    wallFaces: Float32Array;
    columnOuterRadius: Float32Array;
    cellR: Float32Array;
  };
  fields: Record<CfdFieldName, Float32Array>;
  ranges: Record<CfdFieldName, { min: number; max: number }>;
  diagnostics: SolverDiagnostics;
};

export type CfdWorkerRequest =
  | { type: "initialize"; config: RansSolverConfig }
  | { type: "start" }
  | { type: "pause" }
  | { type: "step"; iterations?: number }
  | { type: "reset"; config?: RansSolverConfig }
  | { type: "snapshot" };

export type CfdWorkerResponse =
  | { type: "ready"; snapshot: SolverSnapshot }
  | { type: "snapshot"; snapshot: SolverSnapshot; running: boolean }
  | { type: "status"; running: boolean }
  | { type: "error"; message: string };

export const DEFAULT_RANS_CONFIG: RansSolverConfig = {
  geometry: {
    chamberRadiusM: 0.036,
    throatRadiusM: 0.012,
    exitRadiusM: 0.03,
    chamberLengthM: 0.08,
    convergentLengthM: 0.045,
    divergentLengthM: 0.14,
    externalLengthM: 1.8,
    farfieldRadiusM: 0.16
  },
  resolution: "development",
  chamberPressurePa: 4.826e6,
  chamberTemperatureK: 3512.4,
  ambientPressurePa: 101325,
  gamma: 1.1489,
  gasConstant: 378.1,
  thermoModel: "hydroloxFrozen",
  initializationMode: "coldStart",
  timeStepping: "localPseudoTime",
  timeIntegrator: "sspRk2",
  turbulence: "spalartAllmaras",
  reconstruction: "musclVenkatakrishnan",
  cfl: 0.02,
  cflRamp: true,
  turbulentPrandtl: 0.9,
  maxModifiedViscosityRatio: 10000,
  iterationsPerBatch: 16,
  snapshotInterval: 5,
  rhoMin: 1e-8,
  pressureMin: 1,
  temperatureMin: 50
};
