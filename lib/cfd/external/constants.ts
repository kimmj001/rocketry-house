import type { ExternalCfdResolution } from "./types";

export const CFD_GAMMA = 1.4;
export const CFD_AMBIENT_PRESSURE_PA = 101_325;
export const CFD_AMBIENT_TEMPERATURE_K = 288.15;
export const CFD_AMBIENT_DENSITY_KG_M3 = 1.225;
export const CFD_AIR_GAS_CONSTANT = 287.05;
export const CFD_SPEED_OF_SOUND_M_S = Math.sqrt(CFD_GAMMA * CFD_AIR_GAS_CONSTANT * CFD_AMBIENT_TEMPERATURE_K);

export const EXTERNAL_CFD_PRESETS: Record<ExternalCfdResolution, {
  width: number;
  height: number;
  lbmIterations: number;
  compressibleIterations: number;
}> = {
  low: { width: 240, height: 96, lbmIterations: 450, compressibleIterations: 70 },
  medium: { width: 320, height: 128, lbmIterations: 600, compressibleIterations: 100 },
  high: { width: 420, height: 168, lbmIterations: 750, compressibleIterations: 140 }
};

export const D2Q9_CX = new Int8Array([0, 1, 0, -1, 0, 1, -1, -1, 1]);
export const D2Q9_CY = new Int8Array([0, 0, 1, 0, -1, 1, 1, -1, -1]);
export const D2Q9_OPPOSITE = new Int8Array([0, 3, 4, 1, 2, 7, 8, 5, 6]);
export const D2Q9_WEIGHT = new Float32Array([4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36]);

export const EXTERNAL_CFD_TIMEOUT_MS = 240_000;
export const EXTERNAL_CFD_CACHE_LIMIT = 12;
export const EXTERNAL_CFD_DENSITY_FLOOR = 1e-5;
export const EXTERNAL_CFD_PRESSURE_FLOOR = 1e-6;
