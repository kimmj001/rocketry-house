"use client";

import { useEffect, useMemo } from "react";
import { ArrowDown, ArrowUp, Download, FlaskConical, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RocketViewer3D } from "@/components/rocket-viewer-3d";
import { useCadStore } from "@/lib/cad/store";
import { exportDesignJson, exportOrkLikeXml } from "@/lib/cad/geometry";
import type { RocketProject } from "@/lib/types";

export function ComponentTree() {
  const { components, selectedId, select, reorder } = useCadStore();
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-100/70">Components</h2>
      <div className="mt-4 space-y-2">
        {components.map((component) => (
          <div key={component.id} className={`flex items-center justify-between rounded-md border p-2 text-sm ${selectedId === component.id ? "border-orange-300/60 bg-orange-300/10" : "border-white/10 bg-white/[0.03]"}`}>
            <button className="text-left" onClick={() => select(component.id)}>{component.name}<span className="block text-xs text-orange-50/50">{component.type.replaceAll("_", " ")}</span></button>
            <span className="flex gap-1">
              <button aria-label="Move up" onClick={() => reorder(component.id, -1)}><ArrowUp className="h-4 w-4" /></button>
              <button aria-label="Move down" onClick={() => reorder(component.id, 1)}><ArrowDown className="h-4 w-4" /></button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ParameterPanel() {
  const { components, selectedId, updateComponent } = useCadStore();
  const selected = components.find((component) => component.id === selectedId);
  if (!selected) return <Card className="p-4 text-sm text-orange-50/70">Select a component to edit parameters.</Card>;
  const fields: Array<keyof typeof selected> = ["length", "diameter", "wallThickness", "mass", "position", "finRootChord", "finTipChord", "finSpan", "finSweep", "finCount"];
  return (
    <Card className="p-4">
      <h2 className="font-semibold">{selected.name}</h2>
      <label className="mt-4 block text-xs text-orange-50/58">Material</label>
      <input value={selected.material} onChange={(event) => updateComponent(selected.id, { material: event.target.value })} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {fields.map((field) => typeof selected[field] === "number" ? (
          <label key={field as string} className="text-xs text-orange-50/58">
            {(field as string).replace(/([A-Z])/g, " $1")}
            <input type="number" value={selected[field] as number} onChange={(event) => updateComponent(selected.id, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-orange-50" />
          </label>
        ) : null)}
      </div>
    </Card>
  );
}

export function CADEditor({ project }: { project: RocketProject }) {
  const { components, setComponents, versionName, saveVersion } = useCadStore();
  useEffect(() => setComponents(project.components), [project.components, setComponents]);
  const json = useMemo(() => ({ json: exportDesignJson({ ...project, components }), xml: exportOrkLikeXml({ ...project, components }) }), [components, project]);
  const activeComponents = components.length ? components : project.components;
  const airframeLength = Math.max(...activeComponents.map((component) => component.position + component.length));
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]">
      <ComponentTree />
      <div className="space-y-4">
        <RocketViewer3D components={activeComponents} />
        <Card className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-100/70">Model rocket anatomy</h2>
          <div className="mt-3 grid gap-2 text-xs text-orange-50/68 sm:grid-cols-4">
            <p><span className="text-orange-100">Nose and payload:</span> smooth forebody, shoulder/coupler, altimeter bay.</p>
            <p><span className="text-orange-100">Recovery:</span> parachute bay, bulkhead, shock cord path inside the airframe.</p>
            <p><span className="text-orange-100">Propulsion:</span> internal motor mount, thrust block, centering rings, aft retainer, visible nozzle exit.</p>
            <p><span className="text-orange-100">Stability:</span> swept trapezoidal fins use root chord, tip chord, span, and sweep.</p>
          </div>
          <p className="mt-3 text-xs text-orange-50/50">Airframe reference length: {airframeLength} mm from nose tip to aft retainer.</p>
        </Card>
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-orange-100/70"><FlaskConical className="h-4 w-4 text-cyan-200" />Experimental test article notebook</h2>
          <div className="mt-3 grid gap-2 text-xs text-orange-50/68 sm:grid-cols-3">
            <p><span className="text-orange-100">Motor hardware:</span> casing, bulkhead, nozzle retention, pressure tap, and aft retainer are versioned design notes.</p>
            <p><span className="text-orange-100">Thermal system:</span> liner and inhibitor notes are tracked as inspection metadata, not hidden in attachments.</p>
            <p><span className="text-orange-100">Evidence link:</span> static-fire CSV, pressure trace, post-test photos, and flight logs stay attached to this project version.</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-orange-50/70">Version: <span className="text-orange-100">{versionName}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => saveVersion(`saved ${new Date().toLocaleTimeString()}`)}><Save className="h-4 w-4" />Save version</Button>
              <Button variant="outline"><Upload className="h-4 w-4" />Import XML</Button>
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(json.xml)}><Download className="h-4 w-4" />Export XML</Button>
              <Button onClick={() => navigator.clipboard?.writeText(json.json)}><Download className="h-4 w-4" />Export JSON</Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-orange-50/52">Design packages export structured JSON, interoperable XML, and production-ready geometry through the Rocketry House file pipeline.</p>
        </Card>
      </div>
      <ParameterPanel />
    </div>
  );
}
