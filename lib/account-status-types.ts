import type { AccountAccessStatus, AuthUser } from "@/lib/auth";

export type AccountApprovalStatus = NonNullable<AuthUser["organizationApprovalStatus"]>;
export type AccountDirectorySource = "supabase-auth" | "cloud-profile" | "cloud-status" | "browser-account" | "current-session";

export type ManagedAccount = {
  key: string;
  id: string;
  name: string;
  email: string;
  accountType: AuthUser["accountType"];
  organizationName?: string;
  approvalStatus: AccountApprovalStatus;
  accessStatus: AccountAccessStatus;
  statusNote: string;
  sourceLabels: AccountDirectorySource[];
  cloudSynced: boolean;
  updatedAt?: string;
  lastReviewedAt?: string;
  activityCount: number;
};

export type AccountStatusUpdate = {
  key: string;
  id?: string;
  email?: string;
  name?: string;
  accountType?: AuthUser["accountType"];
  organizationName?: string;
  approvalStatus?: AccountApprovalStatus;
  accessStatus?: AccountAccessStatus;
  statusNote?: string;
};

export type AccountStorageSummary = {
  totalRecords: number;
  collections: Array<{ name: string; count: number }>;
};

export type AccountDirectoryResponse = {
  accounts: ManagedAccount[];
  storageSummary: AccountStorageSummary;
  cloud: {
    mode: "service" | "anon" | "offline";
    canListAuthUsers: boolean;
    profileRecords: number;
    statusRecords: number;
    errors: string[];
  };
  syncedAt: string;
};
