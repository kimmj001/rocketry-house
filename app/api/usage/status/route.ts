import { NextResponse } from "next/server";
import { getUsageForRequest } from "@/lib/usage-cloud";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await getUsageForRequest(request);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloud usage status could not be loaded." },
      { status: 401 }
    );
  }
}
