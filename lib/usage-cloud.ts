import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  createEmptyUsageCounters,
  currentUsagePeriod,
  getAllUsageStatuses,
  getUsageStatus,
  moveUsageToPeriod,
  normalizeUsageCount,
  normalizeAccountType,
  normalizeSubscriptionTier,
  upgradePromptFor,
  type AccountType,
  type LimitedUsageField,
  type SubscriptionTier,
  type UsageCounters
} from "@/lib/usage-limits";

const USAGE_COLLECTION = "usage_counters";
const ACCOUNT_STATUS_OWNER_KEY = "admin:account-status";
const ACCOUNT_STATUS_COLLECTION = "account_status";

type UsageContext = {
  supabase: SupabaseClient;
  user: User;
  userId: string;
  accountId: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
  usagePeriod: string;
  ownerKey: string;
  recordKey: string;
  legacyOwnerKey?: string;
};

type StoredUsageRecord = {
  usage: UsageCounters;
  exists: boolean;
  updatedAt?: string;
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

function isUniqueConflict(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "");
}

function safeRecordKey(value: string) {
  return value.replace(/[^a-zA-Z0-9@._:-]+/g, "-").replace(/^-|-$/g, "") || "account";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function loadAccountStatusOverride(user: User, supabase: SupabaseClient) {
  const keys = Array.from(new Set([user.email ? safeRecordKey(user.email.toLowerCase()) : "", safeRecordKey(user.id)].filter(Boolean)));
  if (!keys.length) return {};

  const { data } = await supabase
    .from("user_data_records")
    .select("payload, updated_at")
    .eq("owner_key", ACCOUNT_STATUS_OWNER_KEY)
    .eq("collection", ACCOUNT_STATUS_COLLECTION)
    .in("record_key", keys)
    .order("updated_at", { ascending: false })
    .limit(1);

  return objectValue(data?.[0]?.payload);
}

async function resolveUsageContext(request: Request): Promise<UsageContext> {
  const token = authTokenFromRequest(request);
  const supabase = getServerSupabaseClient(token);

  if (!supabase || !token) {
    throw new Error("Cloud sign-in is required before using Standard plan quota.");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Cloud sign-in is required before using Standard plan quota.");
  }

  const user = data.user;
  const metadata = user.user_metadata ?? {};
  const statusOverride = await loadAccountStatusOverride(user, supabase);
  const accountType = normalizeAccountType(statusOverride.accountType ?? metadata.account_type);
  const subscriptionTier = normalizeSubscriptionTier(statusOverride.subscriptionTier ?? metadata.subscription_tier);
  const organizationName = stringValue(statusOverride.organizationName) || stringValue(metadata.organization_name);
  const accountName = organizationName
    ? organizationName
    : user.id;
  const legacyAccountId = accountType === "personal" ? user.id : `${accountType}:${accountName}`;
  const accountId = user.id;
  const usagePeriod = currentUsagePeriod();
  const safeAccount = safeSegment(accountId);
  const legacySafeAccount = safeSegment(legacyAccountId);

  return {
    supabase,
    user,
    userId: user.id,
    accountId,
    accountType,
    subscriptionTier,
    usagePeriod,
    ownerKey: `usage:${safeAccount}`,
    recordKey: `${safeAccount}:${usagePeriod}`,
    legacyOwnerKey: legacySafeAccount === safeAccount ? undefined : `usage:${legacySafeAccount}`
  };
}

function normalizeStoredUsage(context: UsageContext, payload: Partial<UsageCounters> | undefined, now: string) {
  const empty = createEmptyUsageCounters({
    userId: context.userId,
    accountId: context.accountId,
    accountType: context.accountType,
    subscriptionTier: context.subscriptionTier,
    usagePeriod: context.usagePeriod,
    now
  });

  const normalized = {
    ...empty,
    ...payload,
    userId: context.userId,
    accountId: context.accountId,
    accountType: context.accountType,
    subscriptionTier: context.subscriptionTier,
    usagePeriod: payload?.usagePeriod || context.usagePeriod
  };
  return moveUsageToPeriod(normalized, context.usagePeriod, now);
}

async function loadUsageRecord(context: UsageContext): Promise<StoredUsageRecord> {
  const supabase = context.supabase;

  const { data, error } = await supabase
    .from("user_data_records")
    .select("payload, updated_at")
    .eq("owner_key", context.ownerKey)
    .eq("collection", USAGE_COLLECTION)
    .eq("record_key", context.recordKey)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return {
      usage: normalizeStoredUsage(context, data.payload as Partial<UsageCounters> | undefined, new Date().toISOString()),
      exists: true,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : undefined
    };
  }

  const ownerKeys = [context.ownerKey, context.legacyOwnerKey].filter(Boolean) as string[];
  const { data: previousRows, error: previousError } = await supabase
    .from("user_data_records")
    .select("owner_key,payload,updated_at")
    .in("owner_key", ownerKeys)
    .eq("collection", USAGE_COLLECTION)
    .order("updated_at", { ascending: false })
    .limit(36);

  if (previousError) throw previousError;
  const previous = (previousRows ?? []).find((row) => {
    const payload = objectValue(row.payload);
    const payloadUserId = stringValue(payload.userId);
    return payloadUserId ? payloadUserId === context.userId : row.owner_key === context.ownerKey;
  });

  return {
    usage: normalizeStoredUsage(context, previous?.payload as Partial<UsageCounters> | undefined, new Date().toISOString()),
    exists: false
  };
}

async function insertUsageRecord(context: UsageContext, usage: UsageCounters) {
  const supabase = context.supabase;

  const { data, error } = await supabase.from("user_data_records").insert(
    {
      owner_key: context.ownerKey,
      collection: USAGE_COLLECTION,
      record_key: context.recordKey,
      payload: usage,
      updated_at: usage.updatedAt
    }
  ).select("payload, updated_at").single();

  if (error) {
    if (isUniqueConflict(error)) return null;
    throw error;
  }

  return normalizeStoredUsage(context, data?.payload as Partial<UsageCounters> | undefined, usage.updatedAt);
}

async function updateUsageRecord(context: UsageContext, previousUpdatedAt: string, usage: UsageCounters) {
  const supabase = context.supabase;

  const { data, error } = await supabase
    .from("user_data_records")
    .update({ payload: usage, updated_at: usage.updatedAt })
    .eq("owner_key", context.ownerKey)
    .eq("collection", USAGE_COLLECTION)
    .eq("record_key", context.recordKey)
    .eq("updated_at", previousUpdatedAt)
    .select("payload, updated_at");

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return normalizeStoredUsage(context, row.payload as Partial<UsageCounters> | undefined, usage.updatedAt);
}

export async function getUsageForRequest(request: Request) {
  const context = await resolveUsageContext(request);
  const { usage } = await loadUsageRecord(context);
  return {
    usage,
    statuses: getAllUsageStatuses(usage)
  };
}

export async function claimUsageForRequest(request: Request, field: LimitedUsageField, delta = 1): Promise<UsageClaimResult> {
  const context = await resolveUsageContext(request);
  const increment = Math.max(1, normalizeUsageCount(delta));

  for (let attempt = 0; attempt < 5; attempt++) {
    const record = await loadUsageRecord(context);
    const { usage } = record;
    const status = getUsageStatus(usage, field);

    if (usage.subscriptionTier === "standard" && status.limit !== null && status.used + increment > status.limit) {
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
      [field]: normalizeUsageCount(usage[field]) + increment,
      updatedAt: now,
      createdAt: usage.createdAt || now
    };

    const savedUsage = record.exists && record.updatedAt
      ? await updateUsageRecord(context, record.updatedAt, nextUsage)
      : await insertUsageRecord(context, nextUsage);

    if (savedUsage) {
      return {
        allowed: true,
        blocked: false,
        usage: savedUsage,
        statuses: getAllUsageStatuses(savedUsage)
      };
    }
  }

  throw new Error("Usage quota changed while claiming. Please try again.");
}

export async function releaseUsageForRequest(request: Request, field: LimitedUsageField, delta = 1): Promise<UsageClaimResult> {
  const context = await resolveUsageContext(request);
  const decrement = Math.max(1, normalizeUsageCount(delta));

  for (let attempt = 0; attempt < 5; attempt++) {
    const record = await loadUsageRecord(context);
    const { usage } = record;
    if (!record.exists || !record.updatedAt) {
      return {
        allowed: true,
        blocked: false,
        usage,
        statuses: getAllUsageStatuses(usage)
      };
    }

    const now = new Date().toISOString();
    const nextUsage: UsageCounters = {
      ...usage,
      [field]: Math.max(0, normalizeUsageCount(usage[field]) - decrement),
      updatedAt: now
    };
    const savedUsage = await updateUsageRecord(context, record.updatedAt, nextUsage);
    if (savedUsage) {
      return {
        allowed: true,
        blocked: false,
        usage: savedUsage,
        statuses: getAllUsageStatuses(savedUsage)
      };
    }
  }

  throw new Error("Usage quota changed while releasing a failed action. Please refresh usage.");
}
