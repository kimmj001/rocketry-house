import { estimateCg, estimateCp, estimateMass, runEngineeringEstimate } from "@/lib/simulation/estimates";
import type { RocketComponent, SimulationWarning, TelemetryPoint } from "@/lib/types";
import type { SavedMotor } from "@/types/motor";

const GRAVITY = 9.80665;

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

export function runRocketEstimateWithMotor(components: RocketComponent[], motor?: SavedMotor) {
  if (!motor) {
    const result = runEngineeringEstimate(components, { motorImpulseNs: 0, burnTimeS: 1 });
    return {
      ...result,
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
  const airDensityKgM3 = 1.225;
  const railLengthM = 2.4;
  const cgMm = estimateCg(flightComponents);
  const cpMm = estimateCp(flightComponents);
  const stabilityMargin = Number(((cpMm - cgMm) / diameter).toFixed(2));
  const timeSeries: TelemetryPoint[] = [];
  let time = 0;
  let altitude = 0;
  let velocity = 0;
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
    const drag = 0.5 * airDensityKgM3 * velocity * Math.abs(velocity) * cd * referenceAreaM2;
    const netForce = thrust - drag - massKg * GRAVITY;
    const acceleration = altitude <= 0 && velocity <= 0 && netForce <= 0 ? 0 : netForce / massKg;

    velocity += acceleration * dt;
    altitude += velocity * dt;
    if (altitude <= 0 && velocity <= 0) {
      altitude = 0;
      velocity = 0;
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
    timeSeries,
    warnings
  };
}
