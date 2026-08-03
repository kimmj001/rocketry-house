import type { AccountAccessStatus, AuthUser } from "@/lib/auth";

export type AccountApprovalStatus = NonNullable<AuthUser["organizationApprovalStatus"]>;
export type AccountDirectorySource = "supabase-auth" | "cloud-profile" | "cloud-status" | "browser-account" | "current-session";

export type AccountActivityType =
  | "account_created"
  | "profile_updated"
  | "project_created"
  | "project_published"
  | "motor_saved"
  | "community_post_published"
  | "community_comment_created"
  | "like_created"
  | "like_removed"
  | "bookmark_created"
  | "bookmark_removed"
  | "message_sent"
  | "message_received"
  | "plan_changed"
  | "account_status_changed"
  | "file_uploaded"
  | "record_created"
  | "record_updated";

export type AccountActivity = {
  id: string;
  type: AccountActivityType;
  title: string;
  detail?: string;
  occurredAt: string;
  subjectId?: string;
  subjectUrl?: string;
  collection?: string;
};

export type AccountPlanUsage = {
  period?: string;
  projectsCreatedCount?: number;
  cfdRunsUsed?: number;
  dmSentCount?: number;
  memberTeamsCount?: number;
  broadcastCount?: number;
  activeEventPagesCount?: number;
};

export type ManagedAccount = {
  key: string;
  id: string;
  name: string;
  email: string;
  accountType: AuthUser["accountType"];
  subscriptionTier: NonNullable<AuthUser["subscriptionTier"]>;
  organizationName?: string;
  approvalStatus: AccountApprovalStatus;
  accessStatus: AccountAccessStatus;
  statusNote: string;
  sourceLabels: AccountDirectorySource[];
  cloudSynced: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
  lastReviewedAt?: string;
  activityCount: number;
  activities: AccountActivity[];
  planUsage?: AccountPlanUsage;
};

export type AccountStatusUpdate = {
  key: string;
  id?: string;
  email?: string;
  name?: string;
  accountType?: AuthUser["accountType"];
  subscriptionTier?: NonNullable<AuthUser["subscriptionTier"]>;
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
