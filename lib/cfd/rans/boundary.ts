import { thermodynamicProperties } from "./thermodynamics";
import type { FacePrimitive } from "./numerics";
import type { RansSolverConfig } from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

function ambientState(config: RansSolverConfig) {
  const temperature = 288.15;
  const thermo = thermodynamicProperties(1, temperature, config);
  const p = Math.max(config.ambientPressurePa, config.pressureMin);
  const rho = p / (thermo.gasConstant * temperature);
  return {
    rho,
    u: 0,
    v: 0,
    p,
    temperature,
    nuTilde: 0,
    thermo
  } satisfies FacePrimitive;
}

export function stagnationInletFace(
  interior: FacePrimitive,
  config: RansSolverConfig,
  totalPressureOverridePa?: number,
  totalTemperatureOverrideK?: number,
  relaxation = 1
): FacePrimitive {
  const totalTemperature = Math.max(
    totalTemperatureOverrideK ?? config.chamberTemperatureK,
    config.temperatureMin
  );
  const totalPressure = Math.max(
    totalPressureOverridePa ?? config.chamberPressurePa,
    config.pressureMin
  );
  const thermo = thermodynamicProperties(0, totalTemperature, config);
  const gamma = thermo.gamma;
  const gasConstant = thermo.gasConstant;
  const outgoingInvariant =
    interior.u -
    2 * Math.sqrt(interior.thermo.gamma * interior.p / interior.rho) /
      (interior.thermo.gamma - 1);

  const invariantAtMach = (mach: number) => {
    const totalFactor = 1 + 0.5 * (gamma - 1) * mach * mach;
    const temperature = totalTemperature / totalFactor;
    const soundSpeed = Math.sqrt(gamma * gasConstant * temperature);
    return mach * soundSpeed - 2 * soundSpeed / (gamma - 1);
  };

  let lowMach = 0;
  let highMach = 0.999;
  if (outgoingInvariant <= invariantAtMach(lowMach)) {
    highMach = 0;
  } else if (outgoingInvariant >= invariantAtMach(highMach)) {
    lowMach = highMach;
  } else {
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const midMach = 0.5 * (lowMach + highMach);
      if (invariantAtMach(midMach) < outgoingInvariant) lowMach = midMach;
      else highMach = midMach;
    }
  }

  const mach = 0.5 * (lowMach + highMach);
  const totalFactor = 1 + 0.5 * (gamma - 1) * mach * mach;
  const temperature = totalTemperature / totalFactor;
  const localThermo = thermodynamicProperties(0, temperature, config);
  const p = totalPressure / Math.pow(
    totalFactor,
    gamma / (gamma - 1)
  );
  const rho = p / (localThermo.gasConstant * temperature);
  const soundSpeed = Math.sqrt(localThermo.gamma * localThermo.gasConstant * temperature);
  const nuTilde = config.turbulence === "spalartAllmaras"
    ? 3 * localThermo.viscosity / rho
    : 0;
  const inletRelaxation = clamp(relaxation, 0.01, 1);
  if (inletRelaxation >= 1 - 1e-12) {
    return {
      rho,
      u: mach * soundSpeed,
      v: 0,
      p,
      temperature,
      nuTilde,
      thermo: localThermo
    };
  }
  const relaxedTemperature = interior.temperature +
    inletRelaxation * (temperature - interior.temperature);
  const relaxedPressure = interior.p + inletRelaxation * (p - interior.p);
  const relaxedThermo = thermodynamicProperties(0, relaxedTemperature, config);
  return {
    rho: relaxedPressure / Math.max(relaxedThermo.gasConstant * relaxedTemperature, 1e-30),
    u: interior.u + inletRelaxation * (mach * soundSpeed - interior.u),
    v: interior.v * (1 - inletRelaxation),
    p: relaxedPressure,
    temperature: relaxedTemperature,
    nuTilde: interior.nuTilde + inletRelaxation * (nuTilde - interior.nuTilde),
    thermo: relaxedThermo
  };
}

export function characteristicAmbientFace(
  interior: FacePrimitive,
  normalX: number,
  normalR: number,
  config: RansSolverConfig
): FacePrimitive {
  const ambient = ambientState(config);
  const gamma = interior.thermo.gamma;
  const gasConstant = interior.thermo.gasConstant;
  const interiorSoundSpeed = Math.sqrt(gamma * interior.p / interior.rho);
  const normalVelocity = interior.u * normalX + interior.v * normalR;

  if (normalVelocity >= interiorSoundSpeed) return interior;
  if (normalVelocity <= -interiorSoundSpeed) return ambient;

  const tangentialVelocity = -interior.u * normalR + interior.v * normalX;
  const ambientSoundSpeed = Math.sqrt(gamma * gasConstant * ambient.temperature);
  const outgoingInvariant =
    normalVelocity + 2 * interiorSoundSpeed / (gamma - 1);
  const incomingInvariant = -2 * ambientSoundSpeed / (gamma - 1);
  const boundaryNormalVelocity = 0.5 * (outgoingInvariant + incomingInvariant);
  const boundarySoundSpeed = Math.max(
    0.25 * (gamma - 1) * (outgoingInvariant - incomingInvariant),
    1e-6
  );
  const outflow = boundaryNormalVelocity >= 0;
  const entropy = outflow
    ? interior.p / Math.pow(interior.rho, gamma)
    : ambient.p / Math.pow(ambient.rho, gamma);
  const rho = Math.pow(
    boundarySoundSpeed * boundarySoundSpeed / Math.max(gamma * entropy, 1e-30),
    1 / (gamma - 1)
  );
  const p = entropy * Math.pow(rho, gamma);
  const boundedPressure = Math.max(p, config.pressureMin);
  const temperature = Math.max(
    boundedPressure / Math.max(rho * gasConstant, 1e-30),
    config.temperatureMin
  );
  const boundedRho = Math.max(
    boundedPressure / Math.max(gasConstant * temperature, 1e-30),
    config.rhoMin
  );
  const tangent = outflow ? tangentialVelocity : 0;
  const u = boundaryNormalVelocity * normalX - tangent * normalR;
  const v = boundaryNormalVelocity * normalR + tangent * normalX;
  const thermo = thermodynamicProperties(1, temperature, config);

  return {
    rho: boundedRho,
    u: clamp(u, -10 * boundarySoundSpeed, 10 * boundarySoundSpeed),
    v: clamp(v, -10 * boundarySoundSpeed, 10 * boundarySoundSpeed),
    p: boundedPressure,
    temperature,
    nuTilde: outflow ? interior.nuTilde : 0,
    thermo
  };
}
