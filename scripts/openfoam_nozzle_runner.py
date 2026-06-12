"""
OpenFOAM nozzle CFD runner contract for Rocketry House.

This service is intended to run outside Vercel on a Linux host/container with
OpenFOAM installed. The web app calls POST /nozzle/runs with sanitized geometry
and gas-state inputs. This runner owns:

- axisymmetric nozzle geometry generation
- structured mesh generation with throat refinement
- rhoCentralFoam case execution
- field sampling and JSON/VTK post-processing

It intentionally does not contain propellant formulation or manufacturing steps.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import os
import subprocess
import time
import uuid


@dataclass(frozen=True)
class NozzleCfdInputs:
    chamberPressurePa: float
    chamberTemperatureK: float
    gamma: float
    molecularWeightKgPerKmol: float
    throatDiameterMm: float
    exitDiameterMm: float
    chamberDiameterMm: float
    convergenceAngleDeg: float
    divergenceAngleDeg: float
    convergenceLengthMm: float
    divergenceLengthMm: float
    ambientPressurePa: float
    meshDensity: str


class NozzleGeometry:
    def __init__(self, inputs: NozzleCfdInputs) -> None:
        self.inputs = inputs

    def axial_profile(self) -> list[tuple[float, float]]:
        inlet_radius = self.inputs.chamberDiameterMm / 2000
        throat_radius = self.inputs.throatDiameterMm / 2000
        exit_radius = self.inputs.exitDiameterMm / 2000
        convergence = self.inputs.convergenceLengthMm / 1000
        divergence = self.inputs.divergenceLengthMm / 1000
        return [
            (0.0, inlet_radius),
            (convergence, throat_radius),
            (convergence + divergence, exit_radius),
        ]


class StructuredMeshBuilder:
    def __init__(self, case_dir: Path, geometry: NozzleGeometry) -> None:
        self.case_dir = case_dir
        self.geometry = geometry

    def write_block_mesh_dict(self) -> None:
        system_dir = self.case_dir / "system"
        system_dir.mkdir(parents=True, exist_ok=True)
        profile = self.geometry.axial_profile()
        density = self.geometry.inputs.meshDensity
        axial_cells = {"coarse": 160, "standard": 320, "fine": 640}.get(density, 320)
        radial_cells = {"coarse": 32, "standard": 56, "fine": 96}.get(density, 56)
        throat_refinement = 3 if density == "fine" else 2

        # A production runner should replace this compact placeholder writer with
        # a complete blockMesh/snappyHexMesh description and wedge patches.
        (system_dir / "blockMeshDict").write_text(
            json.dumps(
                {
                    "profile": profile,
                    "axisymmetric": True,
                    "axialCells": axial_cells,
                    "radialCells": radial_cells,
                    "throatRefinementRatio": throat_refinement,
                    "patches": ["inlet totalPressure", "wall noSlip adiabatic", "outlet waveTransmissive", "axis wedge"],
                },
                indent=2,
            ),
            encoding="utf-8",
        )


class RhoCentralFoamCase:
    def __init__(self, case_dir: Path, inputs: NozzleCfdInputs) -> None:
        self.case_dir = case_dir
        self.inputs = inputs

    def write_case_files(self) -> None:
        for folder in ["0", "constant", "system"]:
            (self.case_dir / folder).mkdir(parents=True, exist_ok=True)

        (self.case_dir / "constant" / "thermophysicalProperties.json").write_text(
            json.dumps(
                {
                    "gamma": self.inputs.gamma,
                    "molecularWeightKgPerKmol": self.inputs.molecularWeightKgPerKmol,
                    "chamberTemperatureK": self.inputs.chamberTemperatureK,
                    "ambientPressurePa": self.inputs.ambientPressurePa,
                    "solver": "rhoCentralFoam",
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        (self.case_dir / "system" / "controlDict.json").write_text(
            json.dumps(
                {
                    "application": "rhoCentralFoam",
                    "adjustTimeStep": True,
                    "maxCo": 0.35,
                    "writeInterval": 50,
                    "endTime": 0.006,
                    "residuals": ["rho", "U", "e"],
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def run(self) -> None:
        commands = [["blockMesh"], ["rhoCentralFoam"]]
        for command in commands:
            subprocess.run(command, cwd=self.case_dir, check=True)


class OpenFoamPostProcessor:
    def __init__(self, case_dir: Path) -> None:
        self.case_dir = case_dir

    def export_result(self, run_id: str) -> dict:
        # Production implementation should read OpenFOAM volScalarField /
        # volVectorField files or use pyvista.OpenFOAMReader, then downsample
        # fields for the web payload and write full VTK files for vtk.js.
        result_path = self.case_dir / "postProcessing" / "rocketry-house-result.json"
        if not result_path.exists():
            raise FileNotFoundError("OpenFOAM result export was not produced.")
        result = json.loads(result_path.read_text(encoding="utf-8"))
        result["id"] = run_id
        result["solver"] = "OpenFOAM rhoCentralFoam"
        result["createdAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return result


def run_nozzle_case(payload: dict, workspace: Path) -> dict:
    run_id = str(uuid.uuid4())
    case_dir = workspace / run_id
    case_dir.mkdir(parents=True, exist_ok=True)
    inputs = NozzleCfdInputs(**payload["inputs"])
    geometry = NozzleGeometry(inputs)
    StructuredMeshBuilder(case_dir, geometry).write_block_mesh_dict()
    case = RhoCentralFoamCase(case_dir, inputs)
    case.write_case_files()
    case.run()
    return OpenFoamPostProcessor(case_dir).export_result(run_id)


if __name__ == "__main__":
    request_payload = json.loads(os.environ.get("ROCKETRY_HOUSE_CFD_PAYLOAD", "{}"))
    base = Path(os.environ.get("ROCKETRY_HOUSE_CFD_WORKDIR", "/tmp/rocketry-house-cfd"))
    print(json.dumps(run_nozzle_case(request_payload, base)))
