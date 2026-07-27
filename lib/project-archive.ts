import type { Difficulty, RocketComponent, RocketProject, TelemetryDataset, VerificationStatus } from "@/lib/types";

type UploadedProjectPayload = Partial<RocketProject> & {
  name?: string;
  status?: string;
  source?: string;
  visibility?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  referenceUrl?: string;
  referenceName?: string;
  uploadedAt?: string;
  cad?: {
    components?: RocketComponent[];
    totalLength?: number;
    totalMass?: number;
    cg?: number;
    cp?: number;
    stability?: number | string;
  };
  summary?: {
    predictedAltitudeM?: number;
    actualAltitudeM?: number | null;
    motorClass?: string;
    propellantFamily?: string;
    evidenceFileCount?: number;
    lengthMm?: number;
    dryMassG?: number;
    cgMm?: number;
    cpMm?: number;
    stabilityMargin?: number;
  };
  evidence?: Record<string, unknown>;
  accessPolicy?: {
    priceCents?: number;
    usageRights?: string;
    forkPolicy?: string;
  };
};

type ProjectRecordLike = {
  record_key?: string;
  payload: UploadedProjectPayload;
  updated_at?: string;
};

const difficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "High Power"];
const verificationStatuses: VerificationStatus[] = [
  "Unverified",
  "Design uploaded",
  "Design reviewed",
  "Media proof",
  "Telemetry attached",
  "Static fire data",
  "Flight verified"
];

function normalizedDifficulty(value: unknown): Difficulty {
  if (typeof value !== "string") return "Intermediate";
  const exact = difficulties.find((item) => item.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  if (/high/i.test(value)) return "High Power";
  if (/advanced/i.test(value)) return "Advanced";
  if (/beginner/i.test(value)) return "Beginner";
  return "Intermediate";
}

function normalizedVerification(value: unknown): VerificationStatus {
  if (typeof value !== "string") return "Design uploaded";
  const exact = verificationStatuses.find((item) => item.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  if (/media|proof/i.test(value)) return "Media proof";
  if (/telemetry/i.test(value)) return "Telemetry attached";
  if (/static/i.test(value)) return "Static fire data";
  if (/flight/i.test(value)) return "Flight verified";
  if (/review/i.test(value)) return "Design reviewed";
  if (/simulation|estimate/i.test(value)) return "Design uploaded";
  return "Design uploaded";
}

function slugFrom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function telemetryFrom(project: UploadedProjectPayload): TelemetryDataset {
  const altitude = Number(project.summary?.predictedAltitudeM ?? project.predictedAltitudeM ?? 600);
  const thrust = project.hasThrustData ? 120 : 80;
  return {
    id: `${project.slug ?? project.id ?? "project"}-telemetry`,
    filename: "archive-preview.csv",
    columns: ["time_s", "altitude_m", "velocity_mps", "thrust_n"],
    recognized: true,
    points: Array.from({ length: 12 }, (_, index) => {
      const phase = index / 11;
      return {
        time: index,
        altitude: Math.round(Math.sin(phase * Math.PI) * altitude),
        velocity: Math.round(Math.max(0, Math.cos((phase - 0.18) * Math.PI)) * Math.sqrt(Math.max(altitude, 1)) * 2.4),
        thrust: index < 4 ? Math.round(thrust * (1 - index * 0.18)) : 0
      };
    })
  };
}

function specsFrom(project: UploadedProjectPayload, components: RocketComponent[]) {
  const lengthMm =
    project.specs?.lengthMm ??
    project.summary?.lengthMm ??
    project.cad?.totalLength ??
    Math.max(...components.map((part) => part.position + part.length), 1000);
  const diameterMm = project.specs?.diameterMm ?? Math.max(...components.map((part) => part.diameter), 54);
  const massG =
    project.specs?.massG ??
    project.summary?.dryMassG ??
    project.cad?.totalMass ??
    components.reduce((sum, part) => sum + part.mass, 0);
  const stabilityCalibers =
    project.specs?.stabilityCalibers ??
    project.summary?.stabilityMargin ??
    Number(project.cad?.stability ?? 1.5);
  return {
    lengthMm: Math.round(lengthMm),
    diameterMm: Math.round(diameterMm),
    massG: Math.round(massG),
    stabilityCalibers: Number(Number(stabilityCalibers).toFixed(2))
  };
}

function hasEvidence(project: UploadedProjectPayload, pattern: RegExp) {
  const evidenceText = JSON.stringify(project.evidence ?? {});
  const tagsText = (project.tags ?? []).join(" ");
  return pattern.test(`${evidenceText} ${tagsText}`);
}

export function archivedProjectToRocketProject(record: ProjectRecordLike, index = 0): RocketProject {
  const payload = record.payload ?? {};
  const slug = payload.slug ?? payload.id ?? record.record_key ?? slugFrom(payload.title ?? payload.name ?? `public-project-${index + 1}`);
  const title = payload.title ?? payload.name ?? "Untitled rocket project";
  const components = payload.components ?? payload.cad?.components ?? [];
  const verificationStatus = normalizedVerification(payload.verificationStatus ?? payload.status);
  const actualAltitude = payload.actualAltitudeM ?? payload.summary?.actualAltitudeM ?? undefined;
  const publicReferenceUrl =
    payload.publicReference?.url ??
    payload.referenceUrl ??
    (typeof payload.evidence?.["Reference URL"] === "string" ? payload.evidence["Reference URL"] : undefined);

  return {
    id: payload.id ?? slug,
    slug,
    title,
    creator: payload.creator ?? "Rocketry House builder",
    creatorRating: payload.creatorRating ?? Number((4.2 + (index % 6) * 0.1).toFixed(1)),
    description:
      payload.description ??
      "A public Rocketry House project package with web CAD metadata, motor context, evidence attachments, and access settings.",
    priceCents: payload.priceCents ?? payload.accessPolicy?.priceCents ?? 0,
    tags: payload.tags ?? [payload.summary?.propellantFamily, payload.summary?.motorClass, payload.visibility].filter(Boolean) as string[],
    difficulty: normalizedDifficulty(payload.difficulty),
    motorClass: payload.motorClass ?? payload.summary?.motorClass ?? "Solid rocket motor",
    predictedAltitudeM: Math.round(payload.predictedAltitudeM ?? payload.summary?.predictedAltitudeM ?? 0),
    actualAltitudeM: actualAltitude === null ? undefined : actualAltitude,
    verificationStatus,
    hasWebCad: payload.hasWebCad ?? components.length > 0,
    hasFlightLog: payload.hasFlightLog ?? hasEvidence(payload, /flight|launch|log/i),
    hasTelemetry: payload.hasTelemetry ?? hasEvidence(payload, /telemetry|altimeter|gps|csv/i),
    hasThrustData: payload.hasThrustData ?? hasEvidence(payload, /thrust|motor|rasp|eng/i),
    hasStlStep: payload.hasStlStep ?? hasEvidence(payload, /stl|step|cad/i),
    verifiedFlight: payload.verifiedFlight ?? verificationStatus === "Flight verified",
    forkCount: payload.forkCount ?? Math.max(0, index * 3),
    downloadCount: payload.downloadCount ?? Math.max(0, 120 + index * 37),
    image: payload.image ?? payload.imageUrl ?? payload.thumbnailUrl ?? "/placeholder.svg",
    specs: specsFrom(payload, components),
    files: payload.files ?? ["design.rh.json", "project-summary.json", "evidence-index.json"],
    components,
    telemetry: payload.telemetry ?? telemetryFrom(payload),
    originalProjectId: payload.originalProjectId,
    royaltyPercent: payload.royaltyPercent ?? 2,
    selectedMotorId: payload.selectedMotorId,
    selectedMotorVersionId: payload.selectedMotorVersionId,
    motorMountPosition: payload.motorMountPosition,
    rocketSimulationResultJson: payload.rocketSimulationResultJson,
    publicReference: publicReferenceUrl
      ? {
          name: payload.publicReference?.name ?? payload.referenceName ?? publicReferenceUrl,
          url: publicReferenceUrl
        }
      : undefined
  };
}
