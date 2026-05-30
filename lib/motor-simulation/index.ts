import type { MotorCurvePoint, MotorParameters, MotorSimulationResult } from "@/types/motor";

type EducationalProfile = {
  label: string;
  densityKgM3: number;
  burnRateMmSAt1Mpa: number;
  pressureExponent: number;
  characteristicVelocityMS: number;
  thrustCoefficient: number;
};

const PROFILE_ENERGY: Record<string, EducationalProfile> = {
  "KNSB sorbitol family metadata": { label: "KNSB sorbitol family metadata", densityKgM3: 1840, burnRateMmSAt1Mpa: 2.9, pressureExponent: 0.32, characteristicVelocityMS: 1200, thrustCoefficient: 1.32 },
  "KNDX dextrose family metadata": { label: "KNDX dextrose family metadata", densityKgM3: 1870, burnRateMmSAt1Mpa: 3.25, pressureExponent: 0.33, characteristicVelocityMS: 1230, thrustCoefficient: 1.34 },
  "APCP family public metadata": { label: "APCP family public metadata", densityKgM3: 1680, burnRateMmSAt1Mpa: 4.2, pressureExponent: 0.34, characteristicVelocityMS: 1450, thrustCoefficient: 1.44 },
  "Certified commercial curve placeholder": { label: "Certified commercial curve placeholder", densityKgM3: 1700, burnRateMmSAt1Mpa: 3.55, pressureExponent: 0.31, characteristicVelocityMS: 1380, thrustCoefficient: 1.4 },
  "Undisclosed educational estimate": { label: "Undisclosed educational estimate", densityKgM3: 1660, burnRateMmSAt1Mpa: 2.65, pressureExponent: 0.32, characteristicVelocityMS: 1220, thrustCoefficient: 1.32 }
};

export const defaultMotorParameters: MotorParameters = {
  projectName: "H178 Static-Fire Motor",
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

export function simulateMotor(parameters: MotorParameters): MotorSimulationResult {
  const profile = PROFILE_ENERGY[parameters.propellantProfileName] ?? PROFILE_ENERGY["KNSB sorbitol family metadata"];
  const grainOuterRadiusM = parameters.grainOuterDiameterMm / 2000;
  const initialCoreRadiusM = parameters.coreDiameterMm / 2000;
  const grainLengthM = parameters.grainLengthMm / 1000;
  const throatAreaM2 = Math.PI * (parameters.nozzleThroatMm / 2000) ** 2;
  const annulusAreaM2 = Math.max(Math.PI * (grainOuterRadiusM ** 2 - initialCoreRadiusM ** 2), 0);
  const propellantVolumeM3 = annulusAreaM2 * grainLengthM * parameters.grainCount;
  const propellantMassKg = propellantVolumeM3 * profile.densityKgM3;
  const propellantMassG = Math.round(propellantMassKg * 1000);
  const loadedMassG = Math.round(parameters.dryMassG + propellantMassG);
  const endAreaM2 = Math.max(Math.PI * (grainOuterRadiusM ** 2 - initialCoreRadiusM ** 2), 0);
  const a = (profile.burnRateMmSAt1Mpa / 1000) / Math.pow(1_000_000, profile.pressureExponent);
  const dt = 0.02;
  const curve: MotorCurvePoint[] = [{ time: 0, thrust: 0, pressure: 0, kn: 0, impulse: 0, portDiameterMm: parameters.coreDiameterMm, massRemainingG: propellantMassG, massFlowKgS: 0, burnAreaCm2: 0, burnRateMmS: 0, specificImpulseS: 0 }];
  let time = 0;
  let coreRadiusM = initialCoreRadiusM;
  let remainingMassKg = propellantMassKg;
  let impulseNs = 0;
  let peakThrustN = 0;

  for (let step = 0; step < 1200; step += 1) {
    const sideBurnAreaM2 = 2 * Math.PI * coreRadiusM * grainLengthM * parameters.grainCount;
    const effectiveEndAreaM2 = endAreaM2 * parameters.grainCount * 0.18;
    const burnAreaM2 = Math.max(sideBurnAreaM2 + effectiveEndAreaM2, 0);
    const chamberPressurePa = burnAreaM2 > 0 && throatAreaM2 > 0
      ? Math.pow((profile.densityKgM3 * burnAreaM2 * a * profile.characteristicVelocityMS) / throatAreaM2, 1 / (1 - profile.pressureExponent))
      : 0;
    const burnRateMS = a * Math.pow(Math.max(chamberPressurePa, 0), profile.pressureExponent);
    const massFlowKgS = profile.densityKgM3 * burnAreaM2 * burnRateMS;
    const consumedKg = Math.min(remainingMassKg, massFlowKgS * dt);
    const thrustN = chamberPressurePa * throatAreaM2 * profile.thrustCoefficient;

    time += dt;
    impulseNs += thrustN * dt;
    remainingMassKg -= consumedKg;
    coreRadiusM += burnRateMS * dt;
    peakThrustN = Math.max(peakThrustN, thrustN);

    if (step % 5 === 0 || remainingMassKg <= 0 || coreRadiusM >= grainOuterRadiusM) {
      curve.push({
        time: Number(time.toFixed(2)),
        thrust: Math.round(thrustN),
        pressure: Number((chamberPressurePa / 1_000_000).toFixed(2)),
        kn: Number((burnAreaM2 / Math.max(throatAreaM2, 0.000001)).toFixed(1)),
        impulse: Math.round(impulseNs),
        portDiameterMm: Number((coreRadiusM * 2000).toFixed(1)),
        massRemainingG: Math.max(0, Math.round(remainingMassKg * 1000)),
        massFlowKgS: Number(massFlowKgS.toFixed(3)),
        burnAreaCm2: Number((burnAreaM2 * 10000).toFixed(1)),
        burnRateMmS: Number((burnRateMS * 1000).toFixed(2)),
        specificImpulseS: massFlowKgS > 0 ? Number((thrustN / (massFlowKgS * 9.80665)).toFixed(1)) : 0
      });
    }

    if (remainingMassKg <= 0 || coreRadiusM >= grainOuterRadiusM) break;
  }

  curve.push({ time: Number((time + dt).toFixed(2)), thrust: 0, pressure: 0, kn: 0, impulse: Math.round(impulseNs), portDiameterMm: parameters.grainOuterDiameterMm, massRemainingG: 0, massFlowKgS: 0, burnAreaCm2: 0, burnRateMmS: 0, specificImpulseS: 0 });

  const burnTimeS = Number(time.toFixed(2));
  const totalImpulseNs = Math.round(impulseNs);
  const averageThrustN = burnTimeS > 0 ? Math.round(totalImpulseNs / burnTimeS) : 0;

  const warnings = [
    "Motor simulations are estimates and must not be treated as safety certification.",
    "Rocketry House does not certify motor safety."
  ];
  if (parameters.grainOuterDiameterMm > parameters.casingInnerDiameterMm) warnings.push("Grain outer diameter should fit inside the combustion chamber diameter.");
  if (parameters.grainCount * parameters.grainLengthMm > parameters.casingLengthMm) warnings.push("Grain stack length exceeds chamber length; reduce segments or segment length.");
  if (parameters.coreDiameterMm >= parameters.grainOuterDiameterMm) warnings.push("Core diameter must be smaller than grain outer diameter.");
  if (parameters.grainConfiguration === "C-slot" && (parameters.slotOffsetMm ?? 0) >= parameters.grainOuterDiameterMm / 2) warnings.push("C-slot offset should remain smaller than the grain radius in this analysis model.");
  if (parameters.coreDiameterMm >= parameters.grainOuterDiameterMm * 0.72) warnings.push("Core diameter leaves a very thin grain web for this simplified model.");
  if (parameters.nozzleThroatMm < 4 || parameters.nozzleThroatMm > parameters.casingInnerDiameterMm * 0.45) warnings.push("Nozzle throat is outside the recommended analysis range.");
  if (loadedMassG > 25000) warnings.push("Large loaded mass: review transport, storage, club, and launch site requirements.");
  if (parameters.grainCount > 6) warnings.push("Many grain segments increase alignment and inspection complexity.");
  if (curve.some((point) => point.pressure > 8)) warnings.push("Calculated chamber pressure is high for this analysis envelope; review assumptions with qualified supervision.");

  return {
    totalImpulseNs,
    averageThrustN,
    peakThrustN: Math.round(peakThrustN),
    burnTimeS,
    motorClass: estimateMotorClass(totalImpulseNs),
    propellantMassG,
    estimatedLoadedMassG: loadedMassG,
    curve,
    warnings
  };
}
