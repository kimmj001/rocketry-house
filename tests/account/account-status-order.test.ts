import assert from "node:assert/strict";
import test from "node:test";
import { accountRecentActivityTimestamp, sortAccountsByRecentActivity } from "../../lib/account-status-order";
import type { ManagedAccount } from "../../lib/account-status-types";

function account(overrides: Partial<ManagedAccount> & Pick<ManagedAccount, "key" | "name">): ManagedAccount {
  return {
    id: overrides.key,
    email: `${overrides.key}@example.com`,
    accountType: "personal",
    subscriptionTier: "standard",
    approvalStatus: "none",
    accessStatus: "active",
    statusNote: "",
    sourceLabels: ["cloud-profile"],
    cloudSynced: true,
    activityCount: overrides.activities?.length ?? 0,
    activities: [],
    ...overrides
  };
}

test("sorts accounts by their newest activity instead of by name", () => {
  const accounts = [
    account({ key: "alpha", name: "Alpha", lastActiveAt: "2026-08-05T08:00:00.000Z" }),
    account({ key: "zulu", name: "Zulu", lastActiveAt: "2026-08-05T10:00:00.000Z" })
  ];

  assert.deepEqual(sortAccountsByRecentActivity(accounts).map((item) => item.key), ["zulu", "alpha"]);
});

test("uses the newest timestamp even when activities arrive out of order", () => {
  const managed = account({
    key: "active",
    name: "Active",
    activities: [
      { id: "old", type: "record_updated", title: "Old", occurredAt: "2026-08-04T10:00:00.000Z" },
      { id: "new", type: "message_sent", title: "New", occurredAt: "2026-08-05T11:30:00.000Z" }
    ]
  });

  assert.equal(accountRecentActivityTimestamp(managed), Date.parse("2026-08-05T11:30:00.000Z"));
});

test("falls back to account creation and keeps ties deterministic", () => {
  const accounts = [
    account({ key: "bravo", name: "Bravo", createdAt: "2026-08-05T09:00:00.000Z" }),
    account({ key: "alpha", name: "Alpha", createdAt: "2026-08-05T09:00:00.000Z" }),
    account({ key: "older", name: "Older", createdAt: "not-a-date" })
  ];

  assert.deepEqual(sortAccountsByRecentActivity(accounts).map((item) => item.key), ["alpha", "bravo", "older"]);
});
