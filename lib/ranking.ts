import type { VerificationStatus } from "@/lib/types";

export type RankingEntityKind = "personal" | "team" | "organization";

export type RankingProjectMetrics = {
  projectId: string;
  ownerId: string;
  ownerKind?: RankingEntityKind;
  createdAt?: string;
  updatedAt?: string;
  verificationStatus: VerificationStatus;
  predictedAltitudeM?: number | null;
  actualAltitudeM?: number | null;
  stabilityMarginCalibers?: number | null;
  railExitVelocityMps?: number | null;
  totalImpulseNs?: number | null;
  averageThrustN?: number | null;
  peakThrustN?: number | null;
  burnTimeS?: number | null;
  dryMassG?: number | null;
  loadedMassG?: number | null;
  hasWebCad?: boolean;
  hasFlightLog?: boolean;
  hasTelemetry?: boolean;
  hasThrustData?: boolean;
  hasStaticFireData?: boolean;
  hasStlStep?: boolean;
  hasMediaProof?: boolean;
  hasFailureReport?: boolean;
  successfulRecovery?: boolean;
  launchCount?: number;
  failedLaunchCount?: number;
  likes?: number;
  reviews?: number;
  averageRating?: number;
  comments?: number;
  bookmarks?: number;
  forks?: number;
  downloads?: number;
  purchases?: number;
  citations?: number;
  moderationReports?: number;
  unresolvedSafetyReports?: number;
};

export type RankingScoreBreakdown = {
  evidenceQuality: number;
  engineeringPerformance: number;
  simulationAccuracy: number;
  communityQuality: number;
  reuseImpact: number;
  safetyReliability: number;
  penalties: number;
  score: number;
};

export type RankingAccountMetrics = {
  accountId: string;
  kind: RankingEntityKind;
  projectScores: RankingScoreBreakdown[];
  verifiedLaunches?: number;
  helpfulCommunityAnswers?: number;
  publishedMotors?: number;
  verifiedMotorDatasets?: number;
  organizationApprovalBonus?: boolean;
  moderationReports?: number;
};

export const RANKING_WEIGHT_GROUPS = [
  { key: "evidenceQuality", label: "Evidence quality", weight: 0.3, description: "Verification status, telemetry, media proof, static-fire data, and complete raw evidence." },
  { key: "engineeringPerformance", label: "Engineering performance", weight: 0.2, description: "Altitude, stable rail departure, stability margin, impulse, thrust, and mass efficiency." },
  { key: "simulationAccuracy", label: "Simulation accuracy", weight: 0.15, description: "How closely measured altitude matches the published simulation estimate." },
  { key: "communityQuality", label: "Community quality", weight: 0.15, description: "Reviews, ratings, likes, comments, bookmarks, and cited engineering discussion." },
  { key: "reuseImpact", label: "Reuse impact", weight: 0.1, description: "Forks, downloads, purchases, and downstream reuse of project or motor data." },
  { key: "safetyReliability", label: "Safety and reliability", weight: 0.1, description: "Successful recovery, transparent failure reports, and low unresolved safety-report pressure." }
] as const;

export const RANKING_EVENT_TYPES = [
  "project_published",
  "cad_saved",
  "simulation_saved",
  "flight_log_uploaded",
  "telemetry_uploaded",
  "static_fire_uploaded",
  "media_proof_uploaded",
  "review_created",
  "like_created",
  "bookmark_created",
  "fork_created",
  "download_created",
  "purchase_created",
  "moderation_report_created",
  "verification_event_created"
] as const;

export const RANKING_CATEGORY_RULES = [
  { label: "Highest altitude", primaryMetric: "actualAltitudeM", tiebreaker: "verificationStatus", scope: "verified launches" },
  { label: "Best efficiency", primaryMetric: "actualAltitudeM / loadedMassG", tiebreaker: "simulationAccuracy", scope: "flown projects" },
  { label: "Most downloaded motor", primaryMetric: "downloads", tiebreaker: "verifiedMotorDatasets", scope: "public motors" },
  { label: "Best stability", primaryMetric: "stabilityMarginCalibers", tiebreaker: "railExitVelocityMps", scope: "stable flight envelope" },
  { label: "Longest burn", primaryMetric: "burnTimeS", tiebreaker: "totalImpulseNs", scope: "motor records" },
  { label: "Best educational project", primaryMetric: "evidenceQuality + communityQuality", tiebreaker: "citations", scope: "public projects" },
  { label: "Top organization", primaryMetric: "organization aggregate score", tiebreaker: "verifiedLaunches", scope: "approved teams" },
  { label: "Best telemetry", primaryMetric: "telemetry completeness", tiebreaker: "simulationAccuracy", scope: "flight data" },
  { label: "Top simulation accuracy", primaryMetric: "1 - abs(actual - predicted) / actual", tiebreaker: "evidenceQuality", scope: "measured flights" }
] as const;

const VERIFICATION_SCORES: Record<VerificationStatus, number> = {
  Unverified: 8,
  "Design uploaded": 24,
  "Design reviewed": 38,
  "Simulation estimate": 42,
  "Media proof": 56,
  "Telemetry attached": 74,
  "Static fire data": 78,
  "Flight verified": 100
} as Record<VerificationStatus, number>;

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function logScore(value: number | null | undefined = 0, reference = 100) {
  return clamp((Math.log1p(Math.max(0, value ?? 0)) / Math.log1p(reference)) * 100);
}

function boundedBell(value: number | null | undefined, ideal: number, tolerance: number) {
  if (value == null || !Number.isFinite(value)) return 0;
  return clamp(100 - (Math.abs(value - ideal) / tolerance) * 100);
}

function altitudeScore(actual?: number | null, predicted?: number | null) {
  const altitude = actual ?? predicted ?? 0;
  return logScore(altitude, 100_000);
}

function simulationAccuracyScore(actual?: number | null, predicted?: number | null) {
  if (!actual || !predicted || actual <= 0 || predicted <= 0) return 0;
  const relativeError = Math.abs(actual - predicted) / actual;
  return clamp((1 - relativeError) * 100);
}

function positiveFlagScore(flags: Array<boolean | undefined>, weight = 100) {
  if (!flags.length) return 0;
  return clamp((flags.filter(Boolean).length / flags.length) * weight);
}

export function computeProjectRankingScore(metrics: RankingProjectMetrics): RankingScoreBreakdown {
  const evidenceQuality = clamp(
    VERIFICATION_SCORES[metrics.verificationStatus] * 0.46 +
      positiveFlagScore([
        metrics.hasWebCad,
        metrics.hasFlightLog,
        metrics.hasTelemetry,
        metrics.hasThrustData,
        metrics.hasStaticFireData,
        metrics.hasMediaProof,
        metrics.hasStlStep
      ]) * 0.42 +
      logScore(metrics.citations, 40) * 0.12
  );

  const stabilityScore = boundedBell(metrics.stabilityMarginCalibers, 1.8, 2.5);
  const railExitScore = metrics.railExitVelocityMps == null ? 0 : clamp((metrics.railExitVelocityMps / 30) * 100);
  const impulseScore = logScore(metrics.totalImpulseNs, 10_000);
  const massEfficiencyScore = metrics.loadedMassG && (metrics.actualAltitudeM ?? metrics.predictedAltitudeM)
    ? logScore((metrics.actualAltitudeM ?? metrics.predictedAltitudeM ?? 0) / Math.max(1, metrics.loadedMassG / 1000), 2000)
    : 0;

  const engineeringPerformance = clamp(
    altitudeScore(metrics.actualAltitudeM, metrics.predictedAltitudeM) * 0.32 +
      stabilityScore * 0.2 +
      railExitScore * 0.16 +
      impulseScore * 0.16 +
      massEfficiencyScore * 0.16
  );

  const simulationAccuracy = simulationAccuracyScore(metrics.actualAltitudeM, metrics.predictedAltitudeM);

  const communityQuality = clamp(
    logScore(metrics.likes, 1000) * 0.24 +
      logScore(metrics.comments, 240) * 0.18 +
      logScore(metrics.bookmarks, 500) * 0.16 +
      logScore(metrics.reviews, 120) * 0.14 +
      clamp(((metrics.averageRating ?? 0) / 5) * 100) * 0.2 +
      logScore(metrics.citations, 80) * 0.08
  );

  const reuseImpact = clamp(
    logScore(metrics.forks, 250) * 0.38 +
      logScore(metrics.downloads, 5000) * 0.34 +
      logScore(metrics.purchases, 1000) * 0.18 +
      Number(Boolean(metrics.hasWebCad)) * 10
  );

  const launchCount = Math.max(0, metrics.launchCount ?? 0);
  const failedLaunchCount = Math.max(0, metrics.failedLaunchCount ?? 0);
  const successRate = launchCount ? clamp(((launchCount - failedLaunchCount) / launchCount) * 100) : 0;
  const safetyReliability = clamp(
    successRate * 0.38 +
      Number(Boolean(metrics.successfulRecovery)) * 28 +
      Number(Boolean(metrics.hasFailureReport)) * 12 +
      (100 - logScore(metrics.unresolvedSafetyReports, 12)) * 0.22
  );

  const penalties = clamp(
    logScore(metrics.moderationReports, 10) * 0.55 +
      logScore(metrics.unresolvedSafetyReports, 10) * 0.45
  );

  const score = clamp(
    evidenceQuality * 0.3 +
      engineeringPerformance * 0.2 +
      simulationAccuracy * 0.15 +
      communityQuality * 0.15 +
      reuseImpact * 0.1 +
      safetyReliability * 0.1 -
      penalties * 0.35
  );

  return {
    evidenceQuality: round(evidenceQuality),
    engineeringPerformance: round(engineeringPerformance),
    simulationAccuracy: round(simulationAccuracy),
    communityQuality: round(communityQuality),
    reuseImpact: round(reuseImpact),
    safetyReliability: round(safetyReliability),
    penalties: round(penalties),
    score: round(score)
  };
}

export function computeAccountRankingScore(metrics: RankingAccountMetrics) {
  const sortedProjectScores = [...metrics.projectScores].map((item) => item.score).sort((a, b) => b - a);
  const projectPortfolioScore = sortedProjectScores.reduce((total, score, index) => {
    const diminishingWeight = index < 3 ? 1 : index < 8 ? 0.45 : 0.18;
    return total + score * diminishingWeight;
  }, 0);
  const portfolioNormalizer = Math.max(1, Math.min(5.25, sortedProjectScores.length || 1));

  const score = clamp(
    (projectPortfolioScore / portfolioNormalizer) * 0.66 +
      logScore(metrics.verifiedLaunches, 30) * 0.1 +
      logScore(metrics.helpfulCommunityAnswers, 200) * 0.08 +
      logScore(metrics.publishedMotors, 50) * 0.06 +
      logScore(metrics.verifiedMotorDatasets, 30) * 0.06 +
      Number(Boolean(metrics.organizationApprovalBonus)) * 4 -
      logScore(metrics.moderationReports, 10) * 0.18
  );

  return round(score);
}

export function computeOrganizationRankingScore(accounts: RankingAccountMetrics[]) {
  const sorted = accounts.map(computeAccountRankingScore).sort((a, b) => b - a);
  if (!sorted.length) return 0;
  const total = sorted.reduce((sum, score, index) => {
    const scale = index < 5 ? 1 : index < 20 ? 0.42 : 0.14;
    return sum + score * scale;
  }, 0);
  const normalizer = Math.max(1, Math.min(10.6, sorted.length || 1));
  return round(clamp(total / normalizer));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
