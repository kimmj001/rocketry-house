/// <reference lib="webworker" />

import { AxisymmetricRansSolver } from "../rans/solver";
import type {
  CfdWorkerRequest,
  CfdWorkerResponse,
  RansSolverConfig,
  SolverSnapshot
} from "../rans/types";

let solver: AxisymmetricRansSolver | null = null;
let config: RansSolverConfig | null = null;
let running = false;
let loopScheduled = false;

function transferSnapshot(type: "ready" | "snapshot", snapshot: SolverSnapshot) {
  const response: CfdWorkerResponse = type === "ready"
    ? { type, snapshot }
    : { type, snapshot, running };
  const transfers: Transferable[] = [
    snapshot.mesh.xFaces.buffer,
    snapshot.mesh.wallFaces.buffer,
    snapshot.mesh.columnOuterRadius.buffer,
    snapshot.mesh.cellR.buffer,
    ...Object.values(snapshot.fields).map((field) => field.buffer)
  ];
  self.postMessage(response, { transfer: transfers });
}

function scheduleLoop() {
  if (loopScheduled || !running || !solver) return;
  loopScheduled = true;
  setTimeout(() => {
    loopScheduled = false;
    if (!running || !solver) return;
    try {
      const snapshot = solver.step(config?.iterationsPerBatch ?? 4);
      if (snapshot.diagnostics.failed || snapshot.diagnostics.converged) running = false;
      transferSnapshot("snapshot", snapshot);
      scheduleLoop();
    } catch (error) {
      running = false;
      const response: CfdWorkerResponse = {
        type: "error",
        message: error instanceof Error ? error.message : "CFD worker failed."
      };
      self.postMessage(response);
    }
  }, 0);
}

self.onmessage = (event: MessageEvent<CfdWorkerRequest>) => {
  try {
    const message = event.data;
    if (message.type === "initialize") {
      running = false;
      config = message.config;
      solver = new AxisymmetricRansSolver(config);
      transferSnapshot("ready", solver.createSnapshot());
      return;
    }
    if (!solver) throw new Error("Initialize the CFD solver before running it.");
    if (message.type === "start") {
      running = true;
      self.postMessage({ type: "status", running } satisfies CfdWorkerResponse);
      scheduleLoop();
      return;
    }
    if (message.type === "pause") {
      running = false;
      self.postMessage({ type: "status", running } satisfies CfdWorkerResponse);
      return;
    }
    if (message.type === "step") {
      running = false;
      transferSnapshot("snapshot", solver.step(message.iterations ?? 1));
      return;
    }
    if (message.type === "reset") {
      running = false;
      const nextConfig = message.config ?? config;
      if (!nextConfig) throw new Error("No CFD configuration is available for reset.");
      config = nextConfig;
      solver = new AxisymmetricRansSolver(nextConfig);
      transferSnapshot("ready", solver.createSnapshot());
      return;
    }
    if (message.type === "snapshot") transferSnapshot("snapshot", solver.createSnapshot());
  } catch (error) {
    running = false;
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "CFD worker failed."
    } satisfies CfdWorkerResponse);
  }
};

export {};
