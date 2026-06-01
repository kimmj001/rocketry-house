import type { RocketComponent, SimulationResult, SimulationWarning, TelemetryPoint } from "@/lib/types";
import { totalLength } from "@/lib/cad/geometry";

export type SimulationInput = {
  motorImpulseNs?: number;
  burnTimeS?: number;
  dragCoefficient?: number;
  launchAngleDeg?: number;
  dryMassScale?: number;
  airDensityKgM3?: number;
  railLengthM?: number;
};

const GRAVITY = 9.80665;

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
  const area = Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  return Math.max(area, root * span * 0.25);
}

function finPlanformCentroidX(component: RocketComponent) {
  const root = component.finRootChord ?? component.length;
  const tip = component.finTipChord ?? component.length * 0.48;
  const sweep = component.finSweep ?? component.length * 0.25;
  const points = component.finPlanform === "Freeform" && component.finFreeformPoints?.length
    ? component.finFreeformPoints
    : [
        { x: 0, y: 0 },
        { x: root, y: 0 },
        { x: sweep + tip, y: component.finSpan ?? component.diameter },
        { x: sweep, y: component.finSpan ?? component.diameter }
      ];
  return points.reduce((sum, point) => sum + point.x, 0) / Math.max(points.length, 1);
}

export function estimateMass(components: RocketComponent[]) {
  return Math.round(components.reduce((sum, component) => sum + component.mass, 0));
}

export function estimateCg(components: RocketComponent[]) {
  const mass = components.reduce((sum, component) => sum + component.mass, 0);
  if (!mass) return 0;
  return Math.round(
    components.reduce((sum, component) => sum + component.mass * (component.position + component.length / 2), 0) / mass
  );
}

export function estimateCp(components: RocketComponent[]) {
  const length = totalLength(components);
  const diameter = Math.max(...components.map((component) => component.diameter), 1);
  let normalForce = 0;
  let moment = 0;

  for (const component of components) {
    if (component.type === "nose_cone") {
      const cn = 2;
      const cp = component.position + component.length * 0.466;
      normalForce += cn;
      moment += cn * cp;
    }

    if (component.type === "transition") {
      const fore = component.foreDiameter ?? component.diameter;
      const aft = component.aftDiameter ?? component.diameter;
      const cn = Math.max(0.08, Math.abs(aft ** 2 - fore ** 2) / Math.max(diameter ** 2, 1));
      const cp = component.position + component.length * 0.55;
      normalForce += cn;
      moment += cn * cp;
    }

    if (component.type === "fins") {
      const area = finPlanformArea(component);
      const count = component.finCount ?? 3;
      const span = component.finSpan ?? component.diameter;
      const cp = component.position + finPlanformCentroidX(component);
      const cn = Math.max(0.4, count * (area / Math.max(diameter ** 2, 1)) * (span / Math.max(diameter, 1)) * 0.38);
      normalForce += cn;
      moment += cn * cp;
    }
  }

  if (normalForce > 0) return Math.round(moment / normalForce);

  const finComponent = components.find((component) => component.type === "fins");
  const finInfluence = finComponent ? finComponent.position + finComponent.length * 0.35 : length * 0.67;
  return Math.round(length * 0.48 + finInfluence * 0.52);
}

export function runEngineeringEstimate(components: RocketComponent[], input: SimulationInput = {}): SimulationResult {
  const diameter = Math.max(...components.map((component) => component.diameter));
  const dryMassScale = input.dryMassScale ?? 1;
  const massG = Math.round(estimateMass(components) * dryMassScale);
  const cgMm = estimateCg(components);
  const cpMm = estimateCp(components);
  const stabilityMargin = Number(((cpMm - cgMm) / diameter).toFixed(2));
  const dragCoefficientEstimate = Number((input.dragCoefficient ?? 0.52 + diameter / 1000).toFixed(2));
  const motorImpulseNs = Math.max(0, input.motorImpulseNs ?? 160);
  const burnTimeS = Math.max(0.05, input.burnTimeS ?? 1.6);
  const averageThrustN = motorImpulseNs / burnTimeS;
  const massKg = Math.max(massG / 1000, 0.001);
  const referenceAreaM2 = Math.PI * (diameter / 2000) ** 2;
  const angleFactor = Math.sin(((input.launchAngleDeg ?? 90) * Math.PI) / 180);
  const airDensityKgM3 = input.airDensityKgM3 ?? 1.225;
  const railLengthM = input.railLengthM ?? 2;

  const timeSeries: TelemetryPoint[] = [];
  let time = 0;
  let altitude = 0;
  let velocity = 0;
  let maxAltitude = 0;
  let maxVelocity = 0;
  let apogeeTime = 0;
  let railExitVelocity = 0;
  let railExitCaptured = false;
  const dt = 0.05;
  const maxTime = 900;

  for (let step = 0; step <= maxTime / dt; step += 1) {
    const thrust = time <= burnTimeS ? averageThrustN : 0;
    const dragDirection = velocity >= 0 ? -1 : 1;
    const drag = 0.5 * airDensityKgM3 * velocity * velocity * dragCoefficientEstimate * referenceAreaM2 * dragDirection;
    const netForce = thrust * angleFactor + drag - massKg * GRAVITY;
    const acceleration = altitude <= 0 && velocity <= 0 && netForce <= 0 ? 0 : netForce / massKg;

    velocity += acceleration * dt;
    altitude += velocity * dt;
    if (altitude <= 0 && velocity <= 0) {
      altitude = 0;
      velocity = 0;
    }
    maxVelocity = Math.max(maxVelocity, Math.abs(velocity));

    if (!railExitCaptured && altitude >= railLengthM) {
      railExitVelocity = Math.max(0, velocity);
      railExitCaptured = true;
    }

    if (altitude > maxAltitude) {
      maxAltitude = altitude;
      apogeeTime = time;
    }

    if (step % 4 === 0) {
      timeSeries.push({
        time: Number(time.toFixed(1)),
        altitude: Math.round(altitude),
        velocity: Number(velocity.toFixed(1)),
        acceleration: Number(acceleration.toFixed(2)),
        thrust: Math.round(thrust)
      });
    }

    if (time > burnTimeS && altitude > railLengthM && velocity <= 0) break;
    if (time > burnTimeS + 0.5 && altitude <= 0 && velocity <= 0) break;
    time += dt;
  }

  const thrustToWeight = Number((averageThrustN / (massKg * GRAVITY)).toFixed(2));
  const warnings: SimulationWarning[] = [
    { level: "info", message: "Flight analysis from current geometry, impulse, burn time, drag, and launch angle." }
  ];
  if (stabilityMargin < 1) warnings.push({ level: "critical", message: "Unstable margin: CP should sit at least 1 caliber behind CG." });
  if (!components.some((component) => component.type === "motor_mount")) warnings.push({ level: "warning", message: "Missing motor mount." });
  if (!components.some((component) => component.type === "recovery_bay")) warnings.push({ level: "warning", message: "Missing recovery system." });
  if (thrustToWeight < 4) warnings.push({ level: "warning", message: "Low thrust-to-weight for a clean rail departure." });
  if (railExitCaptured && railExitVelocity < 30) warnings.push({ level: "warning", message: "Rail exit velocity is low; increase thrust, reduce mass, or use a longer guide." });
  if (!railExitCaptured) warnings.push({ level: "critical", message: "Vehicle does not clear the configured rail length in this analysis." });
  if (input.launchAngleDeg && input.launchAngleDeg < 85) warnings.push({ level: "warning", message: "Launch angle is not near vertical; altitude and range assumptions should be reviewed." });

  return {
    cgMm,
    cpMm,
    stabilityMargin,
    massG,
    diameterMm: diameter,
    referenceAreaM2,
    motorImpulseNs,
    burnTimeS,
    averageThrustN: Math.round(averageThrustN),
    thrustToWeight,
    predictedAltitudeM: Math.round(maxAltitude),
    maxVelocityMps: Number(maxVelocity.toFixed(1)),
    apogeeTimeS: Number(apogeeTime.toFixed(1)),
    flightTimeS: Number(time.toFixed(1)),
    railExitVelocityMps: Number(railExitVelocity.toFixed(1)),
    dragCoefficientEstimate,
    timeSeries,
    warnings
  };
}

export function estimateImpulseForTargetAltitude(components: RocketComponent[], targetAltitudeM: number, input: Omit<SimulationInput, "motorImpulseNs"> = {}) {
  if (targetAltitudeM <= 0) return 160;
  const massKg = Math.max((estimateMass(components) * (input.dryMassScale ?? 1)) / 1000, 0.001);
  const burnTimeS = input.burnTimeS ?? 1.6;
  let low = massKg * GRAVITY * burnTimeS * 1.25;
  let high = Math.max(low * 2, massKg * Math.sqrt(2 * GRAVITY * targetAltitudeM) * 2);

  for (let guard = 0; guard < 12; guard += 1) {
    const result = runEngineeringEstimate(components, { ...input, motorImpulseNs: high });
    if (result.predictedAltitudeM >= targetAltitudeM) break;
    high *= 1.8;
  }

  for (let i = 0; i < 22; i += 1) {
    const mid = (low + high) / 2;
    const result = runEngineeringEstimate(components, { ...input, motorImpulseNs: mid });
    if (result.predictedAltitudeM < targetAltitudeM) low = mid;
    else high = mid;
  }

  return Math.round(high);
}
