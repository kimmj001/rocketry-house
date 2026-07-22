import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ACCOUNT_STATUS_COOKIE_NAME, isAccountStatusSessionValid } from "@/lib/account-status-session";
import { normalizeEmail, type AccountAccessStatus, type AuthUser } from "@/lib/auth";
import type {
  AccountApprovalStatus,
  AccountDirectoryResponse,
  AccountDirectorySource,
  AccountStatusUpdate,
  AccountStorageSummary,
  ManagedAccount
} from "@/lib/account-status-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fallbackSupabaseUrl = "https://ztoapsloscqxjpxmxbca.supabase.co";
const fallbackSupabaseKey = "sb_publishable_ST11At63jWdmB6QqNhIjYA_ds34-iaR";
const accountStatusOwnerKey = "admin:account-status";
const accountStatusCollection = "account_status";

type UserDataRecord = {
  owner_key: string;
  collection: string;
  record_key: string;
  payload?: unknown;
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
  return NextResponse.json(response);
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

  const activityByOwner = countActivityByOwner(activityResult);
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
      organizationName: stringValue(metadata.organization_name),
      approvalStatus: approvalStatusValue(metadata.organization_approval_status),
      accessStatus: "active",
      statusNote: "",
      sourceLabels: ["supabase-auth"],
      cloudSynced: true,
      updatedAt: stringValue(user.updated_at) || stringValue(user.created_at),
      activityCount: activityByOwner.get(`user:${user.id}`) ?? 0
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
      organizationName: stringValue(payload.organizationName ?? payload.organization_name),
      approvalStatus: approvalStatusValue(payload.organizationApprovalStatus ?? payload.organization_approval_status),
      accessStatus: "active",
      statusNote: "",
      sourceLabels: ["cloud-profile"],
      cloudSynced: true,
      updatedAt: record.updated_at || stringValue(payload.createdAt),
      activityCount: activityByOwner.get(record.owner_key) ?? activityByOwner.get(`user:${id}`) ?? 0
    });
  }

  for (const status of statuses.values()) {
    addAccount(accounts, {
      key: accountKey(status.email, status.id || status.key),
      id: status.id || status.key,
      name: status.name || status.email || "Account status record",
      email: status.email,
      accountType: status.accountType,
      organizationName: status.organizationName,
      approvalStatus: status.approvalStatus,
      accessStatus: status.accessStatus,
      statusNote: status.statusNote,
      sourceLabels: ["cloud-status"],
      cloudSynced: true,
      updatedAt: status.lastReviewedAt,
      lastReviewedAt: status.lastReviewedAt,
      activityCount: 0
    });
  }

  const mergedAccounts = Array.from(accounts.values()).map((account) => {
    const status = statuses.get(account.key) || statuses.get(normalizeEmail(account.email)) || statuses.get(account.id);
    if (!status) return account;
    return {
      ...account,
      accountType: status.accountType,
      organizationName: status.organizationName || account.organizationName,
      approvalStatus: status.approvalStatus,
      accessStatus: status.accessStatus,
      statusNote: status.statusNote,
      lastReviewedAt: status.lastReviewedAt,
      sourceLabels: uniqueSources([...account.sourceLabels, "cloud-status"])
    };
  }).sort((left, right) => left.name.localeCompare(right.name));

  return {
    accounts: mergedAccounts,
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
    .select("owner_key,collection,record_key,payload,updated_at")
    .in("collection", ["profiles", accountStatusCollection])
    .limit(2000);

  if (error) {
    errors.push(error.message);
    return [] as UserDataRecord[];
  }

  return (data ?? []) as UserDataRecord[];
}

async function loadActivityRecords(client: SupabaseClient, errors: string[]) {
  const { data, error } = await client
    .from("user_data_records")
    .select("owner_key,collection,record_key,updated_at")
    .limit(5000);

  if (error) {
    errors.push(error.message);
    return [] as UserDataRecord[];
  }

  return (data ?? []) as UserDataRecord[];
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
    organizationName: next.organizationName || existing.organizationName,
    approvalStatus: next.approvalStatus ?? existing.approvalStatus,
    accessStatus: next.accessStatus ?? existing.accessStatus,
    statusNote: next.statusNote || existing.statusNote,
    sourceLabels: uniqueSources([...existing.sourceLabels, ...next.sourceLabels]),
    cloudSynced: existing.cloudSynced || next.cloudSynced,
    updatedAt: newestDate(existing.updatedAt, next.updatedAt),
    lastReviewedAt: newestDate(existing.lastReviewedAt, next.lastReviewedAt),
    activityCount: Math.max(existing.activityCount, next.activityCount)
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
      organizationName: stringValue(payload.organizationName),
      approvalStatus: approvalStatusValue(payload.approvalStatus),
      accessStatus: accessStatusValue(payload.accessStatus),
      statusNote: stringValue(payload.statusNote),
      sourceLabels: ["cloud-status"],
      cloudSynced: true,
      updatedAt: record.updated_at,
      lastReviewedAt: stringValue(payload.lastReviewedAt) || record.updated_at,
      activityCount: 0
    };

    statuses.set(key, status);
    if (email) statuses.set(email, status);
    if (id) statuses.set(id, status);
  }

  return statuses;
}

function countActivityByOwner(records: UserDataRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.owner_key, (counts.get(record.owner_key) ?? 0) + 1);
  }
  return counts;
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
    organizationName: stringValue(input.organizationName),
    approvalStatus: input.approvalStatus ? approvalStatusValue(input.approvalStatus) : undefined,
    accessStatus: input.accessStatus ? accessStatusValue(input.accessStatus) : undefined,
    statusNote: typeof input.statusNote === "string" ? input.statusNote.slice(0, 600) : undefined
  };
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
