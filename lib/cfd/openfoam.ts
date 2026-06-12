import type { NozzleCfdInputs, NozzleCfdResult, NozzleCfdUnavailable } from "@/types/cfd";

const RUNNER_ENV = "OPENFOAM_RUNNER_URL";

export function cfdUnavailable(): NozzleCfdUnavailable {
  return {
    configured: false,
    message:
      "OpenFOAM CFD backend is not configured. Rocketry House will not render fake CFD fields; connect an OpenFOAM runner to run rhoCentralFoam and return solved fields.",
    requiredEnvironment: [RUNNER_ENV, "OPENFOAM_RUNNER_TOKEN optional for private runners"],
    architecture: [
      "Next.js sends nozzle geometry and gas state to the OpenFOAM runner.",
      "Runner generates an axisymmetric structured nozzle case with throat refinement.",
      "rhoCentralFoam advances density, momentum, and energy with shock-capturing numerics.",
      "Post-processing converts OpenFOAM fields to compact JSON and optional VTK for the React viewer."
    ]
  };
}

export function openFoamRunnerConfigured() {
  return Boolean(process.env[RUNNER_ENV]);
}

export async function runOpenFoamNozzleCase(inputs: NozzleCfdInputs): Promise<NozzleCfdResult> {
  const runnerUrl = process.env[RUNNER_ENV];
  if (!runnerUrl) {
    throw new Error("OPENFOAM_RUNNER_URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${runnerUrl.replace(/\/$/, "")}/nozzle/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.OPENFOAM_RUNNER_TOKEN ? { authorization: `Bearer ${process.env.OPENFOAM_RUNNER_TOKEN}` } : {})
      },
      body: JSON.stringify({
        solver: "rhoCentralFoam",
        formulation: "density-based compressible Navier-Stokes",
        numerics: {
          finiteVolume: true,
          fluxScheme: "rhoCentralFoam central-upwind / OpenFOAM shock-capturing",
          reconstruction: "MUSCL-limited",
          cflControlled: true,
          residuals: ["continuity", "momentum", "energy"]
        },
        mesh: {
          type: "axisymmetric structured 2D",
          density: inputs.meshDensity,
          refineNear: ["throat", "wall boundary layer", "expected shock cells"]
        },
        inputs
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenFOAM runner rejected the job (${response.status}): ${text.slice(0, 500)}`);
    }

    return (await response.json()) as NozzleCfdResult;
  } finally {
    clearTimeout(timeout);
  }
}
