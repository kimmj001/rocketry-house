import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ACCOUNT_STATUS_COOKIE_NAME, isAccountStatusSessionValid } from "@/lib/account-status-session";
import { normalizeEmail, type AccountAccessStatus, type AuthUser } from "@/lib/auth";
import type {
  AccountActivity,
  AccountActivityType,
  AccountApprovalStatus,
  AccountDirectoryResponse,
  AccountDirectorySource,
  AccountStatusUpdate,
  AccountStorageSummary,
  ManagedAccount
} from "@/lib/account-status-types";
import { sortAccountsByRecentActivity } from "@/lib/account-status-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fallbackSupabaseUrl = "https://ztoapsloscqxjpxmxbca.supabase.co";
const fallbackSupabaseKey = "sb_publishable_ST11At63jWdmB6QqNhIjYA_ds34-iaR";
const accountStatusOwnerKey = "admin:account-status";
const accountStatusCollection = "account_status";

type UserDataRecord = {
  id?: string;
  owner_key: string;
  collection: string;
  record_key: string;
  payload?: unknown;
  created_at?: string;
  updated_at?: string;
};

type SupabaseMode = "service" | "anon" | "offline";

function isAuthorized(request: NextRequest) {
  return isAccountStatusSessionValid(request.cookies.get(ACCOUNT_STATUS_COOKIE_NAME)?.value);
}

function getServerSupabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const key = serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseKey;

  if (!url || !key) return { client: null, mode: "offline" as SupabaseMode };

  return {
    client: createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }),
    mode: serviceKey ? "service" as SupabaseMode : "anon" as SupabaseMode
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = await buildAccountDirectory();
  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, mode } = getServerSupabaseClient();
  if (!client) {
    return NextResponse.json({ error: "Cloud account directory is offline." }, { status: 503 });
  }

  let updates: AccountStatusUpdate[] = [];
  try {
    const body = (await request.json()) as { updates?: unknown };
    updates = Array.isArray(body.updates) ? body.updates.map(normalizeUpdate).filter(Boolean) as AccountStatusUpdate[] : [];
  } catch {
    updates = [];
  }

  if (!updates.length) {
    return NextResponse.json({ error: "No account updates supplied." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const records = updates.map((update) => ({
    owner_key: accountStatusOwnerKey,
    collection: accountStatusCollection,
    record_key: safeRecordKey(update.email || update.id || update.key),
    payload: {
      ...update,
      email: update.email ? normalizeEmail(update.email) : undefined,
      updatedAt: now,
      lastReviewedAt: now
    },
    updated_at: now
  }));

  const recordKeys = records.map((record) => record.record_key);
  const { data: previousRows } = await client
    .from("user_data_records")
    .select("record_key,payload")
    .eq("owner_key", accountStatusOwnerKey)
    .eq("collection", accountStatusCollection)
    .in("record_key", recordKeys);
  const previousByKey = new Map((previousRows ?? []).map((row) => [row.record_key as string, objectValue(row.payload)]));

  const { error } = await client
    .from("user_data_records")
    .upsert(records, { onConflict: "owner_key,collection,record_key" });

  if (error) {
    return NextResponse.json(
      {
        error: "Account status could not be saved to the cloud directory.",
        detail: error.message,
        mode
      },
      { status: 502 }
    );
  }

  const activityRecords = updates.flatMap((update) => buildAdminActivityRecords(
    update,
    now,
    previousByKey.get(safeRecordKey(update.email || update.id || update.key))
  ));
  if (activityRecords.length) {
    await client.from("user_data_records").insert(activityRecords);
  }

  return NextResponse.json({ ok: true, saved: records.length, mode, syncedAt: now });
}

async function buildAccountDirectory(): Promise<AccountDirectoryResponse> {
  const { client, mode } = getServerSupabaseClient();
  const errors: string[] = [];
  const accounts = new Map<string, ManagedAccount>();

  if (!client) {
    return {
      accounts: [],
      storageSummary: { totalRecords: 0, collections: [] },
      cloud: { mode, canListAuthUsers: false, profileRecords: 0, statusRecords: 0, errors: ["Supabase is not configured."] },
      syncedAt: new Date().toISOString()
    };
  }

  const [userDataResult, activityResult, authUsers] = await Promise.all([
    loadDirectoryRecords(client, errors),
    loadActivityRecords(client, errors),
    loadAuthUsers(client, mode, errors)
  ]);

  const statusRecords = userDataResult.filter((record) => record.collection === accountStatusCollection);
  const profileRecords = userDataResult.filter((record) => record.collection === "profiles");
  const statuses = collectStatusRecords(statusRecords);

  for (const user of authUsers) {
    const metadata = objectValue(user.user_metadata);
    addAccount(accounts, {
      key: accountKey(stringValue(user.email), user.id),
      id: user.id,
      name: stringValue(metadata.name) || stringValue(metadata.display_name) || stringValue(user.email).split("@")[0] || "Supabase user",
      email: normalizeEmail(stringValue(user.email)),
      accountType: accountTypeValue(metadata.account_type),
      subscriptionTier: subscriptionTierValue(metadata.subscription_tier),
      organizationName: stringValue(metadata.organization_name),
      approvalStatus: approvalStatusValue(metadata.organization_approval_status),
      accessStatus: "active",
      statusNote: "",
      sourceLabels: ["supabase-auth"],
      cloudSynced: true,
      createdAt: stringValue(user.created_at),
      updatedAt: stringValue(user.updated_at) || stringValue(user.created_at),
      activityCount: 0,
      activities: []
    });
  }

  for (const record of profileRecords) {
    const payload = objectValue(record.payload);
    const id = stringValue(payload.id) || record.record_key;
    const email = normalizeEmail(stringValue(payload.email));
    addAccount(accounts, {
      key: accountKey(email, id),
      id,
      name: stringValue(payload.name) || stringValue(payload.display_name) || email.split("@")[0] || "Cloud profile",
      email,
      accountType: accountTypeValue(payload.accountType ?? payload.account_type),
      subscriptionTier: subscriptionTierValue(payload.subscriptionTier ?? payload.subscription_tier),
      organizationName: stringValue(payload.organizationName ?? payload.organization_name),
      approvalStatus: approvalStatusValue(payload.organizationApprovalStatus ?? payload.organization_approval_status),
      accessStatus: "active",
      statusNote: "",
      sourceLabels: ["cloud-profile"],
      cloudSynced: true,
      createdAt: stringValue(payload.createdAt) || record.created_at,
      updatedAt: record.updated_at || stringValue(payload.createdAt),
      activityCount: 0,
      activities: []
    });
  }

  for (const status of statuses.values()) {
    addAccount(accounts, {
      key: accountKey(status.email, status.id || status.key),
      id: status.id || status.key,
      name: status.name || status.email || "Account status record",
      email: status.email,
      accountType: status.accountType,
      subscriptionTier: status.subscriptionTier,
      organizationName: status.organizationName,
      approvalStatus: status.approvalStatus,
      accessStatus: status.accessStatus,
      statusNote: status.statusNote,
      sourceLabels: ["cloud-status"],
      cloudSynced: true,
      updatedAt: status.lastReviewedAt,
      lastReviewedAt: status.lastReviewedAt,
      activityCount: 0,
      activities: []
    });
  }

  const mergedAccounts = Array.from(accounts.values()).map((account) => {
    const status = statuses.get(account.key) || statuses.get(normalizeEmail(account.email)) || statuses.get(account.id);
    if (!status) return account;
    return {
      ...account,
      accountType: status.accountType,
      subscriptionTier: status.subscriptionTier,
      organizationName: status.organizationName || account.organizationName,
      approvalStatus: status.approvalStatus,
      accessStatus: status.accessStatus,
      statusNote: status.statusNote,
      lastReviewedAt: status.lastReviewedAt,
      sourceLabels: uniqueSources([...account.sourceLabels, "cloud-status"])
    };
  });

  const activityByAccount = buildActivityByAccount(activityResult, authUsers, mergedAccounts);
  const planUsageByAccount = buildPlanUsageByAccount(activityResult, mergedAccounts);
  const accountsWithActivity = sortAccountsByRecentActivity(mergedAccounts.map((account) => {
    const activities = activityByAccount.get(account.key) ?? [];
    return {
      ...account,
      activities,
      activityCount: activities.length,
      lastActiveAt: activities[0]?.occurredAt,
      planUsage: planUsageByAccount.get(account.key)
    };
  }));

  return {
    accounts: accountsWithActivity,
    storageSummary: buildStorageSummary(activityResult),
    cloud: {
      mode,
      canListAuthUsers: mode === "service",
      profileRecords: profileRecords.length,
      statusRecords: statusRecords.length,
      errors
    },
    syncedAt: new Date().toISOString()
  };
}

async function loadDirectoryRecords(client: SupabaseClient, errors: string[]) {
  const { data, error } = await client
    .from("user_data_records")
    .select("id,owner_key,collection,record_key,payload,created_at,updated_at")
    .in("collection", ["profiles", accountStatusCollection])
    .limit(2000);

  if (error) {
    errors.push(error.message);
    return [] as UserDataRecord[];
  }

  return (data ?? []) as UserDataRecord[];
}

async function loadActivityRecords(client: SupabaseClient, errors: string[]) {
  const records: UserDataRecord[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await client
      .from("user_data_records")
      .select("id,owner_key,collection,record_key,payload,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      errors.push(error.message);
      break;
    }
    records.push(...((data ?? []) as UserDataRecord[]));
    if ((data ?? []).length < pageSize) break;
  }
  return records;
}

async function loadAuthUsers(client: SupabaseClient, mode: SupabaseMode, errors: string[]) {
  if (mode !== "service") return [] as User[];

  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      errors.push(error.message);
      break;
    }
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) break;
  }
  return users;
}

function addAccount(accounts: Map<string, ManagedAccount>, next: ManagedAccount) {
  const key = next.key || accountKey(next.email, next.id);
  const existing = accounts.get(key);
  if (!existing) {
    accounts.set(key, { ...next, key });
    return;
  }

  accounts.set(key, {
    ...existing,
    id: existing.id || next.id,
    name: existing.name || next.name,
    email: existing.email || next.email,
    accountType: next.accountType ?? existing.accountType,
    subscriptionTier: next.subscriptionTier ?? existing.subscriptionTier,
    organizationName: next.organizationName || existing.organizationName,
    approvalStatus: next.approvalStatus ?? existing.approvalStatus,
    accessStatus: next.accessStatus ?? existing.accessStatus,
    statusNote: next.statusNote || existing.statusNote,
    sourceLabels: uniqueSources([...existing.sourceLabels, ...next.sourceLabels]),
    cloudSynced: existing.cloudSynced || next.cloudSynced,
    updatedAt: newestDate(existing.updatedAt, next.updatedAt),
    createdAt: oldestDate(existing.createdAt, next.createdAt),
    lastActiveAt: newestDate(existing.lastActiveAt, next.lastActiveAt),
    lastReviewedAt: newestDate(existing.lastReviewedAt, next.lastReviewedAt),
    activityCount: Math.max(existing.activityCount, next.activityCount),
    activities: mergeActivities(existing.activities, next.activities),
    planUsage: next.planUsage ?? existing.planUsage
  });
}

function collectStatusRecords(records: UserDataRecord[]) {
  const statuses = new Map<string, ManagedAccount>();

  for (const record of records) {
    const payload = objectValue(record.payload);
    const email = normalizeEmail(stringValue(payload.email));
    const id = stringValue(payload.id) || stringValue(payload.key) || record.record_key;
    const key = accountKey(email, id);
    const status: ManagedAccount = {
      key,
      id,
      name: stringValue(payload.name) || email || id,
      email,
      accountType: accountTypeValue(payload.accountType),
      subscriptionTier: subscriptionTierValue(payload.subscriptionTier),
      organizationName: stringValue(payload.organizationName),
      approvalStatus: approvalStatusValue(payload.approvalStatus),
      accessStatus: accessStatusValue(payload.accessStatus),
      statusNote: stringValue(payload.statusNote),
      sourceLabels: ["cloud-status"],
      cloudSynced: true,
      updatedAt: record.updated_at,
      lastReviewedAt: stringValue(payload.lastReviewedAt) || record.updated_at,
      activityCount: 0,
      activities: []
    };

    statuses.set(key, status);
    if (email) statuses.set(email, status);
    if (id) statuses.set(id, status);
  }

  return statuses;
}

function buildActivityByAccount(records: UserDataRecord[], authUsers: User[], accounts: ManagedAccount[]) {
  const activities = new Map<string, AccountActivity[]>();
  const lookup = buildAccountLookup(accounts);

  const append = (key: string | undefined, activity: AccountActivity) => {
    if (!key) return;
    const current = activities.get(key) ?? [];
    if (current.some((item) => activityIdentity(item) === activityIdentity(activity))) return;
    current.push(activity);
    activities.set(key, current);
  };

  for (const user of authUsers) {
    const key = resolveAccountKey(lookup, user.id, user.email, stringValue(user.user_metadata?.name));
    if (!key || !user.created_at) continue;
    append(key, {
      id: `account-created-${user.id}`,
      type: "account_created",
      title: "Account created",
      detail: normalizeEmail(user.email ?? ""),
      occurredAt: user.created_at,
      subjectId: user.id,
      subjectUrl: "/profile",
      collection: "auth.users"
    });
  }

  for (const record of records) {
    const payload = objectValue(record.payload);
    const occurredAt = stringValue(payload.occurredAt) || record.updated_at || record.created_at || new Date(0).toISOString();

    if (record.collection === "account_activity") {
      const key = resolveRecordAccountKey(record, payload, lookup);
      const type = activityTypeValue(payload.type);
      append(key, {
        id: stringValue(payload.id) || record.id || record.record_key,
        type,
        title: stringValue(payload.title) || activityFallbackTitle(type),
        detail: stringValue(payload.detail) || undefined,
        occurredAt,
        subjectId: stringValue(payload.subjectId) || undefined,
        subjectUrl: stringValue(payload.subjectUrl) || undefined,
        collection: stringValue(payload.collection) || undefined
      });
      continue;
    }

    if (record.collection === "direct_messages") {
      const senderId = stringValue(payload.senderId);
      const recipientId = stringValue(payload.recipientId);
      const messageId = stringValue(payload.id) || record.record_key;
      const body = stringValue(payload.body).slice(0, 140);
      append(resolveAccountKey(lookup, senderId), {
        id: `message-sent-${messageId}`,
        type: "message_sent",
        title: `Sent a message to ${stringValue(payload.recipientName) || "an account"}`,
        detail: body || undefined,
        occurredAt: stringValue(payload.createdAt) || occurredAt,
        subjectId: messageId,
        collection: record.collection
      });
      append(resolveAccountKey(lookup, recipientId), {
        id: `message-received-${messageId}`,
        type: "message_received",
        title: `Received a message from ${stringValue(payload.senderName) || "an account"}`,
        detail: body || undefined,
        occurredAt: stringValue(payload.createdAt) || occurredAt,
        subjectId: messageId,
        collection: record.collection
      });
      continue;
    }

    if ([accountStatusCollection, "usage_counters"].includes(record.collection)) continue;
    const key = resolveRecordAccountKey(record, payload, lookup);
    if (!key) continue;
    const derived = deriveRecordActivity(record, payload, occurredAt);
    if (derived) append(key, derived);
  }

  for (const account of accounts) {
    if (account.createdAt) {
      append(account.key, {
        id: `account-created-${account.id || account.key}`,
        type: "account_created",
        title: "Account created",
        detail: account.email || undefined,
        occurredAt: account.createdAt,
        subjectId: account.id || account.key,
        subjectUrl: "/profile",
        collection: "profiles"
      });
    }
    const accountActivities = (activities.get(account.key) ?? [])
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
    activities.set(account.key, accountActivities);
  }

  return activities;
}

function buildPlanUsageByAccount(records: UserDataRecord[], accounts: ManagedAccount[]) {
  const usage = new Map<string, ManagedAccount["planUsage"]>();
  const lookup = buildAccountLookup(accounts);
  for (const record of records) {
    if (record.collection !== "usage_counters") continue;
    const payload = objectValue(record.payload);
    const key = resolveAccountKey(lookup, stringValue(payload.userId), stringValue(payload.accountId));
    if (!key || usage.has(key)) continue;
    usage.set(key, {
      period: stringValue(payload.usagePeriod) || undefined,
      projectsCreatedCount: numberValue(payload.projectsCreatedCount),
      cfdRunsUsed: numberValue(payload.cfdRunsUsed),
      dmSentCount: numberValue(payload.dmSentCount),
      memberTeamsCount: numberValue(payload.memberTeamsCount),
      broadcastCount: numberValue(payload.broadcastCount),
      activeEventPagesCount: numberValue(payload.activeEventPagesCount)
    });
  }
  return usage;
}

function buildAccountLookup(accounts: ManagedAccount[]) {
  const lookup = new Map<string, string>();
  for (const account of accounts) {
    for (const value of [account.key, account.id, normalizeEmail(account.email), account.name.toLowerCase(), account.organizationName?.toLowerCase() ?? ""].filter(Boolean)) {
      lookup.set(value, account.key);
    }
  }
  return lookup;
}

function resolveAccountKey(lookup: Map<string, string>, ...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeEmail(value ?? "");
    const found = lookup.get(value ?? "") ?? lookup.get(normalized) ?? lookup.get((value ?? "").toLowerCase());
    if (found) return found;
  }
  return undefined;
}

function resolveRecordAccountKey(record: UserDataRecord, payload: Record<string, unknown>, lookup: Map<string, string>) {
  const author = objectValue(payload.author);
  const ownerId = record.owner_key.startsWith("user:") || record.owner_key.startsWith("email:")
    ? record.owner_key.slice(record.owner_key.indexOf(":") + 1)
    : "";
  return resolveAccountKey(
    lookup,
    ownerId,
    stringValue(payload.accountId),
    stringValue(payload.creatorId),
    stringValue(payload.ownerId),
    stringValue(payload.accountEmail),
    stringValue(payload.creatorEmail),
    stringValue(author.accountId),
    stringValue(author.email),
    stringValue(payload.creator),
    stringValue(author.name)
  );
}

function deriveRecordActivity(record: UserDataRecord, payload: Record<string, unknown>, occurredAt: string): AccountActivity | null {
  const subjectId = stringValue(payload.id) || stringValue(payload.slug) || record.record_key;
  const subjectTitle = stringValue(payload.title) || stringValue(payload.name) || record.record_key;
  const base = { occurredAt, subjectId, collection: record.collection };
  if (record.collection === "profiles") return { ...base, id: `profile-${record.record_key}`, type: "profile_updated", title: "Profile updated", subjectUrl: "/profile" };
  if (record.collection === "projects") return { ...base, id: `project-published-${subjectId}`, type: "project_published", title: `Published project: ${subjectTitle}`, subjectUrl: `/projects/${subjectId}` };
  if (record.collection === "rocket_projects") return { ...base, id: `project-created-${subjectId}`, type: "project_created", title: `Created project: ${subjectTitle}`, subjectUrl: `/projects/${subjectId}` };
  if (record.collection === "saved_motors") return { ...base, id: `motor-saved-${subjectId}`, type: "motor_saved", title: `Saved motor: ${subjectTitle}`, subjectUrl: `/motors/${subjectId}` };
  if (record.collection === "community_posts") return { ...base, id: `community-post-${subjectId}`, type: "community_post_published", title: `Published community post: ${subjectTitle}`, subjectUrl: `/community/${subjectId}` };
  if (record.collection === "community_comments") return { ...base, id: `community-comments-${subjectId}`, type: "community_comment_created", title: "Added a community comment", subjectUrl: `/community/${subjectId}` };
  if (record.collection === "community_state") return { ...base, id: `community-state-${record.record_key}`, type: "record_updated", title: communityStateTitle(record.record_key) };
  if (record.collection === "uploaded_files") return { ...base, id: `file-uploaded-${subjectId}`, type: "file_uploaded", title: "Uploaded project files" };
  if (record.collection === "upload-drafts") return null;
  return {
    ...base,
    id: `record-${record.collection}-${record.record_key}`,
    type: record.created_at === record.updated_at ? "record_created" : "record_updated",
    title: `${record.created_at === record.updated_at ? "Created" : "Updated"} ${record.collection.replace(/[_-]+/g, " ")}: ${subjectTitle}`
  };
}

function communityStateTitle(recordKey: string) {
  if (/liked/i.test(recordKey)) return "Updated community likes";
  if (/bookmarked/i.test(recordKey)) return "Updated community bookmarks";
  if (/reported/i.test(recordKey)) return "Updated community reports";
  return "Updated community state";
}

function activityTypeValue(value: unknown): AccountActivityType {
  const supported: AccountActivityType[] = [
    "account_created", "profile_updated", "project_created", "project_published", "motor_saved",
    "community_post_published", "community_comment_created", "like_created", "like_removed",
    "bookmark_created", "bookmark_removed", "message_sent", "message_received", "plan_changed",
    "account_status_changed", "file_uploaded", "record_created", "record_updated"
  ];
  return supported.includes(value as AccountActivityType) ? value as AccountActivityType : "record_updated";
}

function activityFallbackTitle(type: AccountActivityType) {
  return type.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function activityIdentity(activity: AccountActivity) {
  return `${activity.type}:${activity.subjectId ?? activity.id}`;
}

function mergeActivities(...groups: AccountActivity[][]) {
  const merged = new Map<string, AccountActivity>();
  for (const activity of groups.flat()) merged.set(activityIdentity(activity), activity);
  return Array.from(merged.values()).sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildStorageSummary(records: UserDataRecord[]): AccountStorageSummary {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.collection, (counts.get(record.collection) ?? 0) + 1);
  }

  const collections = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  return {
    totalRecords: collections.reduce((sum, collection) => sum + collection.count, 0),
    collections
  };
}

function normalizeUpdate(value: unknown): AccountStatusUpdate | null {
  const input = objectValue(value);
  const key = stringValue(input.key);
  const email = normalizeEmail(stringValue(input.email));
  const id = stringValue(input.id);
  const resolvedKey = key || accountKey(email, id);
  if (!resolvedKey) return null;

  return {
    key: resolvedKey,
    id,
    email,
    name: stringValue(input.name),
    accountType: input.accountType ? accountTypeValue(input.accountType) : undefined,
    subscriptionTier: input.subscriptionTier ? subscriptionTierValue(input.subscriptionTier) : undefined,
    organizationName: stringValue(input.organizationName),
    approvalStatus: input.approvalStatus ? approvalStatusValue(input.approvalStatus) : undefined,
    accessStatus: input.accessStatus ? accessStatusValue(input.accessStatus) : undefined,
    statusNote: typeof input.statusNote === "string" ? input.statusNote.slice(0, 600) : undefined
  };
}

function buildAdminActivityRecords(update: AccountStatusUpdate, now: string, previous?: Record<string, unknown>) {
  const accountId = update.id || update.email || update.key;
  const ownerKey = update.id ? `user:${update.id}` : `email:${normalizeEmail(update.email || update.key)}`;
  const events: Array<{ type: AccountActivityType; title: string; detail?: string }> = [];

  if (update.subscriptionTier && update.subscriptionTier !== subscriptionTierValue(previous?.subscriptionTier)) {
    events.push({
      type: "plan_changed",
      title: `Pricing plan changed to ${planLabel(update.accountType ?? accountTypeValue(previous?.accountType), update.subscriptionTier)}`,
      detail: `Previous plan: ${planLabel(accountTypeValue(previous?.accountType), subscriptionTierValue(previous?.subscriptionTier))}`
    });
  }
  if (update.accessStatus && update.accessStatus !== accessStatusValue(previous?.accessStatus)) {
    events.push({ type: "account_status_changed", title: `Account access changed to ${update.accessStatus}` });
  }
  if (update.approvalStatus && update.approvalStatus !== approvalStatusValue(previous?.approvalStatus)) {
    events.push({ type: "account_status_changed", title: `Organization approval changed to ${update.approvalStatus}` });
  }
  if (update.accountType && update.accountType !== accountTypeValue(previous?.accountType)) {
    events.push({ type: "account_status_changed", title: `Account type changed to ${update.accountType}` });
  }

  return events.map((event, index) => {
    const id = `admin-activity-${safeRecordKey(accountId)}-${Date.now()}-${index}`;
    return {
      owner_key: ownerKey,
      collection: "account_activity",
      record_key: id,
      payload: {
        id,
        accountId: update.id,
        accountEmail: update.email,
        type: event.type,
        title: event.title,
        detail: event.detail,
        occurredAt: now,
        collection: accountStatusCollection
      },
      updated_at: now
    };
  });
}

function planLabel(accountType: AuthUser["accountType"], tier: NonNullable<AuthUser["subscriptionTier"]>) {
  return `${accountType[0].toUpperCase()}${accountType.slice(1)} ${tier === "pro" ? "Pro" : "Standard"}`;
}

function accountKey(email?: string, id?: string) {
  return normalizeEmail(email ?? "") || id || "";
}

function safeRecordKey(value: string) {
  return value.replace(/[^a-zA-Z0-9@._:-]+/g, "-").replace(/^-|-$/g, "") || `account-${Date.now()}`;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function accountTypeValue(value: unknown): AuthUser["accountType"] {
  return value === "team" || value === "organization" || value === "personal" ? value : "personal";
}

function subscriptionTierValue(value: unknown): NonNullable<AuthUser["subscriptionTier"]> {
  return value === "pro" ? "pro" : "standard";
}

function approvalStatusValue(value: unknown): AccountApprovalStatus {
  return value === "requested" || value === "approved" || value === "none" ? value : "none";
}

function accessStatusValue(value: unknown): AccountAccessStatus {
  return value === "review" || value === "suspended" || value === "active" ? value : "active";
}

function uniqueSources(values: AccountDirectorySource[]) {
  return Array.from(new Set(values));
}

function newestDate(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function oldestDate(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}
