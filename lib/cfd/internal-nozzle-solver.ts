import { buildNozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import { generateStructuredMesh } from "@/lib/cfd/axisymmetric/mesh";
import { postProcessNozzleSolution } from "@/lib/cfd/axisymmetric/postprocess";
import { runFiniteVolumeSolver } from "@/lib/cfd/axisymmetric/solver";
import { validateAgainstIsentropicTheory } from "@/lib/cfd/axisymmetric/validation";
import type { NozzleCfdInputs, NozzleCfdResult } from "@/types/cfd";

export function solveInternalNozzleCfd(inputs: NozzleCfdInputs): NozzleCfdResult {
  const geometry = buildNozzleGeometry(inputs);
  const mesh = generateStructuredMesh(geometry, inputs.meshDensity);
  const solver = runFiniteVolumeSolver(inputs, geometry, mesh);
  const result = postProcessNozzleSolution(inputs, mesh, solver);
  const validation = validateAgainstIsentropicTheory(inputs, result);

  return {
    ...result,
    validation
  };
}
