"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelemetryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChartTone = "dark" | "light";

export function TelemetryChart({
  data,
  type = "altitude",
  tone = "dark"
}: {
  data: TelemetryPoint[];
  type?: "altitude" | "velocity" | "thrust";
  tone?: ChartTone;
}) {
  const mounted = useClientMounted();
  const light = tone === "light";
  const color = type === "altitude" ? "#fb923c" : type === "velocity" ? "#5fb8ff" : "#d7b56d";
  const title = type === "altitude" ? "Altitude / time" : type === "velocity" ? "Velocity / time" : "Thrust / time";
  return (
    <div className={cn("h-64 rounded-lg border p-3", light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.03]")}>
      <p className={cn("mb-2 text-xs font-medium", light ? "text-slate-600" : "text-orange-50/62")}>{title}</p>
      {mounted ? (
        <ResponsiveContainer width="100%" height="88%">
          <AreaChart data={data}>
            <CartesianGrid stroke={light ? "rgba(15,23,42,.12)" : "rgba(255,255,255,.08)"} />
            <XAxis dataKey="time" stroke={light ? "#475569" : "#cbbda8"} fontSize={12} unit="s" />
            <YAxis stroke={light ? "#475569" : "#cbbda8"} fontSize={12} />
            <Tooltip contentStyle={light ? { background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a" } : { background: "#101726", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
            <Area type="monotone" dataKey={type} stroke={color} fill={color} fillOpacity={0.22} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <ChartSkeleton />}
    </div>
  );
}

export function MultiTelemetryChart({ data, tone = "dark" }: { data: TelemetryPoint[]; tone?: ChartTone }) {
  const mounted = useClientMounted();
  const light = tone === "light";
  const normalized = data.map((point) => ({
    ...point,
    altitudeKm: typeof point.altitude === "number" ? Number((point.altitude / 1000).toFixed(2)) : undefined,
    thrustKn: typeof point.thrust === "number" ? Number((point.thrust / 1000).toFixed(2)) : undefined
  }));
  return (
    <div className={cn("h-72 rounded-lg border p-3", light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.03]")}>
      <p className={cn("mb-2 text-xs font-medium", light ? "text-slate-600" : "text-orange-50/62")}>Flight profile comparison</p>
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={normalized}>
            <CartesianGrid stroke={light ? "rgba(15,23,42,.12)" : "rgba(255,255,255,.08)"} />
            <XAxis dataKey="time" stroke={light ? "#475569" : "#cbbda8"} fontSize={12} unit="s" />
            <YAxis yAxisId="left" stroke="#fb923c" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" stroke="#5fb8ff" fontSize={12} />
            <Tooltip contentStyle={light ? { background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a" } : { background: "#101726", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
            <Line yAxisId="left" type="monotone" dataKey="altitudeKm" name="altitude km" stroke="#fb923c" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="velocity" name="velocity m/s" stroke="#5fb8ff" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="thrustKn" name="thrust kN" stroke="#d7b56d" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : <ChartSkeleton />}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full min-h-36 rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,.06)_0_1px,transparent_1px_33%),linear-gradient(90deg,rgba(95,184,255,.25),rgba(251,146,60,.2))] opacity-60" />;
}

function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
