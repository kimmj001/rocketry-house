"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, Cloud, Database, Download, Lock, RefreshCw, Search, ShieldAlert, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AUTH_ACCOUNTS_KEY, AUTH_STORAGE_KEY, normalizeEmail, type AccountAccessStatus, type AuthUser } from "@/lib/auth";
import type {
  AccountApprovalStatus,
  AccountDirectoryResponse,
  AccountDirectorySource,
  AccountStatusUpdate,
  AccountStorageSummary,
  ManagedAccount
} from "@/lib/account-status-types";

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
  accountType?: AuthUser["accountType"];
  approvalStatus?: AccountApprovalStatus;
  organizationName?: string;
  lastReviewedAt?: string;
};

type DirectoryStatus = {
  loading: boolean;
  syncedAt?: string;
  cloudMode: AccountDirectoryResponse["cloud"]["mode"];
  cloudProfiles: number;
  cloudStatuses: number;
  canListAuthUsers: boolean;
  errors: string[];
};

const accessOptions: AccountAccessStatus[] = ["active", "review", "suspended"];
const approvalOptions: AccountApprovalStatus[] = ["none", "requested", "approved"];
const accountTypes: AuthUser["accountType"][] = ["personal", "team", "organization"];
const sourceLabels: Record<AccountDirectorySource, string> = {
  "supabase-auth": "Auth",
  "cloud-profile": "Cloud profile",
  "cloud-status": "Cloud status",
  "browser-account": "Browser",
  "current-session": "Current"
};

export function AccountStatusManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [storageSummary, setStorageSummary] = useState<AccountStorageSummary>({ totalRecords: 0, collections: [] });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountAccessStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "cloud" | "browser">("all");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [directoryStatus, setDirectoryStatus] = useState<DirectoryStatus>({
    loading: true,
    cloudMode: "offline",
    cloudProfiles: 0,
    cloudStatuses: 0,
    canListAuthUsers: false,
    errors: []
  });

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesStatus = statusFilter === "all" || account.accessStatus === statusFilter;
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "cloud" && account.cloudSynced) ||
        (sourceFilter === "browser" && account.sourceLabels.some((source) => source === "browser-account" || source === "current-session"));
      const matchesQuery = !normalizedQuery || [account.name, account.email, account.organizationName ?? "", account.id].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesSource && matchesQuery;
    });
  }, [accounts, query, sourceFilter, statusFilter]);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedKeys.includes(account.key)),
    [accounts, selectedKeys]
  );

  const stats = useMemo(() => {
    const reviewCount = accounts.filter((account) => account.accessStatus === "review" || account.approvalStatus === "requested").length;
    return [
      { label: "Unified accounts", value: accounts.length.toString(), icon: Users },
      { label: "Cloud profiles", value: directoryStatus.cloudProfiles.toString(), icon: Cloud },
      { label: "Review queue", value: reviewCount.toString(), icon: ShieldAlert },
      { label: "Approved", value: accounts.filter((account) => account.approvalStatus === "approved").length.toString(), icon: CheckCircle2 }
    ];
  }, [accounts, directoryStatus.cloudProfiles]);

  useEffect(() => {
    void refreshDirectory();
  }, []);

  async function refreshDirectory() {
    setDirectoryStatus((current) => ({ ...current, loading: true }));
    const localAccounts = readLocalManagedAccounts();
    const localSummary = readLocalStorageSummary();

    try {
      const response = await fetch("/api/account-status/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error(`Cloud directory returned ${response.status}.`);
      const directory = await response.json() as AccountDirectoryResponse;
      const mergedAccounts = mergeAccounts([...directory.accounts, ...localAccounts]);
      setAccounts(mergedAccounts);
      setStorageSummary(mergeStorageSummaries(directory.storageSummary, localSummary));
      setDirectoryStatus({
        loading: false,
        syncedAt: directory.syncedAt,
        cloudMode: directory.cloud.mode,
        cloudProfiles: directory.cloud.profileRecords,
        cloudStatuses: directory.cloud.statusRecords,
        canListAuthUsers: directory.cloud.canListAuthUsers,
        errors: directory.cloud.errors
      });
      setNotice(`Unified ${mergedAccounts.length} accounts from cloud and this browser.`);
    } catch (error) {
      setAccounts(localAccounts);
      setStorageSummary(localSummary);
      setDirectoryStatus({
        loading: false,
        cloudMode: "offline",
        cloudProfiles: 0,
        cloudStatuses: 0,
        canListAuthUsers: false,
        errors: [error instanceof Error ? error.message : "Cloud directory could not be loaded."]
      });
      setNotice("Cloud directory unavailable. Showing this browser's accounts only.");
    }
  }

  async function lockPage() {
    await fetch("/api/account-status/session", { method: "DELETE" });
    router.refresh();
  }

  async function applyUpdates(targets: ManagedAccount[], patch: Partial<Pick<ManagedAccount, "accessStatus" | "statusNote" | "accountType" | "approvalStatus" | "organizationName">>) {
    if (!targets.length) return;

    const now = new Date().toISOString();
    const updates = targets.map((account): AccountStatusUpdate => ({
      key: account.key,
      id: account.id,
      email: account.email,
      name: account.name,
      accountType: patch.accountType ?? account.accountType,
      organizationName: patch.organizationName ?? account.organizationName,
      approvalStatus: patch.approvalStatus ?? account.approvalStatus,
      accessStatus: patch.accessStatus ?? account.accessStatus,
      statusNote: patch.statusNote ?? account.statusNote
    }));

    writeLocalStatusOverrides(updates, now);
    updateLocalAccountRecords(updates, now);
    setAccounts((current) => current.map((account) => {
      const update = updates.find((item) => item.key === account.key);
      if (!update) return account;
      return {
        ...account,
        accountType: update.accountType ?? account.accountType,
        organizationName: update.organizationName || account.organizationName,
        approvalStatus: update.approvalStatus ?? account.approvalStatus,
        accessStatus: update.accessStatus ?? account.accessStatus,
        statusNote: update.statusNote ?? account.statusNote,
        lastReviewedAt: now,
        sourceLabels: uniqueSources([...account.sourceLabels, "cloud-status"])
      };
    }));

    try {
      const response = await fetch("/api/account-status/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: string; error?: string };
        throw new Error(body.detail || body.error || `Cloud save returned ${response.status}.`);
      }
      setNotice(`${updates.length} account${updates.length > 1 ? "s" : ""} saved to the unified directory.`);
      await refreshDirectory();
    } catch (error) {
      setNotice(`Saved locally. Cloud sync failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    }

    window.dispatchEvent(new Event("rocketry-auth-change"));
  }

  function toggleSelected(key: string) {
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleAllFiltered() {
    const visibleKeys = filteredAccounts.map((account) => account.key);
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.includes(key));
    setSelectedKeys(allSelected ? selectedKeys.filter((key) => !visibleKeys.includes(key)) : Array.from(new Set([...selectedKeys, ...visibleKeys])));
  }

  function exportSnapshot() {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      accounts,
      storageSummary,
      directoryStatus
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rocketry-house-unified-accounts-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-space-radial px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-100/62">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Unified account management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/62">
              All discovered Supabase profiles, account status records, current sessions, and this browser's local accounts in one control surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refreshDirectory()}>
              <RefreshCw className={`h-4 w-4 ${directoryStatus.loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportSnapshot}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => void lockPage()}>
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

        <Card className="mt-6 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <UserCog className="h-5 w-5 text-cyan-200" />
                Integrated accounts
              </h2>
              <p className="mt-1 text-sm text-emerald-100/75">{notice}</p>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-50/40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/12 bg-white/5 pl-9 pr-3 text-sm text-orange-50 outline-none focus:border-orange-300 lg:w-64"
                  placeholder="Search account"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AccountAccessStatus | "all")} className="h-10 rounded-md border border-white/12 bg-[#151a27] px-3 text-sm text-orange-50 outline-none">
                <option value="all">All status</option>
                {accessOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "all" | "cloud" | "browser")} className="h-10 rounded-md border border-white/12 bg-[#151a27] px-3 text-sm text-orange-50 outline-none">
                <option value="all">All sources</option>
                <option value="cloud">Cloud</option>
                <option value="browser">This browser</option>
              </select>
            </div>
          </div>

          <div className="mt-5 rounded-md border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-orange-50/62">
                {selectedAccounts.length ? `${selectedAccounts.length} selected` : "Select accounts for bulk status changes."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void applyUpdates(selectedAccounts, { accessStatus: "active" })} disabled={!selectedAccounts.length}>Set active</Button>
                <Button size="sm" variant="outline" onClick={() => void applyUpdates(selectedAccounts, { accessStatus: "review" })} disabled={!selectedAccounts.length}>Needs review</Button>
                <Button size="sm" variant="outline" onClick={() => void applyUpdates(selectedAccounts, { accessStatus: "suspended" })} disabled={!selectedAccounts.length}>Suspend</Button>
                <Button size="sm" onClick={() => void applyUpdates(selectedAccounts, { approvalStatus: "approved" })} disabled={!selectedAccounts.length}>Approve</Button>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1040px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-orange-50/45">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    <input
                      type="checkbox"
                      checked={filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedKeys.includes(account.key))}
                      onChange={toggleAllFiltered}
                      className="h-4 w-4 accent-orange-300"
                      aria-label="Select all filtered accounts"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Sources</th>
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
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(account.key)}
                        onChange={() => toggleSelected(account.key)}
                        className="h-4 w-4 accent-orange-300"
                        aria-label={`Select ${account.name}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-orange-50">{account.name}</p>
                      <p className="mt-1 text-xs text-orange-50/50">{account.email || "No email"}</p>
                      <p className="mt-1 max-w-[220px] truncate text-xs text-cyan-100/58">{account.id || account.key}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[190px] flex-wrap gap-1.5">
                        {account.sourceLabels.map((source) => (
                          <span key={source} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-orange-50/68">
                            {sourceLabels[source]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select value={account.accountType} onChange={(event) => void applyUpdates([account], { accountType: event.target.value as AuthUser["accountType"] })} className="h-9 w-32 rounded-md border border-white/10 bg-[#151a27] px-2 text-orange-50 outline-none">
                        {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select value={account.approvalStatus} onChange={(event) => void applyUpdates([account], { approvalStatus: event.target.value as AccountApprovalStatus })} className="h-9 w-32 rounded-md border border-white/10 bg-[#151a27] px-2 text-orange-50 outline-none">
                        {approvalOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="grid w-[192px] grid-cols-3 overflow-hidden rounded-md border border-white/10">
                        {accessOptions.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => void applyUpdates([account], { accessStatus: status })}
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
                        onChange={(event) => updateNoteDraft(account.key, event.target.value, setAccounts)}
                        onBlur={(event) => void applyUpdates([{ ...account, statusNote: event.target.value }], { statusNote: event.target.value })}
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

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity className="h-5 w-5 text-cyan-200" />
              Directory status
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <SideMetric label="Cloud mode" value={directoryStatus.cloudMode} />
              <SideMetric label="Auth users" value={directoryStatus.canListAuthUsers ? "service enabled" : "profile index"} />
              <SideMetric label="Cloud status records" value={directoryStatus.cloudStatuses.toString()} />
              <SideMetric label="Last sync" value={directoryStatus.syncedAt ? new Date(directoryStatus.syncedAt).toLocaleTimeString() : "pending"} />
            </div>
            {directoryStatus.errors.length ? (
              <div className="mt-4 rounded-md border border-amber-200/20 bg-amber-200/10 p-3 text-sm text-amber-50">
                {directoryStatus.errors.slice(0, 3).join(" / ")}
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Database className="h-5 w-5 text-orange-200" />
              Storage collections
            </h2>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {storageSummary.collections.length ? storageSummary.collections.map((collection) => (
                <div key={collection.name} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="truncate text-orange-50/68">{collection.name}</span>
                  <span className="font-semibold text-orange-50">{collection.count}</span>
                </div>
              )) : <p className="text-sm text-orange-50/55">No persistence records yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function updateNoteDraft(key: string, value: string, setAccounts: (accounts: ManagedAccount[] | ((accounts: ManagedAccount[]) => ManagedAccount[])) => void) {
  setAccounts((current) => current.map((account) => account.key === key ? { ...account, statusNote: value } : account));
}

function statusClass(status: AccountAccessStatus) {
  if (status === "active") return "bg-emerald-300 text-slate-950";
  if (status === "review") return "bg-amber-200 text-slate-950";
  return "bg-red-300 text-slate-950";
}

function readLocalManagedAccounts() {
  const records = readLocalAccountRecords();
  const currentUser = readCurrentUser();
  const overrides = readStatusOverrides();
  const activityByOwner = readLocalActivityByOwner();
  const mapped = new Map<string, ManagedAccount>();

  for (const record of records) {
    const email = normalizeEmail(record.user.email);
    const override = overrides[email] ?? overrides[record.user.id];
    const key = accountKey(email, record.user.id);
    mapped.set(key, {
      key,
      id: record.user.id,
      name: record.user.name,
      email,
      accountType: override?.accountType ?? record.user.accountType,
      organizationName: override?.organizationName ?? record.user.organizationName,
      approvalStatus: override?.approvalStatus ?? record.user.organizationApprovalStatus ?? "none",
      accessStatus: override?.accessStatus ?? record.accessStatus ?? "active",
      statusNote: override?.statusNote ?? record.statusNote ?? "",
      sourceLabels: ["browser-account"],
      cloudSynced: false,
      updatedAt: record.updatedAt ?? record.createdAt ?? record.user.createdAt,
      lastReviewedAt: override?.lastReviewedAt ?? record.lastReviewedAt,
      activityCount: activityByOwner.get(`user:${record.user.id}`) ?? activityByOwner.get(`email:${email}`) ?? 0
    });
  }

  if (currentUser) {
    const email = normalizeEmail(currentUser.email);
    const override = overrides[email] ?? overrides[currentUser.id];
    const key = accountKey(email, currentUser.id);
    const existing = mapped.get(key);
    mapped.set(key, {
      key,
      id: currentUser.id,
      name: currentUser.name,
      email,
      accountType: override?.accountType ?? currentUser.accountType,
      organizationName: override?.organizationName ?? currentUser.organizationName,
      approvalStatus: override?.approvalStatus ?? currentUser.organizationApprovalStatus ?? "none",
      accessStatus: override?.accessStatus ?? existing?.accessStatus ?? "active",
      statusNote: override?.statusNote ?? existing?.statusNote ?? "",
      sourceLabels: uniqueSources([...(existing?.sourceLabels ?? []), "current-session"]),
      cloudSynced: existing?.cloudSynced ?? false,
      updatedAt: currentUser.createdAt,
      lastReviewedAt: override?.lastReviewedAt ?? existing?.lastReviewedAt,
      activityCount: activityByOwner.get(`user:${currentUser.id}`) ?? activityByOwner.get(`email:${email}`) ?? existing?.activityCount ?? 0
    });
  }

  return Array.from(mapped.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function mergeAccounts(accounts: ManagedAccount[]) {
  const merged = new Map<string, ManagedAccount>();
  for (const account of accounts) {
    const key = account.key || accountKey(account.email, account.id);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...account, key });
      continue;
    }

    merged.set(key, {
      ...existing,
      id: existing.id || account.id,
      name: existing.name || account.name,
      email: existing.email || account.email,
      accountType: account.cloudSynced ? account.accountType : existing.accountType,
      organizationName: account.organizationName || existing.organizationName,
      approvalStatus: account.cloudSynced ? account.approvalStatus : existing.approvalStatus,
      accessStatus: account.sourceLabels.includes("cloud-status") ? account.accessStatus : existing.accessStatus,
      statusNote: account.sourceLabels.includes("cloud-status") ? account.statusNote : existing.statusNote,
      sourceLabels: uniqueSources([...existing.sourceLabels, ...account.sourceLabels]),
      cloudSynced: existing.cloudSynced || account.cloudSynced,
      updatedAt: newestDate(existing.updatedAt, account.updatedAt),
      lastReviewedAt: newestDate(existing.lastReviewedAt, account.lastReviewedAt),
      activityCount: Math.max(existing.activityCount, account.activityCount)
    });
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function writeLocalStatusOverrides(updates: AccountStatusUpdate[], now: string) {
  const overrides = readStatusOverrides();
  for (const update of updates) {
    const keys = [update.key, normalizeEmail(update.email ?? ""), update.id ?? ""].filter(Boolean);
    const next: StatusOverride = {
      accessStatus: update.accessStatus ?? "active",
      statusNote: update.statusNote,
      accountType: update.accountType,
      approvalStatus: update.approvalStatus,
      organizationName: update.organizationName,
      lastReviewedAt: now
    };
    for (const key of keys) overrides[key] = next;
  }
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(overrides));
}

function updateLocalAccountRecords(updates: AccountStatusUpdate[], now: string) {
  const records = readLocalAccountRecords();
  const nextRecords = records.map((record) => {
    const update = updates.find((item) => matchesAccount(item, record.user.email, record.user.id));
    if (!update) return record;
    return {
      ...record,
      accessStatus: update.accessStatus ?? record.accessStatus,
      statusNote: update.statusNote ?? record.statusNote,
      lastReviewedAt: now,
      updatedAt: now,
      user: {
        ...record.user,
        accountType: update.accountType ?? record.user.accountType,
        organizationName: update.organizationName ?? record.user.organizationName,
        organizationApprovalStatus: update.approvalStatus ?? record.user.organizationApprovalStatus
      }
    };
  });

  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(nextRecords));

  const currentUser = readCurrentUser();
  const update = currentUser ? updates.find((item) => matchesAccount(item, currentUser.email, currentUser.id)) : undefined;
  if (currentUser && update) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      ...currentUser,
      accountType: update.accountType ?? currentUser.accountType,
      organizationName: update.organizationName ?? currentUser.organizationName,
      organizationApprovalStatus: update.approvalStatus ?? currentUser.organizationApprovalStatus
    }));
  }
}

function matchesAccount(update: AccountStatusUpdate, email: string, id: string) {
  const normalizedEmail = normalizeEmail(email);
  return update.key === normalizedEmail || update.key === id || normalizeEmail(update.email ?? "") === normalizedEmail || update.id === id;
}

function readLocalAccountRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) ?? "[]") as LocalAccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as AuthUser | null;
  } catch {
    return null;
  }
}

function readStatusOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY) ?? "{}") as Record<string, StatusOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readLocalStorageSummary(): AccountStorageSummary {
  const counts = new Map<string, number>();
  const prefix = "rocketry-house.cloud-cache:";

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const collection = key.slice(prefix.length).split(":").at(-1) ?? "unknown";
    counts.set(collection, (counts.get(collection) ?? 0) + safeReadArray(key).length);
  }

  return storageSummaryFromCounts(counts);
}

function readLocalActivityByOwner() {
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

function mergeStorageSummaries(cloud: AccountStorageSummary, local: AccountStorageSummary): AccountStorageSummary {
  const counts = new Map<string, number>();
  for (const collection of cloud.collections) counts.set(collection.name, (counts.get(collection.name) ?? 0) + collection.count);
  for (const collection of local.collections) counts.set(`local:${collection.name}`, (counts.get(`local:${collection.name}`) ?? 0) + collection.count);
  return storageSummaryFromCounts(counts);
}

function storageSummaryFromCounts(counts: Map<string, number>): AccountStorageSummary {
  const collections = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  return {
    totalRecords: collections.reduce((sum, collection) => sum + collection.count, 0),
    collections
  };
}

function accountKey(email?: string, id?: string) {
  return normalizeEmail(email ?? "") || id || "";
}

function uniqueSources(values: AccountDirectorySource[]) {
  return Array.from(new Set(values));
}

function newestDate(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function SideMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.04] px-3 py-2">
      <p className="text-xs text-orange-50/45">{label}</p>
      <p className="mt-1 truncate font-semibold text-orange-50">{value}</p>
    </div>
  );
}

function EmptyAccounts() {
  return (
    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm">
      <p className="font-semibold text-orange-50">No accounts to manage</p>
      <p className="mt-1 text-orange-50/55">Create accounts or connect cloud profile records, then return to this page.</p>
    </div>
  );
}
