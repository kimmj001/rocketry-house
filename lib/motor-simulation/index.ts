import type { MotorCurvePoint, MotorParameters, MotorSimulationResult } from "@/types/motor";

type SolidPropellantProfile = {
  label: string;
  densityKgM3: number;
  burnRateA: number;
  pressureExponent: number;
  characteristicVelocityMS: number;
  specificHeatRatio: number;
  combustionEfficiency: number;
  nozzleEfficiency: number;
  temperatureK: number;
};

export const JSRM_ENGINE_ID = "jsrm-compatible-srm-v0.2";
const JSRM_SOURCE = "Modeled after the JSRM/Nakka SRM spreadsheet workflow with an independent Rocketry House adapter.";
const G0 = 9.80665;
const PATM_PA = 101_325;
const MM = 1000;
const MIN_PRESSURE_PA = 120_000;
const UNIVERSAL_GAS_CONSTANT = 8_314.462618;
const DEFAULT_PRODUCTS_MOLAR_MASS_KG_KMOL = 40;

const PROFILE_ENERGY: Record<string, SolidPropellantProfile> = {
  "KNSB sorbitol family metadata": {
    label: "KNSB sorbitol family metadata",
    densityKgM3: 1841,
    burnRateA: 5.13,
    pressureExponent: 0.222,
    characteristicVelocityMS: 1030,
    specificHeatRatio: 1.133,
    combustionEfficiency: 0.85,
    nozzleEfficiency: 0.95,
    temperatureK: 1600
  },
  "KNDX dextrose family metadata": {
    label: "KNDX dextrose family metadata",
    densityKgM3: 1879,
    burnRateA: 5.42,
    pressureExponent: 0.22,
    characteristicVelocityMS: 1040,
    specificHeatRatio: 1.13,
    combustionEfficiency: 0.85,
    nozzleEfficiency: 0.95,
    temperatureK: 1620
  },
  "APCP family public metadata": {
    label: "APCP family public metadata",
    densityKgM3: 1680,
    burnRateA: 4.8,
    pressureExponent: 0.31,
    characteristicVelocityMS: 1450,
    specificHeatRatio: 1.18,
    combustionEfficiency: 0.9,
    nozzleEfficiency: 0.94,
    temperatureK: 2850
  },
  "Certified commercial curve metadata": {
    label: "Certified commercial curve metadata",
    densityKgM3: 1700,
    burnRateA: 4.3,
    pressureExponent: 0.29,
    characteristicVelocityMS: 1380,
    specificHeatRatio: 1.17,
    combustionEfficiency: 0.9,
    nozzleEfficiency: 0.93,
    temperatureK: 2500
  },
  "Undisclosed educational estimate": {
    label: "Undisclosed educational estimate",
    densityKgM3: 1660,
    burnRateA: 3.8,
    pressureExponent: 0.24,
    characteristicVelocityMS: 1060,
    specificHeatRatio: 1.14,
    combustionEfficiency: 0.85,
    nozzleEfficiency: 0.9,
    temperatureK: 1700
  }
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
  propellantProfileName: "KNSB sorbitol family metadata",
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

export const propellantProfiles = Object.values(PROFILE_ENERGY).map((profile) => profile.label);

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
  return PROFILE_ENERGY[parameters.propellantProfileName] ?? PROFILE_ENERGY["KNSB sorbitol family metadata"];
}

function estimateInitialPropellantMass(parameters: MotorParameters, profile: SolidPropellantProfile) {
  const grainVolume = annulusArea(parameters.grainOuterDiameterMm, parameters.coreDiameterMm) * (parameters.grainLengthMm / MM) * parameters.grainCount;
  return grainVolume * profile.densityKgM3;
}

function estimateBurnGeometry(parameters: MotorParameters, webMm: number) {
  const grainCount = Math.max(1, parameters.grainCount);
  const lengthM = Math.max(parameters.grainLengthMm / MM, 0);
  const outerDiameterMm = Math.max(parameters.grainOuterDiameterMm, 0);
  const outerRadiusM = outerDiameterMm / 2 / MM;
  const coreDiameterMm = Math.max(parameters.coreDiameterMm + webMm * 2, 0);
  const coreRadiusM = coreDiameterMm / 2 / MM;
  const coreSurface = surfaceFactor(parameters.coreSurface);
  const outerSurface = surfaceFactor(parameters.outerSurface);
  const endsSurface = surfaceFactor(parameters.endsSurface);
  const portAreaM2 = circleArea(coreDiameterMm);
  const endAnnulusM2 = annulusArea(outerDiameterMm, coreDiameterMm);
  const sideAreaM2 = 2 * Math.PI * coreRadiusM * lengthM * grainCount * coreSurface;
  const outsideAreaM2 = 2 * Math.PI * outerRadiusM * lengthM * grainCount * outerSurface;
  const endAreaM2 = endAnnulusM2 * grainCount * 2 * endsSurface;
  const config = parameters.grainConfiguration ?? "BATES";

  if (config === "End burner") {
    return {
      burnAreaM2: Math.max(circleArea(outerDiameterMm), 0) * grainCount,
      volumeM3: Math.max(circleArea(outerDiameterMm) * Math.max(lengthM - webMm / MM, 0), 0) * grainCount,
      portAreaM2: Math.max(circleArea(parameters.nozzleThroatMm), portAreaM2),
      portDiameterMm: coreDiameterMm
    };
  }

  let multiplier = 1;
  if (config === "Hollow cylinder") multiplier = 1;
  if (config === "Finocyl") multiplier = 1.34;
  if (config === "Moon burner") multiplier = 1.12 + clamp((parameters.slotOffsetMm ?? 0) / Math.max(outerDiameterMm, 1), 0, 0.35);
  if (config === "C-slot") multiplier = 1.18 + clamp((parameters.slotDepthMm ?? 0) / Math.max(outerDiameterMm, 1), 0, 0.45);
  if (config === "Rod and tube") multiplier = 1.28;
  if (config === "Star") multiplier = 1.45;
  if (config === "Custom") multiplier = 1.1;

  const remainingOuterDiameterMm = Math.max(outerDiameterMm - webMm * 2 * outerSurface, coreDiameterMm + 0.1);
  const volumeM3 = Math.max(annulusArea(remainingOuterDiameterMm, coreDiameterMm) * lengthM * grainCount, 0);
  return {
    burnAreaM2: Math.max((sideAreaM2 + outsideAreaM2 + endAreaM2) * multiplier, 0),
    volumeM3,
    portAreaM2,
    portDiameterMm: coreDiameterMm
  };
}

function nozzleShapeEfficiency(parameters: MotorParameters, profile: SolidPropellantProfile) {
  const divergenceAngleRad = clamp(parameters.divergenceAngleDeg ?? 24, 1, 45) * Math.PI / 180;
  const convergenceAngle = clamp(parameters.convergenceAngleDeg ?? 60, 15, 80);
  const divergenceEfficiency = (1 + Math.cos(divergenceAngleRad)) / 2;
  const convergenceRecovery =
    convergenceAngle < 25 ? 0.96 :
    convergenceAngle > 70 ? 0.94 :
    0.99;
  return clamp(profile.nozzleEfficiency * divergenceEfficiency * convergenceRecovery, 0.72, 0.99);
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
  const gasConstant = UNIVERSAL_GAS_CONSTANT / DEFAULT_PRODUCTS_MOLAR_MASS_KG_KMOL;
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

function pressureFromKn(kn: number, profile: SolidPropellantProfile, throatAreaM2: number) {
  const aMetersPerSecond = profile.burnRateA / MM;
  const deliveredCharacteristicVelocityMS = profile.characteristicVelocityMS * profile.combustionEfficiency;
  const base =
    (profile.densityKgM3 * aMetersPerSecond * deliveredCharacteristicVelocityMS * Math.max(kn, 0)) /
    Math.pow(1_000_000, profile.pressureExponent);
  if (base <= 0 || throatAreaM2 <= 0) return 0;
  return Math.pow(base, 1 / (1 - profile.pressureExponent));
}

function deliveredCombustionVelocity(profile: SolidPropellantProfile) {
  return profile.characteristicVelocityMS * profile.combustionEfficiency;
}

function effectiveBurnParticipation(parameters: MotorParameters, initialPtoT: number) {
  const singlePortSmallMotor =
    (parameters.grainConfiguration === "Hollow cylinder" || parameters.grainConfiguration === "BATES") &&
    parameters.grainCount === 1 &&
    parameters.coreSurface !== "Inhibited" &&
    parameters.outerSurface === "Inhibited" &&
    parameters.endsSurface !== "Inhibited";

  if (!singlePortSmallMotor) return 1;

  const portStress = initialPtoT < 2.4 ? clamp(initialPtoT / 2.4, 0.72, 1) : 1;
  const slenderness = parameters.grainLengthMm / Math.max(parameters.grainOuterDiameterMm, 1);
  const endParticipation = clamp(0.82 + slenderness * 0.03, 0.82, 0.92);
  return Number((portStress * endParticipation).toFixed(3));
}

function validateSimulationInputs(parameters: MotorParameters) {
  const warnings = [
    "Motor simulations are estimates and must not be treated as safety certification.",
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
  return warnings;
}

export function simulateMotor(parameters: MotorParameters): MotorSimulationResult {
  const profile = getProfile(parameters);
  const throatAreaM2 = circleArea(parameters.nozzleThroatMm);
  const expansionRatio = Math.max((parameters.nozzleExitMm / Math.max(parameters.nozzleThroatMm, 0.1)) ** 2, 1);
  const effectiveNozzleEfficiency = nozzleShapeEfficiency(parameters, profile);
  const initialPropellantMassKg = estimateInitialPropellantMass(parameters, profile);
  const initialGeometry = estimateBurnGeometry(parameters, 0);
  const initialPtoT = initialGeometry.portAreaM2 / Math.max(throatAreaM2, 1e-9);
  const burnParticipation = effectiveBurnParticipation(parameters, initialPtoT);
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

  let time = 0;
  let webMm = 0;
  let remainingMassKg = initialPropellantMassKg;
  let impulseNs = 0;
  let peakThrustN = 0;
  let pressureSum = 0;
  let pressureSamples = 0;
  let ispSum = 0;
  let ispSamples = 0;
  let maxPressureMPa = 0;
  let optimumExpansionSum = 0;
  let optimumExpansionSamples = 0;
  const dt = 0.01;
  const maxWebMm = Math.max((parameters.grainOuterDiameterMm - parameters.coreDiameterMm) / 2, 0);

  for (let step = 0; step < 6000; step += 1) {
    const geometry = estimateBurnGeometry(parameters, webMm);
    if (geometry.burnAreaM2 <= 0 || remainingMassKg <= 0 || throatAreaM2 <= 0) break;

    const effectiveBurnAreaM2 = geometry.burnAreaM2 * burnParticipation;
    const kn = effectiveBurnAreaM2 / throatAreaM2;
    const chamberPressurePa = pressureFromKn(kn, profile, throatAreaM2);
    const burnRateMmS = profile.burnRateA * Math.pow(Math.max(chamberPressurePa / 1_000_000, 0), profile.pressureExponent);
    const massFlowKgS = profile.densityKgM3 * effectiveBurnAreaM2 * (burnRateMmS / MM);
    const cf = deliveredThrustCoefficient(chamberPressurePa, expansionRatio, profile, effectiveNozzleEfficiency);
    const thrustN = cf * chamberPressurePa * throatAreaM2;
    const consumedKg = Math.min(remainingMassKg, massFlowKgS * dt);
    const specificImpulseS = massFlowKgS > 0 ? thrustN / (massFlowKgS * G0) : 0;

    time += dt;
    webMm += burnRateMmS * dt;
    remainingMassKg -= consumedKg;
    impulseNs += thrustN * dt;
    peakThrustN = Math.max(peakThrustN, thrustN);
    maxPressureMPa = Math.max(maxPressureMPa, chamberPressurePa / 1_000_000);
    pressureSum += chamberPressurePa / 1_000_000;
    pressureSamples += 1;
    if (specificImpulseS > 0) {
      ispSum += specificImpulseS;
      ispSamples += 1;
    }
    optimumExpansionSum += optimumExpansionRatio(chamberPressurePa, profile);
    optimumExpansionSamples += 1;

    if (step % 10 === 0 || remainingMassKg <= 0 || webMm >= maxWebMm) {
      curve.push({
        time: Number(time.toFixed(3)),
        thrust: Math.round(thrustN),
        pressure: Number((chamberPressurePa / 1_000_000).toFixed(3)),
        kn: Number(kn.toFixed(2)),
        impulse: Math.round(impulseNs),
        portDiameterMm: Number(geometry.portDiameterMm.toFixed(2)),
        massRemainingG: Math.max(0, Math.round(remainingMassKg * 1000)),
        massFlowKgS: Number(massFlowKgS.toFixed(4)),
        burnAreaCm2: Number((effectiveBurnAreaM2 * 10000).toFixed(2)),
        burnRateMmS: Number(burnRateMmS.toFixed(3)),
        specificImpulseS: Number(specificImpulseS.toFixed(1))
      });
    }

    if (remainingMassKg <= 0 || webMm >= maxWebMm || !Number.isFinite(chamberPressurePa) || chamberPressurePa <= 0) break;
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

  if (maxPressureMPa > 8) warnings.push("Calculated chamber pressure is high for this analysis envelope; review assumptions with qualified supervision.");
  if (initialPtoT < 2) warnings.push("Initial port-to-throat ratio is low; JSRM-style solvers flag this as a pressure and erosive-flow risk.");
  if (initialPtoT > 30) warnings.push("Initial port-to-throat ratio is high; the motor may underperform relative to the nozzle throat.");
  if (burnParticipation < 0.98) warnings.push("Small single-port geometry correction is active; compare with measured static-fire data before drawing performance conclusions.");
  if ((parameters.divergenceAngleDeg ?? 24) > 20) warnings.push("Wide divergence angle reduces delivered nozzle efficiency in this estimate; compare against measured thrust data.");

  const burnTimeS = Number(time.toFixed(3));
  const totalImpulseNs = Math.round(impulseNs);
  const averageThrustN = burnTimeS > 0 ? Math.round(totalImpulseNs / burnTimeS) : 0;
  const averagePressureMPa = pressureSamples ? pressureSum / pressureSamples : 0;
  const averageSpecificImpulseS = ispSamples ? ispSum / ispSamples : 0;
  const optimumExpansion = optimumExpansionSamples ? optimumExpansionSum / optimumExpansionSamples : expansionRatio;

  return {
    engineId: JSRM_ENGINE_ID,
    engineName: "JSRM-compatible SRM internal ballistics",
    engineSource: JSRM_SOURCE,
    modelNotes: [
      "Uses JSRM/Nakka-style grain geometry, Kn, pressure, mass-flow, nozzle coefficient, and impulse integration.",
      `Delivered-performance factors: combustion efficiency ${(profile.combustionEfficiency * 100).toFixed(0)}%, geometry-adjusted nozzle efficiency ${(effectiveNozzleEfficiency * 100).toFixed(0)}%; these are not certification values.`,
      "Supports BATES/Hollow cylinder, C-slot, End burner, Finocyl, Moon burner, Rod and tube, Star, and Custom geometry factors.",
      "The adapter is structured so a future dedicated JSRM calculation service can be plugged in without changing the UI contract."
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
