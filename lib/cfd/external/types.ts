import type { RocketComponent } from "@/lib/types";

export type ExternalCfdSolver = "auto" | "fast" | "compressible";
export type ExternalCfdResolution = "low" | "medium" | "high";
export type ExternalCfdFieldName = "velocity" | "mach" | "pressure" | "temperature" | "density" | "vorticity";
export type ResolvedExternalCfdSolver = Exclude<ExternalCfdSolver, "auto">;

export type ExternalCfdInput = {
  rocket: { components: RocketComponent[] };
  mach: number;
  angleOfAttack: number;
  solver: ExternalCfdSolver;
  resolution: ExternalCfdResolution;
  visualization?: ExternalCfdFieldName;
};

export type NormalizedExternalCfdInput = Omit<ExternalCfdInput, "solver"> & {
  solver: ResolvedExternalCfdSolver;
  requestedSolver: ExternalCfdSolver;
};

export type ExternalCfdProgressState =
  | "queued"
  | "preparing_geometry"
  | "initializing"
  | "solving"
  | "postprocessing"
  | "completed"
  | "failed";

export type ExternalCfdProgress = {
  state: ExternalCfdProgressState;
  progress: number;
  iteration?: number;
  iterations?: number;
  message?: string;
};

export type EncodedScalarField = {
  data: string;
  min: number;
  max: number;
  unit: string;
};

export type ExternalCfdResult = {
  status: "completed";
  solver: ResolvedExternalCfdSolver;
  grid: { width: number; height: number };
  domain: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  rocketMask: string;
  fields: Record<ExternalCfdFieldName, EncodedScalarField>;
  vectors: { x: string; y: string; unit: "m/s" };
  metadata: {
    iterations: number;
    elapsedMs: number;
    residual: number;
    simulationTime: number;
    mach: number;
    angleOfAttack: number;
    resolution: ExternalCfdResolution;
    cacheKey: string;
    cacheHit: boolean;
    converged: boolean;
    warnings: string[];
  };
};

export type ExternalCfdFailureReason =
  | "INVALID_INPUT"
  | "INVALID_GEOMETRY"
  | "NUMERICAL_INSTABILITY"
  | "TIMEOUT";

export class ExternalCfdError extends Error {
  constructor(public reason: ExternalCfdFailureReason, message: string) {
    super(message);
    this.name = "ExternalCfdError";
  }
}

export type SolverGrid = {
  width: number;
  height: number;
  mask: Uint8Array;
  xMinM: number;
  xMaxM: number;
  yMinM: number;
  yMaxM: number;
  dxM: number;
  dyM: number;
  rocketLengthM: number;
};

export type RawExternalCfdFields = {
  velocityX: Float32Array;
  velocityY: Float32Array;
  velocity: Float32Array;
  mach: Float32Array;
  pressure: Float32Array;
  temperature: Float32Array;
  density: Float32Array;
  vorticity: Float32Array;
  iterations: number;
  simulationTime: number;
  residual: number;
  converged: boolean;
  warnings: string[];
};

export type ExternalCfdProgressCallback = (progress: ExternalCfdProgress) => void | Promise<void>;
