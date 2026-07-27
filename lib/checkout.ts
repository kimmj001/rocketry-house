import { PRO_PLAN_IDS, type AccountType, type SubscriptionTier } from "@/lib/usage-limits";

export function createCheckoutSession(accountType: AccountType, tier: SubscriptionTier = "pro") {
  const planId = PRO_PLAN_IDS[accountType];
  const params = new URLSearchParams({
    accountType,
    tier,
    planId
  });

  return {
    planId,
    url: `/checkout/prepare?${params.toString()}`
  };
}

export function checkoutHref(accountType: AccountType) {
  return createCheckoutSession(accountType, "pro").url;
}
