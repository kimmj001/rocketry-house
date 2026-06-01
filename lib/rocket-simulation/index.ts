import { estimateCg, estimateCp, estimateMass, runEngineeringEstimate } from "@/lib/simulation/estimates";
import type { RocketComponent, SimulationWarning, TelemetryPoint } from "@/lib/types";
import type { SavedMotor } from "@/types/motor";

const GRAVITY = 9.80665;
const SEA_LEVEL_AIR_DENSITY = 1.225;

function finPlanformArea(component: RocketComponent) {
  const root = component.finRootChord ?? component.length;
  const tip = component.finTipChord ?? component.length * 0.48;
  const span = component.finSpan ?? component.diameter;
  const sweep = component.finSweep ?? component.length * 0.25;
  const points = component.finPlanform === "Freeform" && component.finFreeformPoints?.length
    ? component.finFreeformPoints
    : [
        { x: 0, y: 0 },
        { x: root, y: 0 },
        { x: sweep + tip, y: span },
        { x: sweep, y: span }
      ];
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function estimateFinAuthority(components: RocketComponent[], diameterMm: number, lengthM: number) {
  const fins = components.find((component) => component.type === "fins");
  if (!fins) return 0.1;
  const areaM2 = (finPlanformArea(fins) / 1_000_000) * (fins.finCount ?? 3);
  const spanRatio = (fins.finSpan ?? diameterMm) / Math.max(diameterMm, 1);
  const bodySideAreaM2 = Math.max(lengthM * (diameterMm / 1000), 0.001);
  return Math.max(0.08, Math.min(3.5, (areaM2 / bodySideAreaM2) * (1 + spanRatio) * 3.2));
}

function thrustAt(motor: SavedMotor, timeS: number) {
  const curve = motor.simulation.curve;
  if (!curve.length || timeS < curve[0].time || timeS > curve[curve.length - 1].time) return 0;
  for (let i = 1; i < curve.length; i += 1) {
    const previous = curve[i - 1];
    const next = curve[i];
    if (timeS <= next.time) {
      const span = Math.max(next.time - previous.time, 0.001);
      const mix = (timeS - previous.time) / span;
      return previous.thrust + (next.thrust - previous.thrust) * mix;
    }
  }
  return 0;
}

function impulseAt(motor: SavedMotor, timeS: number) {
  const curve = motor.simulation.curve;
  if (!curve.length || timeS <= curve[0].time) return 0;
  if (timeS >= curve[curve.length - 1].time) return motor.totalImpulseNs;
  for (let i = 1; i < curve.length; i += 1) {
    const previous = curve[i - 1];
    const next = curve[i];
    if (timeS <= next.time) {
      const span = Math.max(next.time - previous.time, 0.001);
      const mix = (timeS - previous.time) / span;
      const impulse = previous.impulse + (next.impulse - previous.impulse) * mix;
      return Math.min(motor.totalImpulseNs, Math.max(0, impulse));
    }
  }
  return motor.totalImpulseNs;
}

export function runRocketEstimateWithMotor(components: RocketComponent[], motor?: SavedMotor, options: { windSpeedMps?: number } = {}) {
  const windSpeedMps = Math.max(0, Number.isFinite(options.windSpeedMps ?? 0) ? options.windSpeedMps ?? 0 : 0);

  if (!motor) {
    const result = runEngineeringEstimate(components, { motorImpulseNs: 0, burnTimeS: 1 });
    return {
      ...result,
      windSpeedMps,
      warnings: [{ level: "critical" as const, message: "Select a motor to run flight simulation." }, ...result.warnings]
    };
  }

  const motorComponent: RocketComponent = {
    id: `selected-${motor.id}`,
    type: "motor_mount",
    name: motor.name,
    length: motor.parameters.casingLengthMm,
    diameter: motor.parameters.casingOuterDiameterMm,
    wallThickness: 2,
    material: "Saved motor from Motor Library",
    mass: motor.simulation.estimatedLoadedMassG,
    position: Math.max(...components.map((component) => component.position + component.length)) - motor.parameters.casingLengthMm
  };
  const flightComponents = [...components, motorComponent];
  const diameter = Math.max(...flightComponents.map((component) => component.diameter));
  const dryMassKg = Math.max((estimateMass(components) + motor.parameters.dryMassG) / 1000, 0.001);
  const propellantMassKg = Math.max(motor.simulation.propellantMassG / 1000, 0);
  const referenceAreaM2 = Math.PI * (diameter / 2000) ** 2;
  const cd = 0.58;
  const railLengthM = 2.4;
  const cgMm = estimateCg(flightComponents);
  const cpMm = estimateCp(flightComponents);
  const stabilityMargin = Number(((cpMm - cgMm) / diameter).toFixed(2));
  const lengthM = Math.max(...flightComponents.map((component) => component.position + component.length)) / 1000;
  const sideAreaM2 = Math.max(lengthM * (diameter / 1000), referenceAreaM2 * 2);
  const finAuthority = estimateFinAuthority(flightComponents, diameter, lengthM);
  const controlAuthority = Math.max(0.05, stabilityMargin) * finAuthority;
  const timeSeries: TelemetryPoint[] = [];
  let time = 0;
  let altitude = 0;
  let velocity = 0;
  let lateralDrift = 0;
  let lateralVelocity = 0;
  let maxDrift = 0;
  let attitudeRad = 0;
  let angularRateRadS = 0;
  let attitudeDeg = 0;
  let tumbleTime: number | undefined;
  let maxAltitude = 0;
  let maxVelocity = 0;
  let apogeeTime = 0;
  let railExitVelocity = 0;
  let railExitCaptured = false;
  const dt = 0.02;

  for (let step = 0; step < 45000; step += 1) {
    const thrust = thrustAt(motor, time);
    const burnedFraction = Math.min(impulseAt(motor, time) / Math.max(motor.totalImpulseNs, 1), 1);
    const massKg = dryMassKg + propellantMassKg * (1 - burnedFraction);
    const airDensityKgM3 = SEA_LEVEL_AIR_DENSITY * Math.exp(-Math.max(0, altitude) / 8500);
    const drag = 0.5 * airDensityKgM3 * velocity * Math.abs(velocity) * cd * referenceAreaM2;
    const relativeCrosswind = lateralVelocity - windSpeedMps;
    const flightSpeed = Math.sqrt(velocity ** 2 + lateralVelocity ** 2);
    const relativeAirSpeed = Math.sqrt(velocity ** 2 + relativeCrosswind ** 2);
    const apparentWindAngleRad = Math.atan2(relativeCrosswind, Math.max(Math.abs(velocity), 0.25));
    const angleOfAttackRad = apparentWindAngleRad - attitudeRad;
    const dynamicPressure = 0.5 * airDensityKgM3 * (flightSpeed ** 2 + relativeCrosswind ** 2);
    const railGuidance = altitude < railLengthM ? 0 : 1;
    const windIntensity = windSpeedMps / Math.max(Math.abs(velocity), 0.8);
    const stabilityDeficit = Math.max(0, 1.05 - stabilityMargin);
    const overstableWeathercock = Math.max(0, stabilityMargin - 1.7);
    const stabilityDamping = Math.max(0.16, Math.min(1.15, 0.26 + finAuthority * 0.16 + Math.max(stabilityMargin, 0) * 0.12));
    const staticMarginM = Math.max(0, (cpMm - cgMm) / 1000);
    const normalForceSlope = Math.max(1.4, Math.min(11, 2.0 + finAuthority * 2.8 + Math.max(stabilityMargin, 0) * 0.85));
    const normalForce = dynamicPressure * referenceAreaM2 * normalForceSlope * Math.sin(angleOfAttackRad);
    const pitchInertia = Math.max(massKg * lengthM ** 2 * 0.055, 0.015);
    const aeroMoment = normalForce * staticMarginM;
    const railExitBoost = railGuidance ? Math.max(1, 1.8 - Math.min(velocity, 35) / 35) : 0;
    const momentGain = (1.0 + windIntensity * 1.55 + overstableWeathercock * 0.2) * railExitBoost;
    const pitchDamping = angularRateRadS * (0.55 + dynamicPressure * referenceAreaM2 * lengthM / Math.max(massKg, 0.1));
    const angularAcceleration = ((aeroMoment * momentGain) / pitchInertia - pitchDamping) * railGuidance;
    angularRateRadS += angularAcceleration * dt;
    angularRateRadS = Math.max(-4.8, Math.min(4.8, angularRateRadS));
    attitudeRad += angularRateRadS * dt;
    const apparentLimitRad = Math.max(0.35, Math.min(1.35, Math.abs(apparentWindAngleRad) * (1.15 + overstableWeathercock * 0.18) + windIntensity * 0.32));
    attitudeRad = Math.max(-apparentLimitRad, Math.min(apparentLimitRad, attitudeRad));
    if (railGuidance && stabilityDeficit > 0) attitudeRad += Math.sin(time * 12.5) * (0.28 + windSpeedMps * 0.04) * stabilityDeficit * dt;

    const verticalThrust = thrust * Math.cos(attitudeRad);
    const lateralThrust = thrust * Math.sin(attitudeRad);
    const sideForce = -normalForce * 0.45;
    const crosswindPush = Math.sign(windSpeedMps - lateralVelocity)
      * 0.5
      * airDensityKgM3
      * Math.abs(windSpeedMps - lateralVelocity) ** 2
      * sideAreaM2
      * (0.55 + Math.min(finAuthority, 2.8) * 0.2)
      / stabilityDamping;
    const lateralDrag = -0.5 * airDensityKgM3 * lateralVelocity * Math.abs(lateralVelocity) * 0.82 * sideAreaM2;
    const weathercockPenalty = Math.abs(attitudeRad) * windIntensity * Math.max(0, thrust);
    const lateralAcceleration = ((lateralThrust + sideForce + crosswindPush + lateralDrag) / massKg) * railGuidance;
    const netForce = verticalThrust - drag - massKg * GRAVITY;
    const acceleration = altitude <= 0 && velocity <= 0 && netForce <= 0 ? 0 : netForce / massKg;

    velocity += acceleration * dt;
    altitude += velocity * dt;
    lateralVelocity += lateralAcceleration * dt;
    lateralDrift += lateralVelocity * dt;
    maxDrift = Math.max(maxDrift, Math.abs(lateralDrift));
    if (altitude <= 0 && velocity <= 0) {
      altitude = 0;
      velocity = 0;
    }
    const flightPathAngleDeg = Math.atan2(lateralVelocity, Math.max(velocity, 0.1)) * (180 / Math.PI);
    const visualAttitudeDeg = attitudeRad * (180 / Math.PI) + Math.sin(time * 14) * stabilityDeficit * windSpeedMps * 1.15;
    attitudeDeg = Number(visualAttitudeDeg.toFixed(2));
    if (!tumbleTime && altitude > railLengthM && windSpeedMps > 0.4 && (controlAuthority < 0.55 || Math.abs(attitudeRad) > 0.82 || weathercockPenalty > thrust * 0.42) && Math.abs(angleOfAttackRad) > 0.38) {
      tumbleTime = time;
    }
    maxVelocity = Math.max(maxVelocity, Math.abs(velocity));
    if (altitude > maxAltitude) {
      maxAltitude = altitude;
      apogeeTime = time;
    }
    if (!railExitCaptured && altitude >= railLengthM) {
      railExitCaptured = true;
      railExitVelocity = Math.max(0, velocity);
    }
    if (step % 10 === 0) {
      timeSeries.push({
        time: Number(time.toFixed(1)),
        altitude: Math.round(altitude),
        lateralDrift: Number(lateralDrift.toFixed(1)),
        angleDeg: Number(attitudeDeg.toFixed(1)),
        pressure: Number(flightPathAngleDeg.toFixed(1)),
        velocity: Number(velocity.toFixed(1)),
        acceleration: Number(acceleration.toFixed(2)),
        thrust: Math.round(thrust)
      });
    }
    if (time > motor.burnTimeS && altitude > railLengthM && velocity <= 0) break;
    if (time > motor.burnTimeS + 0.5 && altitude <= 0 && velocity <= 0) break;
    time += dt;
  }

  const averageThrustN = Math.round(motor.totalImpulseNs / Math.max(motor.burnTimeS, 0.01));
  const thrustToWeight = Number((averageThrustN / ((dryMassKg + propellantMassKg) * GRAVITY)).toFixed(2));
  const warnings: SimulationWarning[] = [
    { level: "info", message: "Flight analysis integrates the selected motor thrust curve, changing propellant mass, gravity, and quadratic drag." }
  ];
  if (stabilityMargin < 1) warnings.push({ level: "critical", message: "Unstable margin: CP should sit at least 1 caliber behind CG." });
  if (windSpeedMps > 0) warnings.push({ level: "info", message: `Crosswind model active at ${Number(windSpeedMps.toFixed(1))} m/s; weathercocking tilts thrust after rail exit using CG/CP margin and fin authority from current fin geometry.` });
  if (tumbleTime) warnings.push({ level: "critical", message: `Low stability with crosswind predicts tumble onset near T+${Number(tumbleTime.toFixed(1))} s.` });
  else if (windSpeedMps >= 6 && stabilityMargin < 1.6) warnings.push({ level: "warning", message: "Crosswind may cause strong weathercocking. Increase stability margin or reduce exposed side area." });
  if (thrustToWeight < 4) warnings.push({ level: "warning", message: "Low thrust-to-weight for a clean rail departure." });
  if (!railExitCaptured) warnings.push({ level: "critical", message: "Vehicle does not clear the configured rail length in this analysis." });
  if (railExitCaptured && railExitVelocity < 30) warnings.push({ level: "warning", message: "Rail exit velocity is low; use a more suitable motor, reduce mass, or review launch guide assumptions." });

  return {
    cgMm,
    cpMm,
    stabilityMargin,
    massG: Math.round((dryMassKg + propellantMassKg) * 1000),
    diameterMm: diameter,
    referenceAreaM2,
    motorImpulseNs: motor.totalImpulseNs,
    burnTimeS: motor.burnTimeS,
    averageThrustN,
    thrustToWeight,
    predictedAltitudeM: Math.round(maxAltitude),
    maxVelocityMps: Number(maxVelocity.toFixed(1)),
    apogeeTimeS: Number(apogeeTime.toFixed(1)),
    flightTimeS: Number(time.toFixed(1)),
    railExitVelocityMps: Number(railExitVelocity.toFixed(1)),
    dragCoefficientEstimate: cd,
    windSpeedMps: Number(windSpeedMps.toFixed(1)),
    maxDriftM: Number(maxDrift.toFixed(1)),
    tumbleTimeS: tumbleTime ? Number(tumbleTime.toFixed(1)) : undefined,
    weathercockAngleDeg: Number(attitudeDeg.toFixed(1)),
    timeSeries,
    warnings
  };
}
