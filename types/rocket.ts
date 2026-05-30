import type { SavedMotor } from "@/types/motor";
import type { RocketComponent, SimulationResult } from "@/lib/types";

export type RocketBuildDesign = {
  name: string;
  components: RocketComponent[];
  selectedMotor?: SavedMotor;
  motorMountPositionMm: number;
  simulation?: SimulationResult;
};
