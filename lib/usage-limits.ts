export type AccountType = "personal" | "team" | "organization";
export type SubscriptionTier = "standard" | "pro";

export type UsageCounters = {
  userId?: string;
  accountId: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
  usagePeriod: string;
  projectsCreatedCount: number;
  cfdRunsUsed: number;
  dmSentCount: number;
  memberTeamsCount: number;
  broadcastCount: number;
  activeEventPagesCount: number;
  updatedAt: string;
  createdAt: string;
};

export type LimitedUsageField =
  | "projectsCreatedCount"
  | "cfdRunsUsed"
  | "dmSentCount"
  | "memberTeamsCount"
  | "broadcastCount"
  | "activeEventPagesCount";

export type UsageStatus = {
  used: number;
  limit: number | null;
  remaining: number | null;
  blocked: boolean;
  nearLimit: boolean;
  percentUsed: number;
};

export const PRO_PLAN_IDS = {
  personal: "personal_pro_monthly",
  team: "team_pro_monthly",
  organization: "organization_pro_monthly"
} as const;

export const PRO_PRICES = {
  personal: "$1.99/month",
  team: "$4.99/month",
  organization: "$19.99/month"
} as const;

export const STANDARD_LIMITS: Record<AccountType, Record<LimitedUsageField, number>> = {
  personal: {
    projectsCreatedCount: 3,
    cfdRunsUsed: 3,
    dmSentCount: 10,
    memberTeamsCount: 0,
    broadcastCount: 0,
    activeEventPagesCount: 0
  },
  team: {
    projectsCreatedCount: 3,
    cfdRunsUsed: 10,
    dmSentCount: 30,
    memberTeamsCount: 10,
    broadcastCount: 0,
    activeEventPagesCount: 0
  },
  organization: {
    projectsCreatedCount: 0,
    cfdRunsUsed: 0,
    dmSentCount: 50,
    memberTeamsCount: 5,
    broadcastCount: 3,
    activeEventPagesCount: 1
  }
};

export const USAGE_FIELD_LABELS: Record<LimitedUsageField, string> = {
  projectsCreatedCount: "Projects",
  cfdRunsUsed: "CFD runs",
  dmSentCount: "Messages",
  memberTeamsCount: "Member teams",
  broadcastCount: "Broadcasts",
  activeEventPagesCount: "Event pages"
};

export const USAGE_FIELDS_BY_ACCOUNT: Record<AccountType, Array<{ field: LimitedUsageField; label: string; periodText?: string }>> = {
  personal: [
    { field: "projectsCreatedCount", label: "Projects" },
    { field: "cfdRunsUsed", label: "CFD runs", periodText: "this month" },
    { field: "dmSentCount", label: "Messages", periodText: "this month" }
  ],
  team: [
    { field: "projectsCreatedCount", label: "Projects" },
    { field: "cfdRunsUsed", label: "CFD runs", periodText: "this month" },
    { field: "memberTeamsCount", label: "Team members" },
    { field: "dmSentCount", label: "Messages", periodText: "this month" }
  ],
  organization: [
    { field: "memberTeamsCount", label: "Member teams" },
    { field: "broadcastCount", label: "Broadcasts", periodText: "this month" },
    { field: "activeEventPagesCount", label: "Event pages" },
    { field: "dmSentCount", label: "Messages", periodText: "this month" }
  ]
};

export const ARTICLE_COVERAGE_COPY =
  "Coverage is handled with partner journalists at ICANEWS Global Research. Send a request email to rocketryhouse@gmail.com; ICANEWS will review the request and publish approved coverage on ICANEWS Global Research.";

const UPGRADE_COPY: Record<LimitedUsageField, string> = {
  projectsCreatedCount: "Upgrade to Pro to create unlimited projects.",
  cfdRunsUsed: "Upgrade to Pro for unlimited CFD runs.",
  dmSentCount: "Upgrade to Pro for unlimited messaging.",
  memberTeamsCount: "Upgrade to Pro Organization to add unlimited member teams.",
  broadcastCount: "Upgrade to Pro Organization for unlimited broadcast announcements.",
  activeEventPagesCount: "Upgrade to Pro Organization to create more event and competition pages."
};

export function currentUsagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function createEmptyUsageCounters({
  userId,
  accountId,
  accountType,
  subscriptionTier,
  usagePeriod,
  now = new Date().toISOString()
}: {
  userId?: string;
  accountId: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
  usagePeriod: string;
  now?: string;
}): UsageCounters {
  return {
    userId,
    accountId,
    accountType,
    subscriptionTier,
    usagePeriod,
    projectsCreatedCount: 0,
    cfdRunsUsed: 0,
    dmSentCount: 0,
    memberTeamsCount: 0,
    broadcastCount: 0,
    activeEventPagesCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function getStandardLimit(accountType: AccountType, field: LimitedUsageField) {
  return STANDARD_LIMITS[accountType][field];
}

export function isUsageLimited(tier: SubscriptionTier) {
  return tier === "standard";
}

export function getUsageStatus(usage: UsageCounters, field: LimitedUsageField): UsageStatus {
  const used = Number(usage[field] ?? 0);

  if (!isUsageLimited(usage.subscriptionTier)) {
    return {
      used,
      limit: null,
      remaining: null,
      blocked: false,
      nearLimit: false,
      percentUsed: 0
    };
  }

  const limit = getStandardLimit(usage.accountType, field);
  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    blocked: used >= limit,
    nearLimit: limit > 0 && used / limit >= 0.8 && used < limit,
    percentUsed
  };
}

export function getAllUsageStatuses(usage: UsageCounters) {
  return Object.fromEntries(
    (Object.keys(USAGE_FIELD_LABELS) as LimitedUsageField[]).map((field) => [field, getUsageStatus(usage, field)])
  ) as Record<LimitedUsageField, UsageStatus>;
}

export function usageCounterText(label: string, status: UsageStatus, periodText?: string) {
  const suffix = periodText ? ` ${periodText}` : "";
  if (status.limit === null) return `${label}: ${status.used} used / unlimited${suffix}`;
  return `${label}: ${status.used} / ${status.limit} used${suffix}`;
}

export function usageFieldsForAccount(accountType: AccountType) {
  return USAGE_FIELDS_BY_ACCOUNT[accountType];
}

export function upgradePromptFor(field: LimitedUsageField) {
  return {
    title: "You've reached your Standard plan limit.",
    description: UPGRADE_COPY[field],
    primaryAction: "Upgrade to Pro",
    secondaryAction: "View plans",
    dismissAction: "Maybe later"
  };
}

export function normalizeAccountType(value: unknown): AccountType {
  return value === "team" || value === "organization" || value === "personal" ? value : "personal";
}

export function normalizeSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "pro" ? "pro" : "standard";
}
