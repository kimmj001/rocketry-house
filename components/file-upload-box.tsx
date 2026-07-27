"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { uploadPersistentFiles, type PersistentFileRecord } from "@/lib/cloud-persistence";

const DEFAULT_ACCEPTED_SPECIFIERS = [
  ".ork",
  ".ork.gz",
  ".xml",
  ".stl",
  ".step",
  ".stp",
  ".json",
  ".csv",
  ".txt",
  ".pdf",
  ".zip",
  ".eng",
  ".rse",
  "image/*",
  "video/*",
];

type FileUploadBoxProps = {
  title?: string;
  description?: string;
  formats?: string;
  status?: "required" | "recommended" | "optional";
  compact?: boolean;
  acceptedSpecifiers?: string[];
  maxRecommendedSizeMb?: number;
  onFilesSelected?: (title: string, files: File[], records?: PersistentFileRecord[]) => void;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function matchesSpecifier(file: File, specifier: string) {
  const normalized = specifier.toLowerCase();
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (normalized.endsWith("/*")) return type.startsWith(normalized.slice(0, -1));
  if (normalized.startsWith(".")) return name.endsWith(normalized);
  return type === normalized;
}

function classifyFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".ork") || name.endsWith(".ork.gz") || name.endsWith(".xml")) return "OpenRocket";
  if (name.endsWith(".eng") || name.endsWith(".rse")) return "Motor data";
  if (name.endsWith(".stl") || name.endsWith(".step") || name.endsWith(".stp")) return "CAD";
  if (name.endsWith(".csv") || name.endsWith(".json") || name.endsWith(".txt")) return "Telemetry";
  if (type.startsWith("image/") || type.startsWith("video/")) return "Proof media";
  if (name.endsWith(".pdf") || name.endsWith(".zip")) return "Package";
  return "File";
}

export function FileUploadBox({
  title = "Upload CAD files, messy telemetry, media proof, ZIP archives, interoperable XML, STL, STEP, PDFs, images, and videos.",
  description = "CSV/JSON/TXT are scanned for likely time, altitude, velocity, acceleration, thrust, pressure, and GPS columns. Unknown data falls back to a raw preview and manual mapping.",
  formats = "CSV, JSON, TXT, PDF, images, video links, ZIP, .ork-like XML, STL, STEP",
  status = "optional",
  compact = false,
  acceptedSpecifiers = DEFAULT_ACCEPTED_SPECIFIERS,
  maxRecommendedSizeMb = 75,
  onFilesSelected
}: FileUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const errorId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [syncState, setSyncState] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [feedback, setFeedback] = useState("");

  function openPicker() {
    inputRef.current?.click();
  }

  function selectFiles(nextFiles: FileList | File[] | null) {
    const selected = Array.from(nextFiles ?? []);
    const accepted = selected.filter((file) => acceptedSpecifiers.some((specifier) => matchesSpecifier(file, specifier)));
    const rejected = selected.filter((file) => !accepted.includes(file));
    const oversized = accepted.filter((file) => file.size > maxRecommendedSizeMb * 1024 * 1024);

    setFiles(accepted);
    if (rejected.length) {
      setFeedback(`${rejected.length} unsupported file${rejected.length === 1 ? "" : "s"} skipped. Check the accepted formats.`);
    } else if (oversized.length) {
      setFeedback(`${oversized.length} large file${oversized.length === 1 ? "" : "s"} selected. Sync may take longer on limited connections.`);
    } else {
      setFeedback("");
    }

    if (!accepted.length) {
      setSyncState(selected.length ? "No supported files were selected." : "");
      onFilesSelected?.(title, [], []);
      return;
    }

    setSyncState("Saving file record...");
    onFilesSelected?.(title, accepted);
    void uploadPersistentFiles(title, accepted)
      .then((records) => {
        const cloudCount = records.filter((record) => record.publicUrl).length;
        onFilesSelected?.(title, accepted, records);
        setSyncState(cloudCount ? `${cloudCount} file${cloudCount === 1 ? "" : "s"} uploaded to cloud storage.` : "File metadata saved locally. Add Supabase env vars for cloud file storage.");
      })
      .catch(() => setSyncState("File names were kept in this session, but persistent upload failed."));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFiles(event.dataTransfer.files);
  }

  const theme = compact
    ? "min-h-0 border-slate-200 bg-slate-50 px-2 py-1 text-slate-950 hover:border-orange-300 hover:bg-orange-50"
    : "border-slate-300 bg-white p-4 text-slate-950 shadow-sm hover:border-orange-400 hover:bg-orange-50/45";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-describedby={feedback ? `${descriptionId} ${errorId}` : descriptionId}
      aria-invalid={Boolean(feedback)}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
      }}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-lg border border-dashed text-left outline-none transition focus-visible:ring-2 focus-visible:ring-orange-400 ${
        dragActive ? "border-orange-500 bg-orange-50" : theme
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedSpecifiers.join(",")}
        className="sr-only"
        onChange={(event) => {
          selectFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-center justify-between gap-2">
        {files.length ? <CheckCircle2 className={`${compact ? "h-3.5 w-3.5 text-emerald-600" : "h-7 w-7 text-emerald-600"} shrink-0`} /> : <UploadCloud className={`${compact ? "h-3.5 w-3.5 text-orange-600" : "h-7 w-7 text-orange-600"} shrink-0`} />}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${compact ? "hidden" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {status}
        </span>
      </div>
      <p className={`${compact ? "mt-0.5 truncate text-[11px]" : "mt-3 text-sm"} font-black`}>{title}</p>
      <p id={descriptionId} className={`${compact ? "sr-only" : "mt-1 text-xs font-semibold leading-5 text-slate-600"}`}>{description}</p>
      <p className={`${compact ? "mt-0.5 truncate bg-white px-1.5 py-0.5 text-[9px] leading-3 text-slate-500" : "mt-3 rounded-md bg-slate-50 p-2 text-xs font-semibold text-slate-600"}`}>
        {formats} <span className="text-slate-400">Recommended under {maxRecommendedSizeMb} MB each.</span>
      </p>
      {feedback ? (
        <p id={errorId} className={`${compact ? "mt-1 text-[9px]" : "mt-2 text-xs"} flex items-start gap-1 font-bold text-amber-700`}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {feedback}
        </p>
      ) : null}
      {files.length ? (
        <div className={`mt-2 space-y-1 rounded-md p-1.5 text-[10px] ${compact ? "bg-emerald-50 text-emerald-800" : "bg-emerald-50 text-emerald-900"}`}>
          {files.slice(0, compact ? 2 : 4).map((file) => (
            <div key={`${file.name}-${file.size}`} className="flex min-w-0 items-center justify-between gap-2 rounded bg-white/70 px-1.5 py-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-bold">{file.name}</span>
              </span>
              <span className="shrink-0 text-slate-500">{classifyFile(file)} / {formatBytes(file.size)}</span>
            </div>
          ))}
          {files.length > (compact ? 2 : 4) ? <p>+{files.length - (compact ? 2 : 4)} more files</p> : null}
          {syncState ? <p className={compact ? "text-emerald-700" : "text-emerald-700"}>{syncState}</p> : null}
        </div>
      ) : (
        compact ? null : <p className="mt-2 text-[11px] font-semibold text-slate-500">Click, focus and press Enter, or drop files here.</p>
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
