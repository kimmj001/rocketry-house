import { NextResponse } from "next/server";
import { claimUsageForRequest } from "@/lib/usage-cloud";
import { USAGE_FIELD_LABELS, type LimitedUsageField } from "@/lib/usage-limits";

export const dynamic = "force-dynamic";

function isLimitedUsageField(value: unknown): value is LimitedUsageField {
  return typeof value === "string" && value in USAGE_FIELD_LABELS;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { field?: unknown; delta?: unknown };
    if (!isLimitedUsageField(body.field)) {
      return NextResponse.json({ error: "Usage field is invalid." }, { status: 400 });
    }

    const delta = typeof body.delta === "number" && Number.isFinite(body.delta) && body.delta > 0
      ? Math.ceil(body.delta)
      : 1;
    const result = await claimUsageForRequest(request, body.field, delta);
    return NextResponse.json(result, { status: result.blocked ? 402 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloud usage claim failed." },
      { status: 401 }
    );
  }
}
