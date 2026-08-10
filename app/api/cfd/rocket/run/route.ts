import { NextResponse } from "next/server";
import { claimUsageForRequest } from "@/lib/usage-cloud";
import { prepareExternalCfdRun, runExternalCfd } from "@/lib/cfd/external/service";
import { ExternalCfdError } from "@/lib/cfd/external/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prepared = prepareExternalCfdRun(body);
    if (prepared.cached) return NextResponse.json(prepared.cached, { headers: { "x-cfd-cache": "hit" } });

    const usageClaim = await claimUsageForRequest(request, "cfdRunsUsed");
    if (usageClaim.blocked) return NextResponse.json(usageClaim, { status: 402 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (payload: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        send({ type: "progress", progress: { state: "queued", progress: 0, message: "CFD run accepted" } });
        void runExternalCfd(prepared.input, prepared.cacheKey, (progress) => send({ type: "progress", progress }))
          .then((result) => {
            send({ type: "result", result, usage: usageClaim.usage, usageStatuses: usageClaim.statuses });
            controller.close();
          })
          .catch((error) => {
            const failure = error instanceof ExternalCfdError
              ? { status: "failed", reason: error.reason, error: error.message }
              : { status: "failed", reason: "NUMERICAL_INSTABILITY", error: "The external CFD solver failed safely." };
            send({ type: "error", ...failure });
            controller.close();
          });
      }
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    const known = error instanceof ExternalCfdError;
    return NextResponse.json(
      {
        status: "failed",
        reason: known ? error.reason : "INVALID_INPUT",
        error: known ? error.message : error instanceof Error ? error.message : "Invalid external CFD request."
      },
      { status: known ? 400 : error instanceof Error && /sign-in/i.test(error.message) ? 401 : 500 }
    );
  }
}
