import type { MotorCurvePoint, MotorParameters, MotorSimulationResult } from "@/types/motor";

type SolidPropellantProfile = {
  label: string;
  densityKgM3: number;
  burnRateSegments: BurnRateSegment[];
  characteristicVelocityMS: number;
  characteristicVelocityBasis: "measured" | "theoretical" | "uncalibrated";
  specificHeatRatio: number;
  molarMassKgKmol: number;
  combustionEfficiency: number;
  nozzleEfficiency: number;
  temperatureK: number;
  sourceLabel: string;
  sourceUrl: string;
  calibrated: boolean;
};

type BurnRateSegment = {
  minPressureMPa: number;
  maxPressureMPa: number;
  coefficientMmSMPaN: number;
  exponent: number;
};

export const JSRM_ENGINE_ID = "srm-transient-0d-v0.3";
const JSRM_SOURCE = "NASA-style zero-dimensional transient internal ballistics with pressure-regime strand-burner data from Richard Nakka.";
const G0 = 9.80665;
const PATM_PA = 101_325;
const MM = 1000;
const MIN_PRESSURE_PA = 120_000;
const UNIVERSAL_GAS_CONSTANT = 8_314.462618;
const MAX_MODEL_PRESSURE_PA = 40_000_000;

const PROFILE_ENERGY: Record<string, SolidPropellantProfile> = {
  "KNSB 65/35 - strand-burner data": {
    label: "KNSB 65/35 - strand-burner data",
    densityKgM3: 1820,
    burnRateSegments: [
      { minPressureMPa: 0.103, maxPressureMPa: 0.807, coefficientMmSMPaN: 10.71, exponent: 0.625 },
      { minPressureMPa: 0.807, maxPressureMPa: 1.5, coefficientMmSMPaN: 8.763, exponent: -0.314 },
      { minPressureMPa: 1.5, maxPressureMPa: 3.79, coefficientMmSMPaN: 7.852, exponent: -0.013 },
      { minPressureMPa: 3.79, maxPressureMPa: 7.03, coefficientMmSMPaN: 3.907, exponent: 0.535 },
      { minPressureMPa: 7.03, maxPressureMPa: 10.67, coefficientMmSMPaN: 9.653, exponent: 0.064 }
    ],
    characteristicVelocityMS: 908,
    characteristicVelocityBasis: "theoretical",
    specificHeatRatio: 1.137,
    molarMassKgKmol: 39.9,
    combustionEfficiency: 1,
    nozzleEfficiency: 1,
    temperatureK: 1600,
    sourceLabel: "KNSB 65/35 pressure-regime strand-burner and thermochemical data",
    sourceUrl: "https://www.nakka-rocketry.net/bntest.html",
    calibrated: true
  },
  "KNDX 65/35 - strand-burner data": {
    label: "KNDX 65/35 - strand-burner data",
    densityKgM3: 1859,
    burnRateSegments: [
      { minPressureMPa: 0.103, maxPressureMPa: 0.779, coefficientMmSMPaN: 8.88, exponent: 0.619 },
      { minPressureMPa: 0.779, maxPressureMPa: 2.57, coefficientMmSMPaN: 7.55, exponent: -0.009 },
      { minPressureMPa: 2.57, maxPressureMPa: 5.93, coefficientMmSMPaN: 3.04, exponent: 0.688 },
      { minPressureMPa: 5.93, maxPressureMPa: 8.5, coefficientMmSMPaN: 17.2, exponent: -0.148 },
      { minPressureMPa: 8.5, maxPressureMPa: 11.2, coefficientMmSMPaN: 4.78, exponent: 0.442 }
    ],
    characteristicVelocityMS: 891,
    characteristicVelocityBasis: "measured",
    specificHeatRatio: 1.13,
    molarMassKgKmol: 42.42,
    combustionEfficiency: 1,
    nozzleEfficiency: 1,
    temperatureK: 1710,
    sourceLabel: "KNDX 65/35 pressure-regime strand-burner and measured c-star data",
    sourceUrl: "https://www.nakka-rocketry.net/bntest.html",
    calibrated: true
  },
  "APCP family public metadata": {
    label: "APCP family public metadata",
    densityKgM3: 1680,
    burnRateSegments: [{ minPressureMPa: 0.1, maxPressureMPa: 20, coefficientMmSMPaN: 4.8, exponent: 0.31 }],
    characteristicVelocityMS: 1450,
    characteristicVelocityBasis: "uncalibrated",
    specificHeatRatio: 1.18,
    molarMassKgKmol: 30,
    combustionEfficiency: 0.9,
    nozzleEfficiency: 0.94,
    temperatureK: 2850,
    sourceLabel: "Uncalibrated generic placeholder",
    sourceUrl: "",
    calibrated: false
  },
  "Certified commercial curve metadata": {
    label: "Certified commercial curve metadata",
    densityKgM3: 1700,
    burnRateSegments: [{ minPressureMPa: 0.1, maxPressureMPa: 20, coefficientMmSMPaN: 4.3, exponent: 0.29 }],
    characteristicVelocityMS: 1380,
    characteristicVelocityBasis: "uncalibrated",
    specificHeatRatio: 1.17,
    molarMassKgKmol: 32,
    combustionEfficiency: 0.9,
    nozzleEfficiency: 0.93,
    temperatureK: 2500,
    sourceLabel: "Uncalibrated generic placeholder",
    sourceUrl: "",
    calibrated: false
  },
  "Undisclosed educational estimate": {
    label: "Undisclosed educational estimate",
    densityKgM3: 1660,
    burnRateSegments: [{ minPressureMPa: 0.1, maxPressureMPa: 20, coefficientMmSMPaN: 3.8, exponent: 0.24 }],
    characteristicVelocityMS: 1060,
    characteristicVelocityBasis: "uncalibrated",
    specificHeatRatio: 1.14,
    molarMassKgKmol: 40,
    combustionEfficiency: 0.85,
    nozzleEfficiency: 0.9,
    temperatureK: 1700,
    sourceLabel: "Uncalibrated generic placeholder",
    sourceUrl: "",
    calibrated: false
  }
};

const PROFILE_ALIASES: Record<string, keyof typeof PROFILE_ENERGY> = {
  "KNSB sorbitol family metadata": "KNSB 65/35 - strand-burner data",
  "KNDX dextrose family metadata": "KNDX 65/35 - strand-burner data"
};

export const defaultMotorParameters: MotorParameters = {
  projectName: "54 mm JSRM Reference Motor",
  motorType: "Solid Rocket Motor",
  casingLengthMm: 420,
  casingOuterDiameterMm: 54,
  casingInnerDiameterMm: 48,
  dryMassG: 980,
  grainCount: 3,
  grainLengthMm: 95,
  grainOuterDiameterMm: 45,
  coreDiameterMm: 16,
  nozzleThroatMm: 8,
  nozzleExitMm: 18,
  expansionRatio: 5.1,
  propellantProfileName: "KNSB 65/35 - strand-burner data",
  grainConfiguration: "BATES",
  coreSurface: "Exposed",
  outerSurface: "Inhibited",
  endsSurface: "Exposed",
  slotOffsetMm: 5,
  slotWidthMm: 6,
  slotDepthMm: 8,
  convergenceAngleDeg: 60,
  divergenceAngleDeg: 24
};

export const propellantProfiles = [
  PROFILE_ENERGY["KNSB 65/35 - strand-burner data"].label,
  PROFILE_ENERGY["KNDX 65/35 - strand-burner data"].label
];

export function estimateMotorClass(totalImpulseNs: number) {
  const classes = [
    ["A", 2.5],
    ["B", 5],
    ["C", 10],
    ["D", 20],
    ["E", 40],
    ["F", 80],
    ["G", 160],
    ["H", 320],
    ["I", 640],
    ["J", 1280],
    ["K", 2560],
    ["L", 5120],
    ["M", 10240],
    ["N", 20480],
    ["O", 40960]
  ] as const;
  return classes.find(([, max]) => totalImpulseNs <= max)?.[0] ?? "Experimental";
}

function circleArea(diameterMm: number) {
  return Math.PI * (diameterMm / 2 / MM) ** 2;
}

function annulusArea(outerDiameterMm: number, innerDiameterMm: number) {
  return Math.max(circleArea(outerDiameterMm) - circleArea(innerDiameterMm), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function surfaceFactor(surface?: MotorParameters["coreSurface"] | MotorParameters["outerSurface"] | MotorParameters["endsSurface"]) {
  return surface === "Inhibited" ? 0 : 1;
}

function getProfile(parameters: MotorParameters) {
  const alias = PROFILE_ALIASES[parameters.propellantProfileName];
  return PROFILE_ENERGY[alias ?? parameters.propellantProfileName] ?? PROFILE_ENERGY["KNSB 65/35 - strand-burner data"];
}

function estimateBurnGeometry(parameters: MotorParameters, webMm: number) {
  const grainCount = Math.max(1, parameters.grainCount);
  const coreSurface = surfaceFactor(parameters.coreSurface);
  const outerSurface = surfaceFactor(parameters.outerSurface);
  const endsSurface = surfaceFactor(parameters.endsSurface);
  const config = parameters.grainConfiguration ?? "BATES";
  const endFaceCount = config === "End burner" ? endsSurface : endsSurface * 2;
  const lengthMm = Math.max(parameters.grainLengthMm - endFaceCount * webMm, 0);
  const outerDiameterMm = Math.max(parameters.grainOuterDiameterMm - outerSurface * webMm * 2, 0);
  const coreDiameterMm = Math.max(parameters.coreDiameterMm + coreSurface * webMm * 2, 0);
  const validAnnulus = outerDiameterMm > coreDiameterMm && lengthMm > 0;
  const lengthM = lengthMm / MM;
  const portAreaM2 = circleArea(coreDiameterMm);

  if (config === "End burner") {
    const faceAreaM2 = validAnnulus ? annulusArea(outerDiameterMm, coreDiameterMm) : 0;
    return {
      burnAreaM2: faceAreaM2 * grainCount * endsSurface,
      volumeM3: faceAreaM2 * lengthM * grainCount,
      portAreaM2: Math.max(circleArea(parameters.nozzleThroatMm), portAreaM2),
      portDiameterMm: coreDiameterMm,
      lengthMm,
      outerDiameterMm
    };
  }

  const coreRadiusM = coreDiameterMm / 2 / MM;
  const outerRadiusM = outerDiameterMm / 2 / MM;
  const endAnnulusM2 = validAnnulus ? annulusArea(outerDiameterMm, coreDiameterMm) : 0;
  const sideAreaM2 = validAnnulus ? 2 * Math.PI * coreRadiusM * lengthM * grainCount * coreSurface : 0;
  const outsideAreaM2 = validAnnulus ? 2 * Math.PI * outerRadiusM * lengthM * grainCount * outerSurface : 0;
  const endAreaM2 = endAnnulusM2 * grainCount * endFaceCount;
  const volumeM3 = endAnnulusM2 * lengthM * grainCount;
  return {
    burnAreaM2: Math.max(sideAreaM2 + outsideAreaM2 + endAreaM2, 0),
    volumeM3,
    portAreaM2,
    portDiameterMm: coreDiameterMm,
    lengthMm,
    outerDiameterMm
  };
}

function nozzleShapeEfficiency(parameters: MotorParameters, profile: SolidPropellantProfile) {
  const divergenceAngleRad = clamp(parameters.divergenceAngleDeg ?? 24, 1, 45) * Math.PI / 180;
  const divergenceEfficiency = (1 + Math.cos(divergenceAngleRad)) / 2;
  return clamp(profile.nozzleEfficiency * divergenceEfficiency, 0.72, 1);
}

function areaMachRatio(mach: number, gamma: number) {
  const term = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach ** 2);
  return (1 / mach) * term ** ((gamma + 1) / (2 * (gamma - 1)));
}

function solveSupersonicMachForAreaRatio(areaRatio: number, gamma: number) {
  const target = Math.max(areaRatio, 1);
  let low = 1.0001;
  let high = 8;

  for (let index = 0; index < 72; index += 1) {
    const mid = (low + high) / 2;
    if (areaMachRatio(mid, gamma) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function isentropicStaticPressure(totalPressurePa: number, mach: number, gamma: number) {
  return totalPressurePa * (1 + ((gamma - 1) / 2) * mach ** 2) ** (-gamma / (gamma - 1));
}

function isentropicStaticTemperature(totalTemperatureK: number, mach: number, gamma: number) {
  return totalTemperatureK / (1 + ((gamma - 1) / 2) * mach ** 2);
}

export type NozzleFlowAnalysis = {
  gamma: number;
  chamberPressureMPa: number;
  throatDiameterMm: number;
  exitDiameterMm: number;
  areaRatio: number;
  exitMach: number;
  exitPressureMPa: number;
  exitTemperatureK: number;
  exitVelocityMS: number;
  pressureRatio: number;
  expansionState: "underexpanded" | "near-optimum" | "overexpanded";
  nozzleEfficiency: number;
  thrustCoefficient: number;
  optimumExpansionRatio: number;
};

export function analyzeNozzleFlow(parameters: MotorParameters, chamberPressureMPa?: number): NozzleFlowAnalysis {
  const profile = getProfile(parameters);
  const gamma = profile.specificHeatRatio;
  const chamberPressurePa = Math.max((chamberPressureMPa ?? 2.5) * 1_000_000, MIN_PRESSURE_PA);
  const throatDiameterMm = Math.max(parameters.nozzleThroatMm, 0.1);
  const exitDiameterMm = Math.max(parameters.nozzleExitMm, throatDiameterMm);
  const areaRatio = Math.max((exitDiameterMm / throatDiameterMm) ** 2, 1);
  const exitMach = solveSupersonicMachForAreaRatio(areaRatio, gamma);
  const exitPressurePa = isentropicStaticPressure(chamberPressurePa, exitMach, gamma);
  const exitTemperatureK = isentropicStaticTemperature(profile.temperatureK, exitMach, gamma);
  const gasConstant = UNIVERSAL_GAS_CONSTANT / profile.molarMassKgKmol;
  const exitVelocityMS = exitMach * Math.sqrt(gamma * gasConstant * exitTemperatureK);
  const pressureRatio = exitPressurePa / PATM_PA;
  const expansionState =
    pressureRatio > 1.18 ? "underexpanded" :
    pressureRatio < 0.82 ? "overexpanded" :
    "near-optimum";
  const nozzleEfficiency = nozzleShapeEfficiency(parameters, profile);
  const thrustCoefficient = deliveredThrustCoefficient(chamberPressurePa, areaRatio, profile, nozzleEfficiency);
  const optimumRatio = optimumExpansionRatio(chamberPressurePa, profile);

  return {
    gamma,
    chamberPressureMPa: Number((chamberPressurePa / 1_000_000).toFixed(3)),
    throatDiameterMm,
    exitDiameterMm,
    areaRatio: Number(areaRatio.toFixed(3)),
    exitMach: Number(exitMach.toFixed(3)),
    exitPressureMPa: Number((exitPressurePa / 1_000_000).toFixed(4)),
    exitTemperatureK: Math.round(exitTemperatureK),
    exitVelocityMS: Math.round(exitVelocityMS),
    pressureRatio: Number(pressureRatio.toFixed(3)),
    expansionState,
    nozzleEfficiency,
    thrustCoefficient: Number(thrustCoefficient.toFixed(3)),
    optimumExpansionRatio: Number(optimumRatio.toFixed(2))
  };
}

function deliveredThrustCoefficient(pressurePa: number, expansionRatio: number, profile: SolidPropellantProfile, nozzleEfficiency: number) {
  const gamma = profile.specificHeatRatio;
  const exitMach = solveSupersonicMachForAreaRatio(Math.max(expansionRatio, 1), gamma);
  const exitPressurePa = isentropicStaticPressure(Math.max(pressurePa, MIN_PRESSURE_PA), exitMach, gamma);
  const pressureRatio = clamp(exitPressurePa / Math.max(pressurePa, MIN_PRESSURE_PA), 0.0001, 0.99);
  const idealCf = Math.sqrt(
    ((2 * gamma ** 2) / (gamma - 1)) *
    (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)) *
    (1 - pressureRatio ** ((gamma - 1) / gamma))
  );
  const pressureCorrection = ((exitPressurePa - PATM_PA) / Math.max(pressurePa, MIN_PRESSURE_PA)) * expansionRatio;
  return Math.max(0.2, nozzleEfficiency * idealCf + pressureCorrection);
}

function optimumExpansionRatio(pressurePa: number, profile: SolidPropellantProfile) {
  const gamma = profile.specificHeatRatio;
  const ratio = clamp(PATM_PA / Math.max(pressurePa, MIN_PRESSURE_PA), 0.0001, 0.99);
  const denom =
    ((gamma + 1) / 2) ** (1 / (gamma - 1)) *
    ratio ** (1 / gamma) *
    Math.sqrt(((gamma + 1) / (gamma - 1)) * (1 - ratio ** ((gamma - 1) / gamma)));
  return denom > 0 ? 1 / denom : 1;
}

function segmentForPressure(profile: SolidPropellantProfile, pressureMPa: number) {
  return profile.burnRateSegments.find((segment) => pressureMPa >= segment.minPressureMPa && pressureMPa <= segment.maxPressureMPa)
    ?? (pressureMPa < profile.burnRateSegments[0].minPressureMPa
      ? profile.burnRateSegments[0]
      : profile.burnRateSegments[profile.burnRateSegments.length - 1]);
}

function burnRateForProfile(profile: SolidPropellantProfile, pressureMPa: number) {
  const segment = segmentForPressure(profile, Math.max(pressureMPa, 0));
  return segment.coefficientMmSMPaN * Math.pow(Math.max(pressureMPa, 0.001), segment.exponent);
}

export function evaluatePropellantBurnRate(profileName: string, pressureMPa: number) {
  const aliasedName = PROFILE_ALIASES[profileName] ?? profileName;
  const profile = PROFILE_ENERGY[aliasedName] ?? PROFILE_ENERGY["KNSB 65/35 - strand-burner data"];
  return burnRateForProfile(profile, pressureMPa);
}

function deliveredCombustionVelocity(profile: SolidPropellantProfile) {
  return profile.characteristicVelocityMS * profile.combustionEfficiency;
}

function nozzleMassFlowKgS(pressurePa: number, throatAreaM2: number, profile: SolidPropellantProfile) {
  if (pressurePa <= PATM_PA || throatAreaM2 <= 0) return 0;
  const gamma = profile.specificHeatRatio;
  const pressureRatio = PATM_PA / pressurePa;
  const criticalRatio = Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
  const deliveredCStar = deliveredCombustionVelocity(profile);
  if (pressureRatio <= criticalRatio) return pressurePa * throatAreaM2 / deliveredCStar;

  const gasConstant = UNIVERSAL_GAS_CONSTANT / profile.molarMassKgKmol;
  const flowTerm = Math.max(
    0,
    (2 * gamma / (gasConstant * profile.temperatureK * (gamma - 1))) *
      (Math.pow(pressureRatio, 2 / gamma) - Math.pow(pressureRatio, (gamma + 1) / gamma))
  );
  const idealSubsonicFlow = throatAreaM2 * pressurePa * Math.sqrt(flowTerm);
  const idealChokedFactor = Math.sqrt(gamma / (gasConstant * profile.temperatureK)) *
    Math.pow(2 / (gamma + 1), (gamma + 1) / (2 * (gamma - 1)));
  const idealChokedFlow = throatAreaM2 * pressurePa * idealChokedFactor;
  const calibratedChokedFlow = pressurePa * throatAreaM2 / deliveredCStar;
  return idealChokedFlow > 0 ? idealSubsonicFlow * (calibratedChokedFlow / idealChokedFlow) : 0;
}

function nozzleThrustN(pressurePa: number, massFlowKgS: number, throatAreaM2: number, expansionRatio: number, profile: SolidPropellantProfile, nozzleEfficiency: number) {
  if (pressurePa <= PATM_PA || massFlowKgS <= 0) return 0;
  const gamma = profile.specificHeatRatio;
  const pressureRatio = PATM_PA / pressurePa;
  const criticalRatio = Math.pow(2 / (gamma + 1), gamma / (gamma - 1));
  if (pressureRatio <= criticalRatio) {
    const cf = deliveredThrustCoefficient(pressurePa, expansionRatio, profile, nozzleEfficiency);
    return Math.max(0, cf * pressurePa * throatAreaM2);
  }

  const gasConstant = UNIVERSAL_GAS_CONSTANT / profile.molarMassKgKmol;
  const exitVelocity = Math.sqrt(Math.max(
    0,
    (2 * gamma / (gamma - 1)) * gasConstant * profile.temperatureK *
      (1 - Math.pow(pressureRatio, (gamma - 1) / gamma))
  ));
  return Math.max(0, massFlowKgS * exitVelocity * nozzleEfficiency);
}

function validateSimulationInputs(parameters: MotorParameters) {
  const warnings = [
    "This is a sourced pre-flight prediction, not a measured or certified motor curve.",
    "Rocketry House does not certify motor safety."
  ];
  if (parameters.grainOuterDiameterMm > parameters.casingInnerDiameterMm) warnings.push("Grain outer diameter should fit inside the combustion chamber diameter.");
  if (parameters.grainCount * parameters.grainLengthMm > parameters.casingLengthMm) warnings.push("Grain stack length exceeds chamber length; reduce segments or segment length.");
  if (parameters.coreDiameterMm >= parameters.grainOuterDiameterMm) warnings.push("Core diameter must be smaller than grain outer diameter.");
  if (parameters.grainConfiguration === "C-slot" && (parameters.slotOffsetMm ?? 0) >= parameters.grainOuterDiameterMm / 2) warnings.push("C-slot offset should remain smaller than the grain radius in this analysis model.");
  if (parameters.coreDiameterMm >= parameters.grainOuterDiameterMm * 0.72) warnings.push("Core diameter leaves a very thin grain web for this simplified model.");
  if (parameters.nozzleThroatMm < 2 || parameters.nozzleThroatMm > parameters.casingInnerDiameterMm * 0.45) warnings.push("Nozzle throat is outside the recommended analysis range.");
  if (parameters.dryMassG > 25_000) warnings.push("Large dry mass: review transport, storage, club, and launch site requirements.");
  if (parameters.grainCount > 8) warnings.push("Many grain segments increase alignment and inspection complexity.");
  if (!["BATES", "Hollow cylinder", "End burner"].includes(parameters.grainConfiguration ?? "BATES")) {
    warnings.push(`${parameters.grainConfiguration} is evaluated as an equivalent circular port because the current input deck does not define its complete perimeter. No empirical burn-area multiplier is applied.`);
  }
  return warnings;
}

export function simulateMotor(parameters: MotorParameters): MotorSimulationResult {
  const profile = getProfile(parameters);
  const throatAreaM2 = circleArea(parameters.nozzleThroatMm);
  const expansionRatio = Math.max((parameters.nozzleExitMm / Math.max(parameters.nozzleThroatMm, 0.1)) ** 2, 1);
  const effectiveNozzleEfficiency = nozzleShapeEfficiency(parameters, profile);
  const initialGeometry = estimateBurnGeometry(parameters, 0);
  const initialPropellantMassKg = initialGeometry.volumeM3 * profile.densityKgM3;
  const initialPtoT = initialGeometry.portAreaM2 / Math.max(throatAreaM2, 1e-9);
  const warnings = validateSimulationInputs(parameters);
  const curve: MotorCurvePoint[] = [{
    time: 0,
    thrust: 0,
    pressure: 0,
    kn: 0,
    impulse: 0,
    portDiameterMm: parameters.coreDiameterMm,
    massRemainingG: Math.round(initialPropellantMassKg * 1000),
    massFlowKgS: 0,
    burnAreaCm2: 0,
    burnRateMmS: 0,
    specificImpulseS: 0
  }];

  const chamberVolumeM3 = circleArea(parameters.casingInnerDiameterMm) * (parameters.casingLengthMm / MM);
  const initialFreeVolumeM3 = Math.max(chamberVolumeM3 - initialGeometry.volumeM3, 1e-6);
  const gasConstant = UNIVERSAL_GAS_CONSTANT / profile.molarMassKgKmol;
  const dt = 0.001;
  const sampleEverySteps = 20;
  const maxSteps = 120_000;
  let time = 0;
  let webMm = 0;
  let remainingMassKg = initialPropellantMassKg;
  let chamberPressurePa = PATM_PA;
  let chamberGasMassKg = PATM_PA * initialFreeVolumeM3 / (gasConstant * profile.temperatureK);
  let impulseNs = 0;
  let peakThrustN = 0;
  let pressureTimeIntegral = 0;
  let activePressureTime = 0;
  let maxPressureMPa = 0;
  let optimumExpansionSum = 0;
  let optimumExpansionSamples = 0;
  let pressureLimitReached = false;

  for (let step = 0; step < maxSteps; step += 1) {
    const geometry = estimateBurnGeometry(parameters, webMm);
    const stepPressurePa = chamberPressurePa;
    const geometryMassRemainingKg = geometry.volumeM3 * profile.densityKgM3;
    const burning = geometry.burnAreaM2 > 0 && geometry.volumeM3 > 0 && throatAreaM2 > 0;
    const kn = burning ? geometry.burnAreaM2 / throatAreaM2 : 0;
    const burnRateMmS = burning ? burnRateForProfile(profile, stepPressurePa / 1_000_000) : 0;
    const nextWebMm = webMm + burnRateMmS * dt;
    const nextGeometry = burning ? estimateBurnGeometry(parameters, nextWebMm) : geometry;
    const justBurnedOut = geometry.volumeM3 > 0 && nextGeometry.volumeM3 <= 0;
    const generatedMassKg = burning
      ? Math.min(remainingMassKg, Math.max(0, geometry.volumeM3 - nextGeometry.volumeM3) * profile.densityKgM3)
      : 0;
    const massFlowKgS = nozzleMassFlowKgS(stepPressurePa, throatAreaM2, profile);
    const exhaustedMassKg = Math.min(chamberGasMassKg + generatedMassKg, massFlowKgS * dt);
    const thrustN = nozzleThrustN(stepPressurePa, massFlowKgS, throatAreaM2, expansionRatio, profile, effectiveNozzleEfficiency);
    const specificImpulseS = massFlowKgS > 0 ? thrustN / (massFlowKgS * G0) : 0;

    time += dt;
    webMm = nextWebMm;
    remainingMassKg = Math.max(0, nextGeometry.volumeM3 * profile.densityKgM3);
    chamberGasMassKg = Math.max(0, chamberGasMassKg + generatedMassKg - exhaustedMassKg);
    const freeVolumeM3 = Math.max(chamberVolumeM3 - nextGeometry.volumeM3, 1e-6);
    chamberPressurePa = Math.max(PATM_PA, chamberGasMassKg * gasConstant * profile.temperatureK / freeVolumeM3);
    impulseNs += thrustN * dt;
    peakThrustN = Math.max(peakThrustN, thrustN);
    maxPressureMPa = Math.max(maxPressureMPa, stepPressurePa / 1_000_000, chamberPressurePa / 1_000_000);
    if (thrustN > 0) {
      pressureTimeIntegral += (stepPressurePa / 1_000_000) * dt;
      activePressureTime += dt;
      optimumExpansionSum += optimumExpansionRatio(stepPressurePa, profile);
      optimumExpansionSamples += 1;
    }

    if (step % sampleEverySteps === 0 || justBurnedOut || chamberPressurePa >= MAX_MODEL_PRESSURE_PA) {
      curve.push({
        time: Number(time.toFixed(3)),
        thrust: Math.round(thrustN),
        pressure: Number((stepPressurePa / 1_000_000).toFixed(3)),
        kn: Number(kn.toFixed(2)),
        impulse: Math.round(impulseNs),
        portDiameterMm: Number(geometry.portDiameterMm.toFixed(2)),
        massRemainingG: Math.max(0, Math.round(geometryMassRemainingKg * 1000)),
        massFlowKgS: Number(massFlowKgS.toFixed(4)),
        burnAreaCm2: Number((geometry.burnAreaM2 * 10000).toFixed(2)),
        burnRateMmS: Number(burnRateMmS.toFixed(3)),
        specificImpulseS: Number(specificImpulseS.toFixed(1))
      });
    }

    if (!Number.isFinite(chamberPressurePa) || chamberPressurePa >= MAX_MODEL_PRESSURE_PA) {
      pressureLimitReached = true;
      break;
    }
    if (!burning && chamberPressurePa <= PATM_PA * 1.005 && time > 0.05) break;
  }

  curve.push({
    time: Number((time + dt).toFixed(3)),
    thrust: 0,
    pressure: 0,
    kn: 0,
    impulse: Math.round(impulseNs),
    portDiameterMm: parameters.grainOuterDiameterMm,
    massRemainingG: Math.max(0, Math.round(remainingMassKg * 1000)),
    massFlowKgS: 0,
    burnAreaCm2: 0,
    burnRateMmS: 0,
    specificImpulseS: 0
  });

  const pressureRange = [profile.burnRateSegments[0].minPressureMPa, profile.burnRateSegments[profile.burnRateSegments.length - 1].maxPressureMPa] as const;
  if (!profile.calibrated) warnings.push("The selected propellant profile has no formulation-specific calibration; its curve is not suitable for quantitative use.");
  if (maxPressureMPa > pressureRange[1]) warnings.push(`Peak pressure exceeds the sourced ${pressureRange[1]} MPa burn-rate range; the final segment is extrapolated.`);
  if (pressureLimitReached) warnings.push(`The pressure integration stopped at ${(MAX_MODEL_PRESSURE_PA / 1_000_000).toFixed(0)} MPa, outside the supported numerical envelope.`);
  if (initialPtoT < 2) warnings.push("Initial port-to-throat ratio is low; JSRM-style solvers flag this as a pressure and erosive-flow risk.");
  if (initialPtoT > 30) warnings.push("Initial port-to-throat ratio is high; the motor may underperform relative to the nozzle throat.");
  if ((parameters.divergenceAngleDeg ?? 24) > 20) warnings.push("Wide divergence angle reduces delivered nozzle efficiency in this estimate; compare against measured thrust data.");
  if (profile.characteristicVelocityBasis === "theoretical") warnings.push("The selected profile uses theoretical c-star because a formulation-specific measured value is not available.");

  const activeThreshold = peakThrustN * 0.05;
  const activeCurve = curve.filter((point) => point.thrust >= activeThreshold && point.thrust > 0);
  const burnTimeS = activeCurve.length > 1
    ? Number((activeCurve[activeCurve.length - 1].time - activeCurve[0].time).toFixed(3))
    : Number(time.toFixed(3));
  const totalImpulseNs = Math.round(impulseNs);
  const averageThrustN = burnTimeS > 0 ? Math.round(totalImpulseNs / burnTimeS) : 0;
  const averagePressureMPa = activePressureTime > 0 ? pressureTimeIntegral / activePressureTime : 0;
  const consumedPropellantMassKg = Math.max(0, initialPropellantMassKg - remainingMassKg);
  const averageSpecificImpulseS = consumedPropellantMassKg > 0 ? impulseNs / (consumedPropellantMassKg * G0) : 0;
  const optimumExpansion = optimumExpansionSamples ? optimumExpansionSum / optimumExpansionSamples : expansionRatio;

  return {
    engineId: JSRM_ENGINE_ID,
    engineName: "Transient 0D SRM internal ballistics",
    engineSource: JSRM_SOURCE,
    modelNotes: [
      "Integrates chamber gas mass, free volume, pressure, nozzle outflow, thrust, and grain regression at a 1 ms time step.",
      "BATES and hollow-cylinder surfaces regress radially and axially from the selected exposed faces; no empirical geometry multipliers are used.",
      `Burn rate uses ${profile.burnRateSegments.length} pressure regime${profile.burnRateSegments.length === 1 ? "" : "s"} from ${profile.sourceLabel}.`,
      `c-star basis: ${profile.characteristicVelocityBasis}; conical divergence correction ${(effectiveNozzleEfficiency * 100).toFixed(1)}%. Static-fire calibration is still required for a measured prediction.`
    ],
    totalImpulseNs,
    averageThrustN,
    peakThrustN: Math.round(peakThrustN),
    burnTimeS,
    motorClass: estimateMotorClass(totalImpulseNs),
    propellantMassG: Math.round(initialPropellantMassKg * 1000),
    estimatedLoadedMassG: Math.round(parameters.dryMassG + initialPropellantMassKg * 1000),
    averagePressureMPa: Number(averagePressureMPa.toFixed(3)),
    maxPressureMPa: Number(maxPressureMPa.toFixed(3)),
    averageSpecificImpulseS: Number(averageSpecificImpulseS.toFixed(1)),
    combustionEfficiency: profile.combustionEfficiency,
    nozzleEfficiency: effectiveNozzleEfficiency,
    deliveredCharacteristicVelocityMS: Math.round(deliveredCombustionVelocity(profile)),
    optimumExpansionRatio: Number(optimumExpansion.toFixed(2)),
    portToThroatRatio: Number(initialPtoT.toFixed(2)),
    curve,
    warnings
  };
}
