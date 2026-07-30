import {
  axisymmetricSourceMeasure,
  axialFaceArea,
  createBodyFittedMesh,
  radialFaceAreaVector,
  radialFaceRadius,
  ransCellIndex,
  ringAreaAtCell,
  throatX
} from "./geometry";
import {
  characteristicAmbientFace,
  stagnationInletFace
} from "./boundary";
import {
  conservativeFromPrimitive,
  createConservativeState,
  createPrimitiveArrays,
  hllcFlux,
  noSlipAdiabaticWallGhost,
  primitiveFromConservative,
  residualNorm,
  venkatakrishnanLimiter,
  weightedLeastSquaresReconstruction,
  type FacePrimitive,
  type FluxVector,
  type ScalarReconstruction
} from "./numerics";
import { thermodynamicProperties } from "./thermodynamics";
import {
  DEFAULT_RANS_CONFIG,
  type BodyFittedMesh,
  type CfdFieldName,
  type ConservativeState,
  type MassFlowDiagnostic,
  type PrimitiveArrays,
  type RansSolverConfig,
  type SolverDiagnostics,
  type SolverResidualPoint,
  type SolverSnapshot,
  type ThermoProperties
} from "./types";

const PI = Math.PI;
const SA_CB1 = 0.1355;
const SA_CB2 = 0.622;
const SA_SIGMA = 2 / 3;
const SA_KAPPA = 0.41;
const SA_CV1 = 7.1;
const SA_CW2 = 0.3;
const SA_CW3 = 2;
const SA_CW1 = SA_CB1 / (SA_KAPPA * SA_KAPPA) + (1 + SA_CB2) / SA_SIGMA;

type GradientSet = {
  rho: ScalarReconstruction;
  u: ScalarReconstruction;
  v: ScalarReconstruction;
  p: ScalarReconstruction;
  temperature: ScalarReconstruction;
  nuTilde: ScalarReconstruction;
};

type Counters = {
  limitedFaces: number;
  hllcFallbacks: number;
  firstOrderFallbacks: number;
  positivityCorrections: number;
  turbulenceClips: number;
  rejectedSteps: number;
  nanCount: number;
  floorApplications: number;
};

type ViscousFaceFlux = {
  conservative: FluxVector;
  nuTilde: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function mergeConfig(config: Partial<RansSolverConfig>): RansSolverConfig {
  return {
    ...DEFAULT_RANS_CONFIG,
    ...config,
    geometry: {
      ...DEFAULT_RANS_CONFIG.geometry,
      ...(config.geometry ?? {})
    }
  };
}

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / Math.max(mach, 1e-8)) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

export function solveAreaMach(areaRatio: number, gamma: number, supersonic: boolean) {
  let low = supersonic ? 1.000001 : 1e-4;
  let high = supersonic ? 12 : 0.999999;
  const target = Math.max(areaRatio, 1);
  for (let iteration = 0; iteration < 90; iteration += 1) {
    const mid = 0.5 * (low + high);
    const value = areaMach(mid, gamma);
    if (supersonic ? value < target : value > target) low = mid;
    else high = mid;
  }
  return 0.5 * (low + high);
}

function cloneState(state: ConservativeState) {
  return {
    rho: state.rho.slice(),
    rhoU: state.rhoU.slice(),
    rhoV: state.rhoV.slice(),
    rhoE: state.rhoE.slice(),
    rhoNuTilde: state.rhoNuTilde.slice()
  };
}

function clearState(state: ConservativeState) {
  state.rho.fill(0);
  state.rhoU.fill(0);
  state.rhoV.fill(0);
  state.rhoE.fill(0);
  state.rhoNuTilde.fill(0);
}

function isPhysicalConservative(
  rho: number,
  rhoU: number,
  rhoV: number,
  rhoE: number,
  thermo: ThermoProperties,
  config: RansSolverConfig
) {
  if (
    !Number.isFinite(rho) ||
    !Number.isFinite(rhoU) ||
    !Number.isFinite(rhoV) ||
    !Number.isFinite(rhoE) ||
    rho <= config.rhoMin
  ) {
    return false;
  }
  const kinetic = 0.5 * (rhoU * rhoU + rhoV * rhoV) / rho;
  const pressure = (thermo.gamma - 1) * (rhoE - kinetic);
  const temperature = pressure / (rho * thermo.gasConstant);
  return Number.isFinite(pressure) &&
    Number.isFinite(temperature) &&
    pressure > config.pressureMin &&
    temperature > config.temperatureMin;
}

function addFlux(
  residual: ConservativeState,
  index: number,
  sign: number,
  area: number,
  inviscid: FluxVector,
  viscous: ViscousFaceFlux,
  scalarFlux: number
) {
  residual.rho[index] += sign * area * (inviscid[0] - viscous.conservative[0]);
  residual.rhoU[index] += sign * area * (inviscid[1] - viscous.conservative[1]);
  residual.rhoV[index] += sign * area * (inviscid[2] - viscous.conservative[2]);
  residual.rhoE[index] += sign * area * (inviscid[3] - viscous.conservative[3]);
  residual.rhoNuTilde[index] += sign * area * (scalarFlux - viscous.nuTilde);
}

export class AxisymmetricRansSolver {
  readonly config: RansSolverConfig;
  readonly mesh: BodyFittedMesh;
  private state: ConservativeState;
  private nextState: ConservativeState;
  private primitive: PrimitiveArrays;
  private residual: ConservativeState;
  private gradients: GradientSet;
  private saSource: Float64Array;
  private lastUpdate: Float64Array;
  private limiterEpsilon2: number;
  private faceWasLimited = false;
  private residualHistory: SolverResidualPoint[] = [];
  private iteration = 0;
  private pseudoTimeS = 0;
  private lastDtS = 0;
  private effectiveCfl = 0;
  private cflScale = 1;
  private failed = false;
  private failureReason: string | undefined;
  private counters: Counters = {
    limitedFaces: 0,
    hllcFallbacks: 0,
    firstOrderFallbacks: 0,
    positivityCorrections: 0,
    turbulenceClips: 0,
    rejectedSteps: 0,
    nanCount: 0,
    floorApplications: 0
  };

  constructor(config: Partial<RansSolverConfig> = {}) {
    this.config = mergeConfig(config);
    this.mesh = createBodyFittedMesh(
      this.config.geometry,
      this.config.resolution,
      this.config.nx,
      this.config.nr
    );
    this.state = createConservativeState(this.mesh.cells);
    this.nextState = createConservativeState(this.mesh.cells);
    this.primitive = createPrimitiveArrays(this.mesh.cells);
    this.residual = createConservativeState(this.mesh.cells);
    this.saSource = new Float64Array(this.mesh.cells);
    this.lastUpdate = new Float64Array(this.mesh.cells);
    const h3 = this.mesh.minCellLength ** 3;
    this.limiterEpsilon2 = h3 * h3 + 1e-30;
    if (this.config.initializationMode === "coldStart") this.initializeQuiescentAmbient();
    else this.initializeQuasiOneDimensional();
    this.decodeState();
    this.gradients = this.computeGradients();
  }

  private initializeQuiescentAmbient() {
    const pressure = Math.max(this.config.ambientPressurePa, this.config.pressureMin);
    const temperature = 288.15;
    for (let i = 0; i < this.mesh.nx; i += 1) {
      const thermo = thermodynamicProperties(
        this.thermoCoordinate(this.mesh.xCenters[i]),
        temperature,
        this.config
      );
      const rho = pressure / (thermo.gasConstant * temperature);
      const face: FacePrimitive = {
        rho,
        u: 0,
        v: 0,
        p: pressure,
        temperature,
        nuTilde: 0,
        thermo
      };
      const conserved = conservativeFromPrimitive(face);
      for (let j = 0; j < this.mesh.nr; j += 1) {
        const index = ransCellIndex(i, j, this.mesh);
        this.state.rho[index] = conserved[0];
        this.state.rhoU[index] = conserved[1];
        this.state.rhoV[index] = conserved[2];
        this.state.rhoE[index] = conserved[3];
        this.state.rhoNuTilde[index] = 0;
      }
    }
  }

  private initializeQuasiOneDimensional() {
    const throatArea = PI * this.config.geometry.throatRadiusM ** 2;
    const throatXM = throatX(this.config.geometry);
    const ambientTemperatureK = 288.15;
    const ambientPressure = Math.max(this.config.ambientPressurePa, this.config.pressureMin);
    const exitArea = PI * this.config.geometry.exitRadiusM ** 2;
    const exitNominalThermo = thermodynamicProperties(1, this.config.chamberTemperatureK, this.config);
    const exitMach = solveAreaMach(exitArea / throatArea, exitNominalThermo.gamma, true);
    const exitTotalFactor = 1 + ((exitNominalThermo.gamma - 1) / 2) * exitMach * exitMach;
    const exitTemperature = this.config.chamberTemperatureK / exitTotalFactor;
    const exitThermo = thermodynamicProperties(1, exitTemperature, this.config);
    const exitPressure = this.config.chamberPressurePa /
      Math.pow(exitTotalFactor, exitThermo.gamma / (exitThermo.gamma - 1));
    const exitU = exitMach * Math.sqrt(exitThermo.gamma * exitThermo.gasConstant * exitTemperature);
    const externalLengthM = this.mesh.lengthM - this.mesh.nozzleLengthM;

    for (let i = 0; i < this.mesh.nx; i += 1) {
      const xM = this.mesh.xCenters[i];
      const insideNozzle = i <= this.mesh.nozzleExitIndex;
      let nozzleState: FacePrimitive | null = null;
      if (insideNozzle) {
        const area = PI * this.mesh.wallCenters[i] ** 2;
        const xNormalized = this.thermoCoordinate(xM);
        const nominalThermo = thermodynamicProperties(xNormalized, this.config.chamberTemperatureK, this.config);
        const mach = solveAreaMach(
          Math.max(area / throatArea, 1),
          nominalThermo.gamma,
          xM > throatXM
        );
        const totalFactor = 1 + ((nominalThermo.gamma - 1) / 2) * mach * mach;
        const temperature = this.config.chamberTemperatureK / totalFactor;
        const thermo = thermodynamicProperties(xNormalized, temperature, this.config);
        const pressure = this.config.chamberPressurePa /
          Math.pow(totalFactor, thermo.gamma / (thermo.gamma - 1));
        const rho = pressure / (thermo.gasConstant * temperature);
        const soundSpeed = Math.sqrt(thermo.gamma * thermo.gasConstant * temperature);
        const u = mach * soundSpeed;
        const nu = thermo.viscosity / rho;
        const nuTilde = this.config.turbulence === "spalartAllmaras" ? 3 * nu : 0;
        nozzleState = { rho, u, v: 0, p: pressure, temperature, nuTilde, thermo };
      }

      for (let j = 0; j < this.mesh.nr; j += 1) {
        const index = ransCellIndex(i, j, this.mesh);
        let face = nozzleState;
        if (!face) {
          const distance = xM - this.mesh.nozzleLengthM;
          const spreadRadius = this.config.geometry.exitRadiusM + 0.055 * distance;
          const shearThickness = Math.max(this.config.geometry.exitRadiusM * 0.16 + 0.012 * distance, 1e-5);
          const radialBlend = 1 / (1 + Math.exp((this.mesh.cellR[index] - spreadRadius) / shearThickness));
          const axialBlend = Math.exp(-0.28 * distance / Math.max(externalLengthM, 1e-8));
          const plumeBlend = clamp(radialBlend * axialBlend, 0, 1);
          const temperature = ambientTemperatureK + (exitTemperature - ambientTemperatureK) * plumeBlend;
          const pressureBlend = plumeBlend * Math.exp(-1.5 * distance / Math.max(externalLengthM, 1e-8));
          const pressure = ambientPressure + (exitPressure - ambientPressure) * pressureBlend;
          const thermo = thermodynamicProperties(1, temperature, this.config);
          const rho = pressure / (thermo.gasConstant * temperature);
          const u = exitU * plumeBlend;
          const v = distance > 0
            ? 0.035 * exitU * plumeBlend * this.mesh.cellR[index] / Math.max(spreadRadius, 1e-8)
            : 0;
          const nu = thermo.viscosity / Math.max(rho, this.config.rhoMin);
          const nuTilde = this.config.turbulence === "spalartAllmaras" ? 3 * nu * plumeBlend : 0;
          face = { rho, u, v, p: pressure, temperature, nuTilde, thermo };
        }
        const conserved = conservativeFromPrimitive(face);
        this.state.rho[index] = conserved[0];
        this.state.rhoU[index] = conserved[1];
        this.state.rhoV[index] = conserved[2];
        this.state.rhoE[index] = conserved[3];
        this.state.rhoNuTilde[index] = face.rho * face.nuTilde;
      }
    }
  }

  private thermoCoordinate(xM: number) {
    return clamp(xM / Math.max(this.mesh.nozzleLengthM, 1e-8), 0, 1);
  }

  private decodeState(trackFloors = true) {
    for (let index = 0; index < this.mesh.cells; index += 1) {
      const xNormalized = this.thermoCoordinate(this.mesh.cellX[index]);
      const preliminary = thermodynamicProperties(xNormalized, this.config.chamberTemperatureK, this.config);
      const conserved: [number, number, number, number] = [
        this.state.rho[index],
        this.state.rhoU[index],
        this.state.rhoV[index],
        this.state.rhoE[index]
      ];
      let decoded = primitiveFromConservative(conserved, preliminary, this.config);
      const thermo = thermodynamicProperties(xNormalized, decoded.temperature, this.config);
      decoded = primitiveFromConservative(conserved, thermo, this.config);
      if (trackFloors) this.counters.floorApplications += decoded.floorCount;
      const rho = decoded.rho;
      const nuTilde = Math.max(this.state.rhoNuTilde[index] / rho, 0);
      const nu = thermo.viscosity / rho;
      const chi = nuTilde / Math.max(nu, 1e-20);
      const chi3 = chi * chi * chi;
      const fv1 = chi3 / Math.max(chi3 + SA_CV1 ** 3, 1e-30);
      this.primitive.rho[index] = rho;
      this.primitive.u[index] = decoded.u;
      this.primitive.v[index] = decoded.v;
      this.primitive.p[index] = decoded.p;
      this.primitive.temperature[index] = decoded.temperature;
      this.primitive.soundSpeed[index] = decoded.soundSpeed;
      this.primitive.mach[index] = decoded.mach;
      this.primitive.gamma[index] = thermo.gamma;
      this.primitive.gasConstant[index] = thermo.gasConstant;
      this.primitive.cp[index] = thermo.cp;
      this.primitive.mu[index] = thermo.viscosity;
      this.primitive.conductivity[index] = thermo.conductivity;
      this.primitive.prandtl[index] = thermo.prandtl;
      this.primitive.nu[index] = nu;
      this.primitive.nuTilde[index] = nuTilde;
      this.primitive.muT[index] = this.config.turbulence === "spalartAllmaras" ? rho * nuTilde * fv1 : 0;
    }
  }

  private computeGradients(): GradientSet {
    return {
      rho: weightedLeastSquaresReconstruction(this.primitive.rho, this.mesh),
      u: weightedLeastSquaresReconstruction(this.primitive.u, this.mesh),
      v: weightedLeastSquaresReconstruction(this.primitive.v, this.mesh),
      p: weightedLeastSquaresReconstruction(this.primitive.p, this.mesh),
      temperature: weightedLeastSquaresReconstruction(this.primitive.temperature, this.mesh),
      nuTilde: weightedLeastSquaresReconstruction(this.primitive.nuTilde, this.mesh)
    };
  }

  private cellCenteredFace(index: number, faceX: number): FacePrimitive {
    const temperature = this.primitive.temperature[index];
    return {
      rho: this.primitive.rho[index],
      u: this.primitive.u[index],
      v: this.primitive.v[index],
      p: this.primitive.p[index],
      temperature,
      nuTilde: this.primitive.nuTilde[index],
      thermo: thermodynamicProperties(this.thermoCoordinate(faceX), temperature, this.config)
    };
  }

  private reconstructFaceValue(
    values: Float64Array,
    reconstruction: ScalarReconstruction,
    index: number,
    dx: number,
    dr: number
  ) {
    const center = values[index];
    const delta = reconstruction.x[index] * dx + reconstruction.r[index] * dr;
    const allowable = delta >= 0
      ? reconstruction.maximum[index] - center
      : reconstruction.minimum[index] - center;
    const limiter = venkatakrishnanLimiter(delta, allowable, this.limiterEpsilon2);
    if (limiter < 0.999999) this.faceWasLimited = true;
    return center + limiter * delta;
  }

  private cellFace(index: number, faceX: number, faceR: number): FacePrimitive {
    if (this.config.reconstruction === "firstOrder") return this.cellCenteredFace(index, faceX);

    const dx = faceX - this.mesh.cellX[index];
    const dr = faceR - this.mesh.cellR[index];
    this.faceWasLimited = false;
    const rho = this.reconstructFaceValue(
      this.primitive.rho,
      this.gradients.rho,
      index,
      dx,
      dr
    );
    const u = this.reconstructFaceValue(this.primitive.u, this.gradients.u, index, dx, dr);
    const v = this.reconstructFaceValue(this.primitive.v, this.gradients.v, index, dx, dr);
    const p = this.reconstructFaceValue(this.primitive.p, this.gradients.p, index, dx, dr);
    const temperature = this.reconstructFaceValue(
      this.primitive.temperature,
      this.gradients.temperature,
      index,
      dx,
      dr
    );
    const nuTilde = this.reconstructFaceValue(
      this.primitive.nuTilde,
      this.gradients.nuTilde,
      index,
      dx,
      dr
    );
    if (this.faceWasLimited) this.counters.limitedFaces += 1;
    if (
      !Number.isFinite(rho) || rho <= this.config.rhoMin ||
      !Number.isFinite(p) || p <= this.config.pressureMin ||
      !Number.isFinite(temperature) || temperature <= this.config.temperatureMin ||
      !Number.isFinite(u) || !Number.isFinite(v)
    ) {
      this.counters.firstOrderFallbacks += 1;
      return this.cellCenteredFace(index, faceX);
    }
    return {
      rho,
      u,
      v,
      p,
      temperature,
      nuTilde: Math.max(nuTilde, 0),
      thermo: thermodynamicProperties(this.thermoCoordinate(faceX), temperature, this.config)
    };
  }

  private outletFace(interior: FacePrimitive): FacePrimitive {
    return characteristicAmbientFace(interior, 1, 0, this.config);
  }

  private farfieldFace(interior: FacePrimitive, normalX: number, normalR: number): FacePrimitive {
    return characteristicAmbientFace(interior, normalX, normalR, this.config);
  }

  private viscousFlux(
    leftIndex: number,
    rightIndex: number,
    left: FacePrimitive,
    right: FacePrimitive,
    normalX: number,
    normalR: number,
    wall = false
  ): ViscousFaceFlux {
    const average = (leftValue: number, rightValue: number) => 0.5 * (leftValue + rightValue);
    const muLeft = left.thermo.viscosity + (
      this.config.turbulence === "spalartAllmaras" && leftIndex >= 0 ? this.primitive.muT[leftIndex] : 0
    );
    const muRight = right.thermo.viscosity + (
      this.config.turbulence === "spalartAllmaras" && rightIndex >= 0 ? this.primitive.muT[rightIndex] : 0
    );
    const muEff = average(muLeft, muRight);
    let duDx = leftIndex >= 0 ? this.gradients.u.x[leftIndex] : 0;
    let duDr = leftIndex >= 0 ? this.gradients.u.r[leftIndex] : 0;
    let dvDx = leftIndex >= 0 ? this.gradients.v.x[leftIndex] : 0;
    let dvDr = leftIndex >= 0 ? this.gradients.v.r[leftIndex] : 0;
    let dTDx = leftIndex >= 0 ? this.gradients.temperature.x[leftIndex] : 0;
    let dTDr = leftIndex >= 0 ? this.gradients.temperature.r[leftIndex] : 0;
    let dNuDx = leftIndex >= 0 ? this.gradients.nuTilde.x[leftIndex] : 0;
    let dNuDr = leftIndex >= 0 ? this.gradients.nuTilde.r[leftIndex] : 0;

    if (rightIndex >= 0) {
      duDx = average(duDx, this.gradients.u.x[rightIndex]);
      duDr = average(duDr, this.gradients.u.r[rightIndex]);
      dvDx = average(dvDx, this.gradients.v.x[rightIndex]);
      dvDr = average(dvDr, this.gradients.v.r[rightIndex]);
      dTDx = average(dTDx, this.gradients.temperature.x[rightIndex]);
      dTDr = average(dTDr, this.gradients.temperature.r[rightIndex]);
      dNuDx = average(dNuDx, this.gradients.nuTilde.x[rightIndex]);
      dNuDr = average(dNuDr, this.gradients.nuTilde.r[rightIndex]);
    }

    if (wall && leftIndex >= 0) {
      const distance = this.mesh.wallDistance[leftIndex];
      const duDn = -this.primitive.u[leftIndex] / distance;
      const dvDn = -this.primitive.v[leftIndex] / distance;
      duDx = duDn * normalX;
      duDr = duDn * normalR;
      dvDx = dvDn * normalX;
      dvDr = dvDn * normalR;
      const normalTemperatureGradient = dTDx * normalX + dTDr * normalR;
      dTDx -= normalTemperatureGradient * normalX;
      dTDr -= normalTemperatureGradient * normalR;
      const dNuDn = -this.primitive.nuTilde[leftIndex] / distance;
      dNuDx = dNuDn * normalX;
      dNuDr = dNuDn * normalR;
    }

    const faceR = leftIndex >= 0 ? this.mesh.cellR[leftIndex] : this.mesh.minCellLength;
    const vOverR = faceR > 0.5 * this.mesh.minCellLength
      ? average(left.v, right.v) / faceR
      : dvDr;
    const divergence = duDx + dvDr + vOverR;
    const tauXX = 2 * muEff * duDx - (2 / 3) * muEff * divergence;
    const tauRR = 2 * muEff * dvDr - (2 / 3) * muEff * divergence;
    const tauXR = muEff * (duDr + dvDx);
    const tractionX = tauXX * normalX + tauXR * normalR;
    const tractionR = tauXR * normalX + tauRR * normalR;
    const muMolecular = average(left.thermo.viscosity, right.thermo.viscosity);
    const muT = Math.max(muEff - muMolecular, 0);
    const cp = average(left.thermo.cp, right.thermo.cp);
    const pr = average(left.thermo.prandtl, right.thermo.prandtl);
    const kEff = cp * (
      muMolecular / Math.max(pr, 0.1) +
      muT / Math.max(this.config.turbulentPrandtl, 0.1)
    );
    const heatNormal = -kEff * (dTDx * normalX + dTDr * normalR);
    const uFace = average(left.u, right.u);
    const vFace = average(left.v, right.v);
    const rhoFace = average(left.rho, right.rho);
    const nuFace = average(
      left.thermo.viscosity / left.rho,
      right.thermo.viscosity / right.rho
    );
    const nuTildeFace = average(left.nuTilde, right.nuTilde);
    const nuDiffusion = rhoFace * (nuFace + nuTildeFace) / SA_SIGMA *
      (dNuDx * normalX + dNuDr * normalR);
    return {
      conservative: [
        0,
        tractionX,
        tractionR,
        uFace * tractionX + vFace * tractionR - heatNormal
      ],
      nuTilde: nuDiffusion
    };
  }

  private accumulateFace(
    leftIndex: number,
    rightIndex: number,
    left: FacePrimitive,
    right: FacePrimitive,
    normalX: number,
    normalR: number,
    area: number,
    wall = false
  ) {
    const hllc = hllcFlux(left, right, normalX, normalR);
    if (hllc.usedFallback) this.counters.hllcFallbacks += 1;
    const viscous = this.viscousFlux(leftIndex, rightIndex, left, right, normalX, normalR, wall);
    const upwindNuTilde = hllc.massFlux >= 0 ? left.nuTilde : right.nuTilde;
    const scalarFlux = hllc.massFlux * upwindNuTilde;
    if (leftIndex >= 0) addFlux(this.residual, leftIndex, 1, area, hllc.flux, viscous, scalarFlux);
    if (rightIndex >= 0) addFlux(this.residual, rightIndex, -1, area, hllc.flux, viscous, scalarFlux);
  }

  private addAxisymmetricAndTurbulenceSources() {
    for (let index = 0; index < this.mesh.cells; index += 1) {
      const i = Math.floor(index / this.mesh.nr);
      const j = index % this.mesh.nr;
      const radialOffset = i * (this.mesh.nr + 1) + j;
      const localDr = 0.5 * (
        this.mesh.radialFaceLeft[radialOffset + 1] +
        this.mesh.radialFaceRight[radialOffset + 1] -
        this.mesh.radialFaceLeft[radialOffset] -
        this.mesh.radialFaceRight[radialOffset]
      );
      const muEff = this.primitive.mu[index] + this.primitive.muT[index];
      const vOverR = this.mesh.cellR[index] > 0.5 * localDr
        ? this.primitive.v[index] / this.mesh.cellR[index]
        : this.gradients.v.r[index];
      const divergence = this.gradients.u.x[index] + this.gradients.v.r[index] + vOverR;
      const tauTheta = 2 * muEff * vOverR - (2 / 3) * muEff * divergence;

      // True ring volumes and face areas already contain the radial weighting.
      // Only the hoop-stress radial momentum term remains in this formulation.
      const radialSource = this.primitive.p[index] - tauTheta;
      this.residual.rhoV[index] -= radialSource *
        axisymmetricSourceMeasure(this.mesh, i, j);

      if (this.config.turbulence !== "spalartAllmaras") continue;
      const source = this.spalartAllmarasSource(index);
      this.saSource[index] = source;
      this.residual.rhoNuTilde[index] -= this.primitive.rho[index] * source * this.mesh.volumes[index];
    }
  }

  private spalartAllmarasSource(index: number) {
    const nuTilde = this.primitive.nuTilde[index];
    if (nuTilde <= 0) return 0;
    const nu = this.primitive.nu[index];
    const chi = nuTilde / Math.max(nu, 1e-20);
    const chi3 = chi ** 3;
    const fv1 = chi3 / Math.max(chi3 + SA_CV1 ** 3, 1e-30);
    const fv2 = 1 - chi / Math.max(1 + chi * fv1, 1e-20);
    const rotation = Math.abs(this.gradients.v.x[index] - this.gradients.u.r[index]);
    const distance = this.mesh.wallDistance[index];
    const sTilde = Math.max(
      rotation + nuTilde * fv2 / Math.max(SA_KAPPA ** 2 * distance ** 2, 1e-20),
      1e-10
    );
    const rTurbulence = clamp(
      nuTilde / Math.max(sTilde * SA_KAPPA ** 2 * distance ** 2, 1e-20),
      0,
      10
    );
    const g = rTurbulence + SA_CW2 * (rTurbulence ** 6 - rTurbulence);
    const fw = g * Math.pow(
      (1 + SA_CW3 ** 6) / Math.max(g ** 6 + SA_CW3 ** 6, 1e-30),
      1 / 6
    );
    const gradientSquared =
      this.gradients.nuTilde.x[index] ** 2 +
      this.gradients.nuTilde.r[index] ** 2;
    return SA_CB1 * sTilde * nuTilde +
      SA_CB2 / SA_SIGMA * gradientSquared -
      SA_CW1 * fw * (nuTilde / distance) ** 2;
  }

  private accumulateNozzleExitInterface() {
    const faceI = this.mesh.nozzleExitIndex + 1;
    const leftI = faceI - 1;
    const rightI = faceI;
    const faceX = this.mesh.nozzleLengthM;
    let leftJ = 0;
    let rightJ = 0;

    while (leftJ < this.mesh.nr && rightJ < this.mesh.nr) {
      const leftInner = radialFaceRadius(this.mesh, leftI, "right", leftJ);
      const leftOuter = radialFaceRadius(this.mesh, leftI, "right", leftJ + 1);
      const rightInner = radialFaceRadius(this.mesh, rightI, "left", rightJ);
      const rightOuter = radialFaceRadius(this.mesh, rightI, "left", rightJ + 1);
      const overlapInner = Math.max(leftInner, rightInner);
      const overlapOuter = Math.min(leftOuter, rightOuter);
      if (overlapOuter > overlapInner + 1e-14) {
        const area = PI * (overlapOuter * overlapOuter - overlapInner * overlapInner);
        const faceR = Math.sqrt(0.5 * (
          overlapInner * overlapInner + overlapOuter * overlapOuter
        ));
        const leftIndex = ransCellIndex(leftI, leftJ, this.mesh);
        const rightIndex = ransCellIndex(rightI, rightJ, this.mesh);
        this.accumulateFace(
          leftIndex,
          rightIndex,
          this.cellFace(leftIndex, faceX, faceR),
          this.cellFace(rightIndex, faceX, faceR),
          1,
          0,
          area
        );
      }
      if (leftOuter <= rightOuter + 1e-14) leftJ += 1;
      if (rightOuter <= leftOuter + 1e-14) rightJ += 1;
    }

    const exitRadius = this.config.geometry.exitRadiusM;
    for (let j = 0; j < this.mesh.nr; j += 1) {
      const inner = radialFaceRadius(this.mesh, rightI, "left", j);
      const outer = radialFaceRadius(this.mesh, rightI, "left", j + 1);
      const exposedInner = Math.max(inner, exitRadius);
      if (outer <= exposedInner + 1e-14) continue;
      const area = PI * (outer * outer - exposedInner * exposedInner);
      const faceR = Math.sqrt(0.5 * (
        exposedInner * exposedInner + outer * outer
      ));
      const rightIndex = ransCellIndex(rightI, j, this.mesh);
      const right = this.cellFace(rightIndex, faceX, faceR);
      this.accumulateFace(
        -1,
        rightIndex,
        characteristicAmbientFace(right, -1, 0, this.config),
        right,
        1,
        0,
        area
      );
    }
  }

  private computeResidual() {
    clearState(this.residual);
    this.decodeState();
    this.gradients = this.computeGradients();

    for (let faceI = 0; faceI <= this.mesh.nx; faceI += 1) {
      if (faceI === this.mesh.nozzleExitIndex + 1) {
        this.accumulateNozzleExitInterface();
        continue;
      }
      for (let j = 0; j < this.mesh.nr; j += 1) {
        const area = axialFaceArea(this.mesh, faceI, j);
        const column = faceI === 0 ? 0 : faceI - 1;
        const side = faceI === 0 ? "left" : "right";
        const faceR = 0.5 * (
          radialFaceRadius(this.mesh, column, side, j) +
          radialFaceRadius(this.mesh, column, side, j + 1)
        );
        if (faceI === 0) {
          const rightIndex = ransCellIndex(0, j, this.mesh);
          const right = this.cellFace(rightIndex, 0, faceR);
          this.accumulateFace(
            -1,
            rightIndex,
            stagnationInletFace(right, this.config),
            right,
            1,
            0,
            area
          );
        } else if (faceI === this.mesh.nx) {
          const leftIndex = ransCellIndex(this.mesh.nx - 1, j, this.mesh);
          const left = this.cellFace(leftIndex, this.mesh.lengthM, faceR);
          this.accumulateFace(leftIndex, -1, left, this.outletFace(left), 1, 0, area);
        } else {
          const leftIndex = ransCellIndex(faceI - 1, j, this.mesh);
          const rightIndex = ransCellIndex(faceI, j, this.mesh);
          const faceX = this.mesh.xFaces[faceI];
          this.accumulateFace(
            leftIndex,
            rightIndex,
            this.cellFace(leftIndex, faceX, faceR),
            this.cellFace(rightIndex, faceX, faceR),
            1,
            0,
            area
          );
        }
      }
    }

    for (let i = 0; i < this.mesh.nx; i += 1) {
      const faceX = this.mesh.xCenters[i];
      for (let faceJ = 1; faceJ < this.mesh.nr; faceJ += 1) {
        const areaVector = radialFaceAreaVector(this.mesh, i, faceJ);
        const area = Math.hypot(areaVector.x, areaVector.r);
        if (area <= 1e-20) continue;
        const normalX = areaVector.x / area;
        const normalR = areaVector.r / area;
        const radialOffset = i * (this.mesh.nr + 1) + faceJ;
        const faceR = 0.5 * (
          this.mesh.radialFaceLeft[radialOffset] +
          this.mesh.radialFaceRight[radialOffset]
        );
        const leftIndex = ransCellIndex(i, faceJ - 1, this.mesh);
        const rightIndex = ransCellIndex(i, faceJ, this.mesh);
        this.accumulateFace(
          leftIndex,
          rightIndex,
          this.cellFace(leftIndex, faceX, faceR),
          this.cellFace(rightIndex, faceX, faceR),
          normalX,
          normalR,
          area
        );
      }

      const areaVector = radialFaceAreaVector(this.mesh, i, this.mesh.nr);
      const area = Math.hypot(areaVector.x, areaVector.r);
      const normalX = areaVector.x / Math.max(area, 1e-20);
      const normalR = areaVector.r / Math.max(area, 1e-20);
      const leftIndex = ransCellIndex(i, this.mesh.nr - 1, this.mesh);
      const interior = this.cellFace(leftIndex, faceX, this.mesh.wallCenters[i]);
      const isNozzleWall = i <= this.mesh.nozzleExitIndex;
      this.accumulateFace(
        leftIndex,
        -1,
        interior,
        isNozzleWall
          ? noSlipAdiabaticWallGhost(interior)
          : this.farfieldFace(interior, normalX, normalR),
        normalX,
        normalR,
        area,
        isNozzleWall
      );
    }

    this.addAxisymmetricAndTurbulenceSources();
  }

  private currentCfl() {
    const coldStart = this.config.initializationMode === "coldStart";
    const firstRampEnd = coldStart ? 40 : 150;
    const secondRampEnd = coldStart ? 120 : 350;
    const thirdRampEnd = coldStart ? 240 : 700;
    const ramp = !this.config.cflRamp
      ? 1
      : this.iteration < firstRampEnd
        ? 1
        : this.iteration < secondRampEnd
          ? 2
          : this.iteration < thirdRampEnd
            ? 4
            : 10;
    const maximumCfl = coldStart && this.config.reconstruction === "musclVenkatakrishnan"
      ? 0.2
      : 0.5;
    return clamp(this.config.cfl * ramp * this.cflScale, 0.001, maximumCfl);
  }

  private computeTimeStep() {
    if (this.config.fixedTimeStepS && this.config.fixedTimeStepS > 0) return this.config.fixedTimeStepS;
    this.effectiveCfl = this.currentCfl();
    let dt = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.mesh.nx; i += 1) {
      const dx = this.mesh.xFaces[i + 1] - this.mesh.xFaces[i];
      for (let j = 0; j < this.mesh.nr; j += 1) {
        const index = ransCellIndex(i, j, this.mesh);
        const radialOffset = i * (this.mesh.nr + 1) + j;
        const localDr = 0.5 * (
          this.mesh.radialFaceLeft[radialOffset + 1] +
          this.mesh.radialFaceRight[radialOffset + 1] -
          this.mesh.radialFaceLeft[radialOffset] -
          this.mesh.radialFaceRight[radialOffset]
        );
        const h = Math.min(dx, localDr);
        const speed = Math.hypot(this.primitive.u[index], this.primitive.v[index]) +
          this.primitive.soundSpeed[index];
        const convective = this.effectiveCfl * h / Math.max(speed, 1);
        const nuEffective = this.primitive.nu[index] +
          this.primitive.muT[index] / Math.max(this.primitive.rho[index], this.config.rhoMin);
        const saDiffusivity = this.config.turbulence === "spalartAllmaras"
          ? (this.primitive.nu[index] + this.primitive.nuTilde[index]) / SA_SIGMA
          : 0;
        const viscous = 0.22 * h * h / Math.max(nuEffective, saDiffusivity, 1e-20);
        let turbulenceSource = Number.POSITIVE_INFINITY;
        if (this.config.turbulence === "spalartAllmaras" && this.primitive.nuTilde[index] > 0) {
          const source = this.saSource[index];
          if (source < 0) {
            turbulenceSource = 0.5 * this.primitive.nuTilde[index] /
              Math.max(-source, 1e-30);
          }
        }
        dt = Math.min(dt, convective, viscous, turbulenceSource);
      }
    }
    return Math.max(Math.min(dt, 1e-3), 1e-12);
  }

  private attemptUpdate(dt: number) {
    const next = this.nextState;
    for (let index = 0; index < this.mesh.cells; index += 1) {
      const factor = dt / this.mesh.volumes[index];
      const proposedRho = this.state.rho[index] - factor * this.residual.rho[index];
      const proposedRhoU = this.state.rhoU[index] - factor * this.residual.rhoU[index];
      const proposedRhoV = this.state.rhoV[index] - factor * this.residual.rhoV[index];
      const proposedRhoE = this.state.rhoE[index] - factor * this.residual.rhoE[index];
      const proposedRhoNuTilde =
        this.state.rhoNuTilde[index] - factor * this.residual.rhoNuTilde[index];
      if (
        !Number.isFinite(proposedRho) ||
        !Number.isFinite(proposedRhoU) ||
        !Number.isFinite(proposedRhoV) ||
        !Number.isFinite(proposedRhoE) ||
        !Number.isFinite(proposedRhoNuTilde)
      ) {
        this.counters.nanCount += 1;
        return null;
      }
      const xNormalized = this.thermoCoordinate(this.mesh.cellX[index]);
      const thermo = thermodynamicProperties(xNormalized, this.primitive.temperature[index], this.config);
      let acceptedRho = proposedRho;
      let acceptedRhoU = proposedRhoU;
      let acceptedRhoV = proposedRhoV;
      let acceptedRhoE = proposedRhoE;
      let acceptedRhoNuTilde = proposedRhoNuTilde;
      if (
        !isPhysicalConservative(
          acceptedRho,
          acceptedRhoU,
          acceptedRhoV,
          acceptedRhoE,
          thermo,
          this.config
        )
      ) {
        let theta = 0.5;
        let recovered = false;
        for (let correction = 0; correction < 48; correction += 1) {
          acceptedRho =
            this.state.rho[index] + theta * (proposedRho - this.state.rho[index]);
          acceptedRhoU =
            this.state.rhoU[index] + theta * (proposedRhoU - this.state.rhoU[index]);
          acceptedRhoV =
            this.state.rhoV[index] + theta * (proposedRhoV - this.state.rhoV[index]);
          acceptedRhoE =
            this.state.rhoE[index] + theta * (proposedRhoE - this.state.rhoE[index]);
          acceptedRhoNuTilde =
            this.state.rhoNuTilde[index] +
            theta * (proposedRhoNuTilde - this.state.rhoNuTilde[index]);
          if (
            isPhysicalConservative(
              acceptedRho,
              acceptedRhoU,
              acceptedRhoV,
              acceptedRhoE,
              thermo,
              this.config
            )
          ) {
            recovered = true;
            break;
          }
          theta *= 0.5;
        }
        if (!recovered) return null;
        this.counters.positivityCorrections += 1;
      }
      next.rho[index] = acceptedRho;
      next.rhoU[index] = acceptedRhoU;
      next.rhoV[index] = acceptedRhoV;
      next.rhoE[index] = acceptedRhoE;
      const nu = this.primitive.nu[index];
      const maximumRhoNuTilde = next.rho[index] * nu *
        this.config.maxModifiedViscosityRatio;
      next.rhoNuTilde[index] = Math.min(
        Math.max(acceptedRhoNuTilde, 0),
        maximumRhoNuTilde
      );
      const turbulenceTolerance = Math.max(
        1e-20,
        next.rho[index] * nu * 1e-8
      );
      if (
        acceptedRhoNuTilde < -turbulenceTolerance ||
        acceptedRhoNuTilde > maximumRhoNuTilde + turbulenceTolerance
      ) {
        this.counters.turbulenceClips += 1;
      }
      this.lastUpdate[index] = Math.max(
        Math.abs(next.rho[index] - this.state.rho[index]) / Math.max(Math.abs(this.state.rho[index]), 1e-12),
        Math.abs(next.rhoU[index] - this.state.rhoU[index]) / Math.max(Math.abs(this.state.rhoU[index]), 1),
        Math.abs(next.rhoE[index] - this.state.rhoE[index]) / Math.max(Math.abs(this.state.rhoE[index]), 1)
      );
    }
    return next;
  }

  private advanceOne() {
    if (this.failed) return;
    this.computeResidual();
    let dt = this.computeTimeStep();
    const chamberThermo = thermodynamicProperties(0, this.config.chamberTemperatureK, this.config);
    const referenceDensity = this.config.chamberPressurePa /
      (chamberThermo.gasConstant * this.config.chamberTemperatureK);
    const referenceSoundSpeed = Math.sqrt(
      chamberThermo.gamma * chamberThermo.gasConstant * this.config.chamberTemperatureK
    );
    const point = residualNorm(
      this.residual,
      this.mesh,
      this.iteration + 1,
      {
        densityKgM3: referenceDensity,
        soundSpeedMS: referenceSoundSpeed,
        lengthM: this.config.geometry.throatRadiusM,
        kinematicViscosityM2S: chamberThermo.viscosity / referenceDensity
      }
    );
    let next: ConservativeState | null = null;
    let retries = 0;
    for (; retries < 12; retries += 1) {
      next = this.attemptUpdate(dt);
      if (next) break;
      this.counters.rejectedSteps += 1;
      this.cflScale = Math.max(this.cflScale * 0.5, 0.02);
      this.effectiveCfl = Math.max(this.effectiveCfl * 0.5, 0.001);
      dt *= 0.5;
    }
    if (!next) {
      this.failed = true;
      this.failureReason = "The timestep remained nonphysical after adaptive CFL and positivity recovery.";
      return;
    }
    if (retries === 0) this.cflScale = Math.min(this.cflScale * 1.03, 1);
    this.nextState = this.state;
    this.state = next;
    this.iteration += 1;
    this.pseudoTimeS += dt;
    this.lastDtS = dt;
    this.residualHistory.push(point);
    if (this.residualHistory.length > 600) this.residualHistory.shift();
    this.decodeState(false);
  }

  step(iterations = 1) {
    const count = Math.max(1, Math.floor(iterations));
    for (let iteration = 0; iteration < count && !this.failed; iteration += 1) this.advanceOne();
    return this.createSnapshot();
  }

  private massFlowDiagnostics(): MassFlowDiagnostic[] {
    const throatIndex = this.mesh.throatIndex;
    const exitIndex = this.mesh.nozzleExitIndex;
    const stations: Array<[MassFlowDiagnostic["station"], number]> = [
      ["chamber", Math.max(0, Math.round(throatIndex * 0.35))],
      ["preThroat", Math.max(0, throatIndex - Math.max(2, Math.round(exitIndex * 0.04)))],
      ["throat", throatIndex],
      ["midDivergent", Math.round(0.5 * (throatIndex + exitIndex))],
      ["exit", exitIndex]
    ];
    return stations.map(([station, i]) => {
      let massFlowKgS = 0;
      for (let j = 0; j < this.mesh.nr; j += 1) {
        const index = ransCellIndex(i, j, this.mesh);
        massFlowKgS += this.primitive.rho[index] * this.primitive.u[index] * ringAreaAtCell(this.mesh, i, j);
      }
      return {
        station,
        xM: this.mesh.xCenters[i],
        massFlowKgS
      };
    });
  }

  getDiagnostics(): SolverDiagnostics {
    let minDensityKgM3 = Number.POSITIVE_INFINITY;
    let minPressurePa = Number.POSITIVE_INFINITY;
    let minTemperatureK = Number.POSITIVE_INFINITY;
    let maxMach = 0;
    let maxVelocityMS = 0;
    let maxTurbulentViscosityRatio = 0;
    for (let index = 0; index < this.mesh.cells; index += 1) {
      minDensityKgM3 = Math.min(minDensityKgM3, this.primitive.rho[index]);
      minPressurePa = Math.min(minPressurePa, this.primitive.p[index]);
      minTemperatureK = Math.min(minTemperatureK, this.primitive.temperature[index]);
      maxMach = Math.max(maxMach, this.primitive.mach[index]);
      maxVelocityMS = Math.max(maxVelocityMS, Math.hypot(this.primitive.u[index], this.primitive.v[index]));
      maxTurbulentViscosityRatio = Math.max(
        maxTurbulentViscosityRatio,
        this.primitive.muT[index] / Math.max(this.primitive.mu[index], 1e-20)
      );
    }
    const residual = this.residualHistory.at(-1) ?? {
      iteration: this.iteration,
      continuity: 0,
      axialMomentum: 0,
      radialMomentum: 0,
      energy: 0,
      turbulence: 0
    };
    const massFlow = this.massFlowDiagnostics();
    const positiveMassFlow = massFlow
      .map((station) => station.massFlowKgS)
      .filter((value) => value > 1e-12);
    const meanMassFlow = positiveMassFlow.reduce((sum, value) => sum + value, 0) /
      Math.max(positiveMassFlow.length, 1);
    const massFlowRelativeSpread = positiveMassFlow.length === massFlow.length
      ? (Math.max(...positiveMassFlow) - Math.min(...positiveMassFlow)) /
        Math.max(Math.abs(meanMassFlow), 1e-12)
      : 1e9;
    const converged = this.iteration > 50 &&
      residual.continuity < 1e-5 &&
      residual.axialMomentum < 1e-5 &&
      residual.radialMomentum < 1e-5 &&
      residual.energy < 1e-5 &&
      (this.config.turbulence === "laminar" || residual.turbulence < 1e-5) &&
      massFlowRelativeSpread < 0.02;
    return {
      iteration: this.iteration,
      pseudoTimeS: this.pseudoTimeS,
      cfl: this.effectiveCfl || this.config.cfl,
      dtS: this.lastDtS,
      minDensityKgM3,
      minPressurePa,
      minTemperatureK,
      maxMach,
      maxVelocityMS,
      maxTurbulentViscosityRatio,
      massFlowRelativeSpread,
      ...this.counters,
      converged,
      failed: this.failed,
      failureReason: this.failureReason,
      residual,
      massFlow
    };
  }

  private fieldValues(name: CfdFieldName) {
    const values = new Float32Array(this.mesh.cells);
    for (let index = 0; index < this.mesh.cells; index += 1) {
      if (name === "mach") values[index] = this.primitive.mach[index];
      else if (name === "pressure") values[index] = this.primitive.p[index];
      else if (name === "temperature") values[index] = this.primitive.temperature[index];
      else if (name === "density") values[index] = this.primitive.rho[index];
      else if (name === "velocity") values[index] = Math.hypot(this.primitive.u[index], this.primitive.v[index]);
      else if (name === "axialVelocity") values[index] = this.primitive.u[index];
      else if (name === "turbulentViscosityRatio") {
        values[index] = this.primitive.muT[index] / Math.max(this.primitive.mu[index], 1e-20);
      } else values[index] = this.lastUpdate[index];
    }
    return values;
  }

  createSnapshot(): SolverSnapshot {
    const fieldNames: CfdFieldName[] = [
      "mach",
      "pressure",
      "temperature",
      "density",
      "velocity",
      "axialVelocity",
      "turbulentViscosityRatio",
      "residual"
    ];
    const fields = {} as Record<CfdFieldName, Float32Array>;
    const ranges = {} as Record<CfdFieldName, { min: number; max: number }>;
    for (const name of fieldNames) {
      const values = this.fieldValues(name);
      fields[name] = values;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const value of values) {
        if (!Number.isFinite(value)) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        min = 0;
        max = 1;
      } else if (Math.abs(max - min) < 1e-20) {
        max = min + 1;
      }
      ranges[name] = { min, max };
    }
    return {
      mesh: {
        nx: this.mesh.nx,
        nr: this.mesh.nr,
        lengthM: this.mesh.lengthM,
        nozzleLengthM: this.mesh.nozzleLengthM,
        nozzleExitIndex: this.mesh.nozzleExitIndex,
        maxRadiusM: this.mesh.maxRadiusM,
        xFaces: Float32Array.from(this.mesh.xFaces),
        wallFaces: Float32Array.from(this.mesh.wallFaces),
        columnOuterRadius: Float32Array.from(this.mesh.wallCenters),
        cellR: Float32Array.from(this.mesh.cellR)
      },
      fields,
      ranges,
      diagnostics: this.getDiagnostics()
    };
  }

  getResidualHistory() {
    return [...this.residualHistory];
  }

  getState() {
    return cloneState(this.state);
  }

  getPrimitive() {
    return this.primitive;
  }
}

export function createDefaultRansSolver(config: Partial<RansSolverConfig> = {}) {
  return new AxisymmetricRansSolver(config);
}
