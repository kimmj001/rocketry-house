"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, Database, Lock, RefreshCw, Search, ShieldAlert, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AUTH_ACCOUNTS_KEY, AUTH_STORAGE_KEY, normalizeEmail, type AccountAccessStatus, type AuthUser } from "@/lib/auth";

const STATUS_STORAGE_KEY = "rocketry-house.account-status-overrides";

type LocalAccountRecord = {
  user: AuthUser;
  passwordSalt?: string;
  passwordHash?: string;
  accessStatus?: AccountAccessStatus;
  statusNote?: string;
  lastReviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type StatusOverride = {
  accessStatus: AccountAccessStatus;
  statusNote?: string;
  lastReviewedAt?: string;
};

type ManagedAccount = {
  key: string;
  id: string;
  name: string;
  email: string;
  accountType: AuthUser["accountType"];
  organizationName?: string;
  approvalStatus: NonNullable<AuthUser["organizationApprovalStatus"]>;
  accessStatus: AccountAccessStatus;
  statusNote: string;
  recordKind: "stored" | "current";
  updatedAt?: string;
  activityCount: number;
};

type StorageSummary = {
  totalRecords: number;
  collections: Array<{ name: string; count: number }>;
};

const accessOptions: AccountAccessStatus[] = ["active", "review", "suspended"];
const approvalOptions: NonNullable<AuthUser["organizationApprovalStatus"]>[] = ["none", "requested", "approved"];
const accountTypes: AuthUser["accountType"][] = ["personal", "team", "organization"];

export function AccountStatusManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [storageSummary, setStorageSummary] = useState<StorageSummary>({ totalRecords: 0, collections: [] });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountAccessStatus | "all">("all");
  const [notice, setNotice] = useState("");

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesStatus = statusFilter === "all" || account.accessStatus === statusFilter;
      const matchesQuery = !normalizedQuery || [account.name, account.email, account.organizationName ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [accounts, query, statusFilter]);

  const stats = useMemo(() => {
    const reviewCount = accounts.filter((account) => account.accessStatus === "review" || account.approvalStatus === "requested").length;
    return [
      { label: "Accounts", value: accounts.length.toString(), icon: Users },
      { label: "Review queue", value: reviewCount.toString(), icon: ShieldAlert },
      { label: "Approved", value: accounts.filter((account) => account.approvalStatus === "approved").length.toString(), icon: CheckCircle2 },
      { label: "Local records", value: storageSummary.totalRecords.toString(), icon: Database }
    ];
  }, [accounts, storageSummary.totalRecords]);

  useEffect(() => {
    refreshSnapshot();
  }, []);

  function refreshSnapshot() {
    const nextAccounts = readManagedAccounts();
    setAccounts(nextAccounts);
    setStorageSummary(readStorageSummary());
    setNotice(nextAccounts.length ? "Snapshot refreshed." : "No local accounts found yet.");
  }

  async function lockPage() {
    await fetch("/api/account-status/session", { method: "DELETE" });
    router.refresh();
  }

  function updateAccount(email: string, patch: Partial<Pick<ManagedAccount, "accessStatus" | "statusNote" | "accountType" | "approvalStatus">>) {
    const normalized = normalizeEmail(email);
    const now = new Date().toISOString();
    const records = readLocalAccountRecords();
    const overrides = readStatusOverrides();
    const nextOverride: StatusOverride = {
      accessStatus: patch.accessStatus ?? overrides[normalized]?.accessStatus ?? "active",
      statusNote: patch.statusNote ?? overrides[normalized]?.statusNote,
      lastReviewedAt: now
    };

    overrides[normalized] = nextOverride;
    writeStatusOverrides(overrides);

    const nextRecords = records.map((record) => {
      if (normalizeEmail(record.user.email) !== normalized) return record;
      return {
        ...record,
        accessStatus: nextOverride.accessStatus,
        statusNote: nextOverride.statusNote,
        lastReviewedAt: now,
        updatedAt: now,
        user: {
          ...record.user,
          accountType: patch.accountType ?? record.user.accountType,
          organizationApprovalStatus: patch.approvalStatus ?? record.user.organizationApprovalStatus
        }
      };
    });

    writeLocalAccountRecords(nextRecords);

    const currentUser = readCurrentUser();
    if (currentUser && normalizeEmail(currentUser.email) === normalized) {
      writeCurrentUser({
        ...currentUser,
        accountType: patch.accountType ?? currentUser.accountType,
        organizationApprovalStatus: patch.approvalStatus ?? currentUser.organizationApprovalStatus
      });
    }

    window.dispatchEvent(new Event("rocketry-auth-change"));
    setNotice("Account status saved locally.");
    setAccounts(readManagedAccounts());
    setStorageSummary(readStorageSummary());
  }

  function exportSnapshot() {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      accounts,
      storageSummary
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rocketry-house-account-status-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-space-radial px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-100/62">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Account status management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/62">
              Local account access, team approval, organization approval, and account review state.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshSnapshot}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportSnapshot}>
              <Database className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={lockPage}>
              <Lock className="h-4 w-4" />
              Lock
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <stat.icon className="h-5 w-5 text-orange-200" />
              <p className="mt-3 text-sm text-orange-50/55">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <UserCog className="h-5 w-5 text-cyan-200" />
                  Accounts
                </h2>
                {notice ? <p className="mt-1 text-sm text-emerald-100/75">{notice}</p> : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-50/40" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 w-full rounded-md border border-white/12 bg-white/5 pl-9 pr-3 text-sm text-orange-50 outline-none focus:border-orange-300 sm:w-64"
                    placeholder="Search account"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as AccountAccessStatus | "all")}
                  className="h-10 rounded-md border border-white/12 bg-[#151a27] px-3 text-sm text-orange-50 outline-none"
                >
                  <option value="all">All status</option>
                  {accessOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[860px] w-full border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-orange-50/45">
                  <tr>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Approval</th>
                    <th className="px-3 py-2 font-medium">Access</th>
                    <th className="px-3 py-2 font-medium">Activity</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.key} className="bg-white/[0.045] align-top">
                      <td className="rounded-l-md px-3 py-3">
                        <p className="font-semibold text-orange-50">{account.name}</p>
                        <p className="mt-1 text-xs text-orange-50/50">{account.email || "No email"}</p>
                        <p className="mt-1 text-xs text-cyan-100/58">{account.recordKind === "current" ? "Current session" : "Stored account"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <select value={account.accountType} onChange={(event) => updateAccount(account.email, { accountType: event.target.value as AuthUser["accountType"] })} className="h-9 w-32 rounded-md border border-white/10 bg-[#151a27] px-2 text-orange-50 outline-none">
                          {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select value={account.approvalStatus} onChange={(event) => updateAccount(account.email, { approvalStatus: event.target.value as NonNullable<AuthUser["organizationApprovalStatus"]> })} className="h-9 w-32 rounded-md border border-white/10 bg-[#151a27] px-2 text-orange-50 outline-none">
                          {approvalOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid w-[192px] grid-cols-3 overflow-hidden rounded-md border border-white/10">
                          {accessOptions.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateAccount(account.email, { accessStatus: status })}
                              className={`h-9 px-2 text-xs font-semibold transition ${account.accessStatus === status ? statusClass(status) : "bg-white/[0.035] text-orange-50/54 hover:bg-white/10"}`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{account.activityCount}</p>
                        <p className="mt-1 text-xs text-orange-50/45">{account.updatedAt ? new Date(account.updatedAt).toLocaleDateString() : "No update"}</p>
                      </td>
                      <td className="rounded-r-md px-3 py-3">
                        <input
                          value={account.statusNote}
                          onChange={(event) => updateNoteDraft(account.email, event, setAccounts)}
                          onBlur={(event) => updateAccount(account.email, { statusNote: event.target.value })}
                          className="h-9 w-56 rounded-md border border-white/10 bg-white/5 px-2 text-orange-50 outline-none placeholder:text-orange-50/30"
                          placeholder="Review note"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredAccounts.length ? <EmptyAccounts /> : null}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Activity className="h-5 w-5 text-cyan-200" />
                Review focus
              </h2>
              <div className="mt-4 grid gap-3 text-sm">
                <SideMetric label="Suspended" value={accounts.filter((account) => account.accessStatus === "suspended").length.toString()} />
                <SideMetric label="Needs review" value={accounts.filter((account) => account.accessStatus === "review").length.toString()} />
                <SideMetric label="Team requests" value={accounts.filter((account) => account.approvalStatus === "requested").length.toString()} />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Database className="h-5 w-5 text-orange-200" />
                Storage collections
              </h2>
              <div className="mt-4 space-y-2">
                {storageSummary.collections.length ? storageSummary.collections.map((collection) => (
                  <div key={collection.name} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                    <span className="truncate text-orange-50/68">{collection.name}</span>
                    <span className="font-semibold text-orange-50">{collection.count}</span>
                  </div>
                )) : <p className="text-sm text-orange-50/55">No local persistence records yet.</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function updateNoteDraft(email: string, event: ChangeEvent<HTMLInputElement>, setAccounts: (accounts: ManagedAccount[] | ((accounts: ManagedAccount[]) => ManagedAccount[])) => void) {
  const normalized = normalizeEmail(email);
  const value = event.target.value;
  setAccounts((current) => current.map((account) => normalizeEmail(account.email) === normalized ? { ...account, statusNote: value } : account));
}

function statusClass(status: AccountAccessStatus) {
  if (status === "active") return "bg-emerald-300 text-slate-950";
  if (status === "review") return "bg-amber-200 text-slate-950";
  return "bg-red-300 text-slate-950";
}

function readManagedAccounts() {
  const records = readLocalAccountRecords();
  const currentUser = readCurrentUser();
  const overrides = readStatusOverrides();
  const activityByOwner = readActivityByOwner();
  const mapped = new Map<string, ManagedAccount>();

  for (const record of records) {
    const email = normalizeEmail(record.user.email);
    const override = overrides[email];
    mapped.set(email, {
      key: email || record.user.id,
      id: record.user.id,
      name: record.user.name,
      email,
      accountType: record.user.accountType,
      organizationName: record.user.organizationName,
      approvalStatus: record.user.organizationApprovalStatus ?? "none",
      accessStatus: override?.accessStatus ?? record.accessStatus ?? "active",
      statusNote: override?.statusNote ?? record.statusNote ?? "",
      recordKind: "stored",
      updatedAt: record.updatedAt ?? record.createdAt ?? record.user.createdAt,
      activityCount: activityByOwner.get(`user:${record.user.id}`) ?? activityByOwner.get(`email:${email}`) ?? 0
    });
  }

  if (currentUser) {
    const email = normalizeEmail(currentUser.email);
    const override = overrides[email];
    mapped.set(email || currentUser.id, {
      key: email || currentUser.id,
      id: currentUser.id,
      name: currentUser.name,
      email,
      accountType: currentUser.accountType,
      organizationName: currentUser.organizationName,
      approvalStatus: currentUser.organizationApprovalStatus ?? "none",
      accessStatus: override?.accessStatus ?? mapped.get(email)?.accessStatus ?? "active",
      statusNote: override?.statusNote ?? mapped.get(email)?.statusNote ?? "",
      recordKind: mapped.has(email) ? "stored" : "current",
      updatedAt: currentUser.createdAt,
      activityCount: activityByOwner.get(`user:${currentUser.id}`) ?? activityByOwner.get(`email:${email}`) ?? 0
    });
  }

  return Array.from(mapped.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function readLocalAccountRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) ?? "[]") as LocalAccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccountRecords(records: LocalAccountRecord[]) {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(records));
}

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as AuthUser | null;
  } catch {
    return null;
  }
}

function writeCurrentUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function readStatusOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY) ?? "{}") as Record<string, StatusOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStatusOverrides(overrides: Record<string, StatusOverride>) {
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(overrides));
}

function readStorageSummary(): StorageSummary {
  const counts = new Map<string, number>();
  const prefix = "rocketry-house.cloud-cache:";

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;

    const collection = key.slice(prefix.length).split(":").at(-1) ?? "unknown";
    const records = safeReadArray(key);
    counts.set(collection, (counts.get(collection) ?? 0) + records.length);
  }

  const collections = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  return {
    totalRecords: collections.reduce((sum, collection) => sum + collection.count, 0),
    collections
  };
}

function readActivityByOwner() {
  const counts = new Map<string, number>();
  const prefix = "rocketry-house.cloud-cache:";

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;

    const rest = key.slice(prefix.length);
    const ownerKey = rest.split(":").slice(0, -1).join(":");
    counts.set(ownerKey, (counts.get(ownerKey) ?? 0) + safeReadArray(key).length);
  }

  return counts;
}

function safeReadArray(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function SideMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2">
      <span className="text-orange-50/58">{label}</span>
      <span className="font-semibold text-orange-50">{value}</span>
    </div>
  );
}

function EmptyAccounts() {
  return (
    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm">
      <p className="font-semibold text-orange-50">No accounts to manage</p>
      <p className="mt-1 text-orange-50/55">Create or sign in to an account, then return to this page.</p>
    </div>
  );
}
