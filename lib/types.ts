export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "High Power";
export type VerificationStatus =
  | "Unverified"
  | "Design uploaded"
  | "Design reviewed"
  | "Media proof"
  | "Telemetry attached"
  | "Static fire data"
  | "Flight verified";

export type RocketComponentType =
  | "nose_cone"
  | "body_tube"
  | "transition"
  | "fins"
  | "motor_mount"
  | "centering_rings"
  | "bulkhead"
  | "coupler"
  | "engine_block"
  | "motor_retainer"
  | "motor_nozzle"
  | "shock_cord"
  | "parachute"
  | "wadding"
  | "rail_buttons"
  | "launch_lug"
  | "recovery_bay"
  | "payload_section";

export type RocketComponent = {
  id: string;
  type: RocketComponentType;
  name: string;
  length: number;
  diameter: number;
  wallThickness: number;
  material: string;
  mass: number;
  position: number;
  finRootChord?: number;
  finTipChord?: number;
  finSpan?: number;
  finSweep?: number;
  finCount?: number;
  noseShape?: "Ogive" | "Conical" | "Elliptical" | "Haack" | "Parabolic";
  shapeParameter?: number;
  foreDiameter?: number;
  aftDiameter?: number;
  automaticDiameter?: boolean;
  filled?: boolean;
  finish?: string;
  finCantDeg?: number;
  finRotationDeg?: number;
  finCrossSection?: "Square" | "Rounded" | "Airfoil";
  finFilletRadius?: number;
  positionReference?: "Top of parent" | "Bottom of parent" | "Absolute";
};

export type TelemetryPoint = {
  time: number;
  altitude?: number;
  velocity?: number;
  acceleration?: number;
  thrust?: number;
  pressure?: number;
};

export type TelemetryDataset = {
  id: string;
  filename: string;
  columns: string[];
  points: TelemetryPoint[];
  recognized: boolean;
};

export type RocketProject = {
  id: string;
  slug: string;
  title: string;
  creator: string;
  creatorRating: number;
  description: string;
  priceCents: number;
  tags: string[];
  difficulty: Difficulty;
  motorClass: string;
  predictedAltitudeM: number;
  actualAltitudeM?: number;
  verificationStatus: VerificationStatus;
  hasWebCad: boolean;
  hasFlightLog: boolean;
  hasTelemetry: boolean;
  hasThrustData: boolean;
  hasStlStep: boolean;
  verifiedFlight: boolean;
  forkCount: number;
  downloadCount: number;
  image: string;
  specs: {
    lengthMm: number;
    diameterMm: number;
    massG: number;
    stabilityCalibers: number;
  };
  files: string[];
  components: RocketComponent[];
  telemetry: TelemetryDataset;
  originalProjectId?: string;
  royaltyPercent: number;
  selectedMotorId?: string;
  selectedMotorVersionId?: string;
  motorMountPosition?: number;
  rocketSimulationResultJson?: unknown;
  publicReference?: {
    name: string;
    url: string;
  };
};

export type SimulationWarning = {
  level: "info" | "warning" | "critical";
  message: string;
};

export type SimulationResult = {
  cgMm: number;
  cpMm: number;
  stabilityMargin: number;
  massG: number;
  diameterMm: number;
  referenceAreaM2: number;
  motorImpulseNs: number;
  burnTimeS: number;
  averageThrustN: number;
  thrustToWeight: number;
  predictedAltitudeM: number;
  maxVelocityMps: number;
  apogeeTimeS: number;
  flightTimeS: number;
  railExitVelocityMps: number;
  dragCoefficientEstimate: number;
  timeSeries: TelemetryPoint[];
  warnings: SimulationWarning[];
};

export type Discussion = {
  id: string;
  projectId: string;
  type: "Build question" | "Simulation issue" | "Flight result" | "Failure analysis" | "Remix suggestion" | "Safety note";
  title: string;
  author: string;
  comments: number;
};
