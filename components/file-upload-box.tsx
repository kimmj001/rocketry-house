import { UploadCloud } from "lucide-react";

type FileUploadBoxProps = {
  title?: string;
  description?: string;
  formats?: string;
  status?: "required" | "recommended" | "optional";
};

export function FileUploadBox({
  title = "Upload CAD files, messy telemetry, media proof, ZIP archives, interoperable XML, STL, STEP, PDFs, images, and videos.",
  description = "CSV/JSON/TXT are scanned for likely time, altitude, velocity, acceleration, thrust, pressure, and GPS columns. Unknown data falls back to a raw preview and manual mapping.",
  formats = "CSV, JSON, TXT, PDF, images, video links, ZIP, .ork-like XML, STL, STEP",
  status = "optional"
}: FileUploadBoxProps) {
  return (
    <div className="rounded-lg border border-dashed border-orange-200/30 bg-white/[0.03] p-5 text-left transition hover:border-orange-200/55 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <UploadCloud className="h-7 w-7 shrink-0 text-orange-200" />
        <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-orange-50/58">
          {status}
        </span>
      </div>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-orange-50/58">{description}</p>
      <p className="mt-4 rounded-md bg-black/12 p-2 text-xs text-cyan-100/62">{formats}</p>
    </div>
  );
}

export function LegacyFileUploadBox() {
  return (
    <div className="rounded-lg border border-dashed border-orange-200/30 bg-white/[0.03] p-8 text-center">
      <UploadCloud className="mx-auto h-8 w-8 text-orange-200" />
      <p className="mt-3 font-medium">Upload CAD files, messy telemetry, media proof, ZIP archives, interoperable XML, STL, STEP, PDFs, images, and videos.</p>
      <p className="mt-2 text-sm text-orange-50/58">CSV/JSON/TXT are scanned for likely time, altitude, velocity, acceleration, thrust, pressure, and GPS columns. Unknown data falls back to a raw preview and manual mapping.</p>
    </div>
  );
}
