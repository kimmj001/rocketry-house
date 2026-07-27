import type { TelemetryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const defaultRows: TelemetryPoint[] = [
  { time: 0, altitude: 0, velocity: 0 },
  { time: 1, altitude: 88, velocity: 54 },
  { time: 2, altitude: 214, velocity: 76 }
];

export function RawDataPreview({ data = defaultRows, tone = "dark" }: { data?: TelemetryPoint[]; tone?: "dark" | "light" }) {
  const light = tone === "light";
  const rows = [
    ["time_s", "altitude_m", "velocity_mps", "thrust_n"],
    ...data.slice(0, 8).map((point) => [
      formatCell(point.time),
      formatCell(point.altitude),
      formatCell(point.velocity),
      formatCell(point.thrust)
    ])
  ];
  return (
    <div className={cn("overflow-hidden rounded-lg border", light ? "border-slate-200 bg-white" : "border-white/10")}>
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-b last:border-0", light ? "border-slate-200" : "border-white/10")}>
              {row.map((cell, cellIndex) => (
                <td key={`${i}-${cellIndex}`} className={cn("px-3 py-2", light ? (i === 0 ? "font-bold text-slate-700" : "text-slate-600") : "text-orange-50/72")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: number | undefined) {
  if (typeof value !== "number") return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
