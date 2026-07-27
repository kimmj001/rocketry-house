import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import {
  createEmptyUsageCounters,
  currentUsagePeriod,
  getAllUsageStatuses,
  getUsageStatus,
  normalizeAccountType,
  normalizeSubscriptionTier,
  upgradePromptFor,
  type AccountType,
  type LimitedUsageField,
  type SubscriptionTier,
  type UsageCounters
} from "@/lib/usage-limits";

const USAGE_COLLECTION = "usage_counters";

type UsageContext = {
  user: User;
  userId: string;
  accountId: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
  usagePeriod: string;
  ownerKey: string;
  recordKey: string;
};

export type UsageClaimResult = {
  allowed: boolean;
  blocked: boolean;
  usage: UsageCounters;
  statuses: ReturnType<typeof getAllUsageStatuses>;
  prompt?: ReturnType<typeof upgradePromptFor>;
  message?: string;
};

function authTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "account";
}

async function resolveUsageContext(request: Request): Promise<UsageContext> {
  const supabase = getSupabaseClient();
  const token = authTokenFromRequest(request);

  if (!supabase || isMockMode || !token) {
    throw new Error("Cloud sign-in is required before using Standard plan quota.");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Cloud sign-in is required before using Standard plan quota.");
  }

  const user = data.user;
  const metadata = user.user_metadata ?? {};
  const accountType = normalizeAccountType(metadata.account_type);
  const subscriptionTier = normalizeSubscriptionTier(metadata.subscription_tier);
  const accountName = typeof metadata.organization_name === "string" && metadata.organization_name.trim()
    ? metadata.organization_name.trim()
    : user.id;
  const accountId = accountType === "personal" ? user.id : `${accountType}:${accountName}`;
  const usagePeriod = currentUsagePeriod();
  const safeAccount = safeSegment(accountId);

  return {
    user,
    userId: user.id,
    accountId,
    accountType,
    subscriptionTier,
    usagePeriod,
    ownerKey: `usage:${safeAccount}`,
    recordKey: `${safeAccount}:${usagePeriod}`
  };
}

async function loadUsage(context: UsageContext) {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) throw new Error("Cloud usage tracking is not configured.");

  const { data, error } = await supabase
    .from("user_data_records")
    .select("payload")
    .eq("owner_key", context.ownerKey)
    .eq("collection", USAGE_COLLECTION)
    .eq("record_key", context.recordKey)
    .maybeSingle();

  if (error) throw error;

  const now = new Date().toISOString();
  const empty = createEmptyUsageCounters({
    userId: context.userId,
    accountId: context.accountId,
    accountType: context.accountType,
    subscriptionTier: context.subscriptionTier,
    usagePeriod: context.usagePeriod,
    now
  });

  return {
    ...empty,
    ...(data?.payload as Partial<UsageCounters> | undefined),
    userId: context.userId,
    accountId: context.accountId,
    accountType: context.accountType,
    subscriptionTier: context.subscriptionTier,
    usagePeriod: context.usagePeriod
  };
}

async function saveUsage(context: UsageContext, usage: UsageCounters) {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) throw new Error("Cloud usage tracking is not configured.");

  const { error } = await supabase.from("user_data_records").upsert(
    {
      owner_key: context.ownerKey,
      collection: USAGE_COLLECTION,
      record_key: context.recordKey,
      payload: usage,
      updated_at: usage.updatedAt
    },
    { onConflict: "owner_key,collection,record_key" }
  );

  if (error) throw error;
}

export async function getUsageForRequest(request: Request) {
  const context = await resolveUsageContext(request);
  const usage = await loadUsage(context);
  return {
    usage,
    statuses: getAllUsageStatuses(usage)
  };
}

export async function claimUsageForRequest(request: Request, field: LimitedUsageField, delta = 1): Promise<UsageClaimResult> {
  const context = await resolveUsageContext(request);
  const usage = await loadUsage(context);
  const status = getUsageStatus(usage, field);

  if (usage.subscriptionTier === "standard" && status.limit !== null && status.used + delta > status.limit) {
    return {
      allowed: false,
      blocked: true,
      usage,
      statuses: getAllUsageStatuses(usage),
      prompt: upgradePromptFor(field),
      message: "You've reached your Standard plan limit."
    };
  }

  const now = new Date().toISOString();
  const nextUsage: UsageCounters = {
    ...usage,
    [field]: Number(usage[field] ?? 0) + delta,
    updatedAt: now,
    createdAt: usage.createdAt || now
  };

  await saveUsage(context, nextUsage);

  return {
    allowed: true,
    blocked: false,
    usage: nextUsage,
    statuses: getAllUsageStatuses(nextUsage)
  };
}
