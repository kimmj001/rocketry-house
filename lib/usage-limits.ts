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

export const PRO_PLAN_IDS = {
  personal: "personal_pro_monthly",
  team: "team_pro_monthly",
  organization: "organization_pro_monthly",
} as const;

export const PRO_PRICES = {
  personal: "$1.99/mo",
  team: "$4.99/mo",
  organization: "$19.99/mo",
} as const;

export const STANDARD_LIMITS = {
  personal: {
    projectsCreatedCount: 3,
    cfdRunsUsed: 3,
    dmSentCount: 10,
    memberTeamsCount: 0,
    broadcastCount: 0,
    activeEventPagesCount: 0,
  },
  team: {
    projectsCreatedCount: 3,
    cfdRunsUsed: 10,
    dmSentCount: 30,
    memberTeamsCount: 10,
    broadcastCount: 0,
    activeEventPagesCount: 0,
  },
  organization: {
    projectsCreatedCount: 3,
    cfdRunsUsed: 10,
    dmSentCount: 50,
    memberTeamsCount: 5,
    broadcastCount: 3,
    activeEventPagesCount: 1,
  },
} as const;

export type LimitedUsageField = keyof typeof STANDARD_LIMITS.personal;

export function getStandardLimit(accountType: AccountType, field: LimitedUsageField) {
  return STANDARD_LIMITS[accountType][field];
}

export function isUsageLimited(tier: SubscriptionTier) {
  return tier === "standard";
}

export function getUsageStatus(usage: UsageCounters, field: LimitedUsageField) {
  if (!isUsageLimited(usage.subscriptionTier)) {
    return { used: usage[field], limit: Infinity, remaining: Infinity, blocked: false };
  }

  const limit = getStandardLimit(usage.accountType, field);
  const used = usage[field];
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    blocked: used >= limit,
  };
}

export function upgradePromptFor(field: LimitedUsageField) {
  const labels: Record<LimitedUsageField, string> = {
    projectsCreatedCount: "Project creation",
    cfdRunsUsed: "CFD analysis",
    dmSentCount: "Direct messages",
    memberTeamsCount: "Organization teams",
    broadcastCount: "Broadcast announcements",
    activeEventPagesCount: "Event pages",
  };

  return {
    title: "You've reached your Standard plan limit.",
    description: `${labels[field]} is included on the Standard plan with exact monthly limits. Upgrade to Pro to continue within anti-abuse safeguards.`,
    primaryAction: "Upgrade to Pro",
    secondaryAction: "View plans",
    dismissAction: "Maybe later",
  };
}
