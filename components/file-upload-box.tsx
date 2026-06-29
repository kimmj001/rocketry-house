"use client";

import { useRef, useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { uploadPersistentFiles } from "@/lib/cloud-persistence";

type FileUploadBoxProps = {
  title?: string;
  description?: string;
  formats?: string;
  status?: "required" | "recommended" | "optional";
  compact?: boolean;
  onFilesSelected?: (title: string, files: File[]) => void;
};

export function FileUploadBox({
  title = "Upload CAD files, messy telemetry, media proof, ZIP archives, interoperable XML, STL, STEP, PDFs, images, and videos.",
  description = "CSV/JSON/TXT are scanned for likely time, altitude, velocity, acceleration, thrust, pressure, and GPS columns. Unknown data falls back to a raw preview and manual mapping.",
  formats = "CSV, JSON, TXT, PDF, images, video links, ZIP, .ork-like XML, STL, STEP",
  status = "optional",
  compact = false,
  onFilesSelected
}: FileUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [syncState, setSyncState] = useState("");

  function selectFiles(nextFiles: FileList | null) {
    const selected = Array.from(nextFiles ?? []);
    setFiles(selected);
    if (selected.length) {
      setSyncState("Saving file record...");
      onFilesSelected?.(title, selected);
      void uploadPersistentFiles(title, selected)
        .then((records) => {
          const cloudCount = records.filter((record) => record.publicUrl).length;
          setSyncState(cloudCount ? `${cloudCount} file${cloudCount === 1 ? "" : "s"} uploaded to cloud storage.` : "File metadata saved locally. Add Supabase env vars for cloud file storage.");
        })
        .catch(() => setSyncState("File names were kept in this session, but persistent upload failed."));
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      className={`cursor-pointer rounded-lg border border-dashed text-left transition ${
        compact
          ? "min-h-0 border-slate-200 bg-slate-50 px-2 py-1 text-slate-950 hover:border-orange-300 hover:bg-orange-50"
          : "border-orange-200/30 bg-white/[0.03] p-5 hover:border-orange-200/55 hover:bg-white/[0.06]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => selectFiles(event.target.files)}
      />
      <div className="flex items-center justify-between gap-2">
        {files.length ? <CheckCircle2 className={`${compact ? "h-3.5 w-3.5 text-emerald-600" : "h-7 w-7 text-emerald-200"} shrink-0`} /> : <UploadCloud className={`${compact ? "h-3.5 w-3.5 text-orange-600" : "h-7 w-7 text-orange-200"} shrink-0`} />}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compact ? "hidden" : "border-white/12 bg-white/8 text-orange-50/58"}`}>
          {status}
        </span>
      </div>
      <p className={`${compact ? "mt-0.5 truncate text-[11px]" : "mt-4"} font-medium`}>{title}</p>
      <p className={`${compact ? "sr-only" : "mt-2 text-sm leading-6 text-orange-50/58"}`}>{description}</p>
      <p className={`${compact ? "mt-0.5 truncate bg-white px-1.5 py-0.5 text-[9px] leading-3 text-slate-500" : "mt-4 bg-black/12 p-2 text-xs text-cyan-100/62"} rounded-md`}>{formats}</p>
      {files.length ? (
        <div className={`mt-1 space-y-0.5 rounded-md p-1 text-[9px] ${compact ? "bg-emerald-50 text-emerald-800" : "bg-emerald-300/10 text-emerald-50/80"}`}>
          {files.slice(0, 3).map((file) => <p key={`${file.name}-${file.size}`}>{file.name}</p>)}
          {files.length > 3 ? <p>+{files.length - 3} more files</p> : null}
          {syncState ? <p className={compact ? "text-emerald-700" : "text-emerald-50/65"}>{syncState}</p> : null}
        </div>
      ) : (
        compact ? null : <p className="mt-1 text-[10px] text-orange-50/42">Click to choose files.</p>
      )}
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
