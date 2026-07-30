import { buildNozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import { generateStructuredMesh } from "@/lib/cfd/axisymmetric/mesh";
import { postProcessNozzleSolution } from "@/lib/cfd/axisymmetric/postprocess";
import { runFiniteVolumeSolver } from "@/lib/cfd/legacy/inviscid-nozzle-solver";
import { validateAgainstIsentropicTheory } from "@/lib/cfd/axisymmetric/validation";
import type { NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";

/** @deprecated Use solveRansNozzleCfd from lib/cfd/rans/adapter. */
export function solveInternalNozzleCfd(inputs: NozzleCfdInputs): NozzleCfdResult {
  const geometry = buildNozzleGeometry(inputs);
  const mesh = generateStructuredMesh(geometry, inputs.meshDensity);
  const solver = runFiniteVolumeSolver(inputs, geometry, mesh);
  const skippedSteps = Object.entries(solver.audit)
    .filter(([, called]) => !called)
    .map(([name]) => name);

  if (skippedSteps.length) {
    throw new Error(`CFD numerical audit failed. Skipped steps: ${skippedSteps.join(", ")}`);
  }

  const result = postProcessNozzleSolution(inputs, mesh, solver);
  const validation = validateAgainstIsentropicTheory(inputs, result);

  return {
    ...result,
    validation
  };
}
