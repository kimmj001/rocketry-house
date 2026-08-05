import type { ManagedAccount } from "@/lib/account-status-types";

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function accountRecentActivityTimestamp(account: ManagedAccount) {
  return Math.max(
    timestamp(account.createdAt),
    timestamp(account.updatedAt),
    timestamp(account.lastActiveAt),
    timestamp(account.lastReviewedAt),
    ...account.activities.map((activity) => timestamp(activity.occurredAt))
  );
}

export function sortAccountsByRecentActivity(accounts: ManagedAccount[]) {
  return [...accounts].sort((left, right) => {
    const activityDifference = accountRecentActivityTimestamp(right) - accountRecentActivityTimestamp(left);
    if (activityDifference !== 0) return activityDifference;

    const nameDifference = left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    return nameDifference || left.key.localeCompare(right.key);
  });
}
