import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AccountStatusGate } from "@/components/account-status-gate";
import { AccountStatusManager } from "@/components/account-status-manager";
import { ACCOUNT_STATUS_COOKIE_NAME, isAccountStatusSessionValid } from "@/lib/account-status-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Account Status | Rocketry House",
  description: "Account status management for Rocketry House."
};

export default async function AccountStatusPage() {
  const cookieStore = await cookies();
  const unlocked = isAccountStatusSessionValid(cookieStore.get(ACCOUNT_STATUS_COOKIE_NAME)?.value);

  return unlocked ? <AccountStatusManager /> : <AccountStatusGate />;
}
