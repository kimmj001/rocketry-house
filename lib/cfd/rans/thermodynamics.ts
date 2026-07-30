import type { RansSolverConfig, ThermoProperties } from "./types";

export type ThermoStation = {
  xNormalized: number;
  gamma: number;
  gasConstant: number;
  viscosity: number;
  conductivity: number;
  prandtl: number;
  referenceTemperatureK: number;
};

export const HYDROLOX_FROZEN_STATIONS: ThermoStation[] = [
  {
    xNormalized: 0,
    gamma: 1.1489,
    gasConstant: 378.1,
    viscosity: 1.066e-4,
    conductivity: 0.3595,
    prandtl: 0.6217,
    referenceTemperatureK: 3512.4
  },
  {
    xNormalized: 0.48,
    gamma: 1.158,
    gasConstant: 376.2,
    viscosity: 8.75e-5,
    conductivity: 0.286,
    prandtl: 0.638,
    referenceTemperatureK: 3060
  },
  {
    xNormalized: 1,
    gamma: 1.191,
    gasConstant: 371.4,
    viscosity: 4.35e-5,
    conductivity: 0.128,
    prandtl: 0.681,
    referenceTemperatureK: 1520
  }
];

function interpolateStation(xNormalized: number) {
  const x = Math.max(0, Math.min(1, xNormalized));
  if (x <= HYDROLOX_FROZEN_STATIONS[0].xNormalized) {
    return HYDROLOX_FROZEN_STATIONS[0];
  }
  const rightIndex = x <= HYDROLOX_FROZEN_STATIONS[1].xNormalized ? 1 : 2;
  const right = HYDROLOX_FROZEN_STATIONS[rightIndex];
  const left = HYDROLOX_FROZEN_STATIONS[rightIndex - 1];
  const t = (x - left.xNormalized) / Math.max(right.xNormalized - left.xNormalized, 1e-12);
  return {
    xNormalized: x,
    gamma: left.gamma + (right.gamma - left.gamma) * t,
    gasConstant: left.gasConstant + (right.gasConstant - left.gasConstant) * t,
    viscosity: left.viscosity + (right.viscosity - left.viscosity) * t,
    conductivity: left.conductivity + (right.conductivity - left.conductivity) * t,
    prandtl: left.prandtl + (right.prandtl - left.prandtl) * t,
    referenceTemperatureK:
      left.referenceTemperatureK +
      (right.referenceTemperatureK - left.referenceTemperatureK) * t
  };
}

export function thermodynamicProperties(
  xNormalized: number,
  temperatureK: number,
  config: RansSolverConfig
): ThermoProperties {
  if (config.thermoModel === "constantGas") {
    const gamma = Math.max(1.02, Math.min(1.67, config.gamma));
    const gasConstant = Math.max(1, config.gasConstant);
    const referenceTemperatureK = 300;
    const viscosity = 1.846e-5 * Math.pow(Math.max(temperatureK, 50) / referenceTemperatureK, 0.7);
    const prandtl = 0.72;
    const cp = gamma * gasConstant / (gamma - 1);
    return {
      gamma,
      gasConstant,
      viscosity,
      conductivity: cp * viscosity / prandtl,
      prandtl,
      cp
    };
  }

  const station = interpolateStation(xNormalized);
  const temperatureScale = Math.pow(Math.max(temperatureK, 50) / station.referenceTemperatureK, 0.7);
  const gamma = station.gamma;
  const gasConstant = station.gasConstant;
  return {
    gamma,
    gasConstant,
    viscosity: station.viscosity * temperatureScale,
    conductivity: station.conductivity * temperatureScale,
    prandtl: station.prandtl,
    cp: gamma * gasConstant / (gamma - 1)
  };
}
