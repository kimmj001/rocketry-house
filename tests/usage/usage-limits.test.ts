import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyUsageCounters,
  getUsageStatus,
  moveUsageToPeriod,
  usageFieldResetsMonthly,
  type UsageCounters
} from "../../lib/usage-limits";

function usage(overrides: Partial<UsageCounters> = {}): UsageCounters {
  return {
    ...createEmptyUsageCounters({
      userId: "user-1",
      accountId: "user-1",
      accountType: "personal",
      subscriptionTier: "standard",
      usagePeriod: "2026-07",
      now: "2026-07-01T00:00:00.000Z"
    }),
    ...overrides
  };
}

test("resets only monthly usage when a new UTC month starts", () => {
  const previous = usage({
    projectsCreatedCount: 2,
    cfdRunsUsed: 3,
    dmSentCount: 8,
    memberTeamsCount: 4,
    broadcastCount: 2,
    activeEventPagesCount: 1
  });

  const next = moveUsageToPeriod(previous, "2026-08", "2026-08-01T00:00:00.000Z");

  assert.equal(next.projectsCreatedCount, 2);
  assert.equal(next.memberTeamsCount, 4);
  assert.equal(next.activeEventPagesCount, 1);
  assert.equal(next.cfdRunsUsed, 0);
  assert.equal(next.dmSentCount, 0);
  assert.equal(next.broadcastCount, 0);
  assert.equal(next.usagePeriod, "2026-08");
});

test("keeps all counters in the same usage period and normalizes invalid values", () => {
  const current = usage({
    projectsCreatedCount: 2.9,
    cfdRunsUsed: -2,
    dmSentCount: Number.NaN
  });

  const normalized = moveUsageToPeriod(current, "2026-07");

  assert.equal(normalized.projectsCreatedCount, 2);
  assert.equal(normalized.cfdRunsUsed, 0);
  assert.equal(normalized.dmSentCount, 0);
});

test("applies Standard limits while Pro keeps tracked usage unlimited", () => {
  const standard = usage({ projectsCreatedCount: 3 });
  const pro = usage({ subscriptionTier: "pro", projectsCreatedCount: 30 });

  assert.deepEqual(getUsageStatus(standard, "projectsCreatedCount"), {
    used: 3,
    limit: 3,
    remaining: 0,
    blocked: true,
    nearLimit: false,
    percentUsed: 100
  });
  assert.equal(getUsageStatus(pro, "projectsCreatedCount").used, 30);
  assert.equal(getUsageStatus(pro, "projectsCreatedCount").limit, null);
  assert.equal(getUsageStatus(pro, "projectsCreatedCount").blocked, false);
});

test("declares the same monthly fields shown in Pricing", () => {
  assert.equal(usageFieldResetsMonthly("cfdRunsUsed"), true);
  assert.equal(usageFieldResetsMonthly("dmSentCount"), true);
  assert.equal(usageFieldResetsMonthly("broadcastCount"), true);
  assert.equal(usageFieldResetsMonthly("projectsCreatedCount"), false);
  assert.equal(usageFieldResetsMonthly("memberTeamsCount"), false);
  assert.equal(usageFieldResetsMonthly("activeEventPagesCount"), false);
});
