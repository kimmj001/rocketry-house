import { defaultMotorParameters, simulateMotor } from "@/lib/motor-simulation";
import type { SavedMotor } from "@/types/motor";

const simulation = simulateMotor(defaultMotorParameters);

export const mockSavedMotors: SavedMotor[] = [
  {
    id: "motor-campus-h178",
    name: "H178 Static-Fire Motor",
    creator: "North Star Rocketry Lab",
    description: "Reusable motor analysis package with a measured-thrust attachment slot for club test stands.",
    visibility: "public",
    license: "CC BY-NC 4.0",
    priceCents: 0,
    motorType: "Solid Rocket Motor",
    estimatedClass: simulation.motorClass,
    totalImpulseNs: simulation.totalImpulseNs,
    averageThrustN: simulation.averageThrustN,
    peakThrustN: simulation.peakThrustN,
    burnTimeS: simulation.burnTimeS,
    propellantProfileName: defaultMotorParameters.propellantProfileName,
    verificationStatus: "Pre-flight analysis",
    parameters: defaultMotorParameters,
    simulation,
    measuredCurve: simulation.curve.map((point, index) => ({ ...point, thrust: Math.round(point.thrust * (index % 3 === 0 ? 0.94 : 1.04)) })),
    createdAt: "2026-05-22",
    updatedAt: "2026-05-26"
  }
];
