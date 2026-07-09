import { NextResponse } from "next/server";
import { solveInternalNozzleCfd } from "@/lib/cfd/internal-nozzle-solver";
import type { NozzleCfdInputs } from "@/types/cfd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateInputs(body: Partial<NozzleCfdInputs>) {
  const required: Array<keyof NozzleCfdInputs> = [
    "chamberPressurePa",
    "chamberTemperatureK",
    "gamma",
    "molecularWeightKgPerKmol",
    "throatDiameterMm",
    "exitDiameterMm",
    "chamberDiameterMm",
    "convergenceAngleDeg",
    "divergenceAngleDeg",
    "convergenceLengthMm",
    "divergenceLengthMm",
    "ambientPressurePa"
  ];

  for (const key of required) {
    if (!isFiniteNumber(body[key])) {
      return `Invalid CFD input: ${key} must be a finite number.`;
    }
  }

  if ((body.throatDiameterMm ?? 0) <= 0 || (body.exitDiameterMm ?? 0) <= 0) {
    return "Nozzle throat and exit diameters must be positive.";
  }

  if ((body.exitDiameterMm ?? 0) < (body.throatDiameterMm ?? 0)) {
    return "Nozzle exit diameter must be greater than or equal to throat diameter.";
  }

  if (!["coarse", "standard", "fine", "research"].includes(body.meshDensity ?? "")) {
    return "Mesh density must be coarse, standard, fine, or research.";
  }

  return null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<NozzleCfdInputs>;
  const validationError = validateInputs(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = solveInternalNozzleCfd(body as NozzleCfdInputs);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal CFD solver failed." },
      { status: 500 }
    );
  }
}
