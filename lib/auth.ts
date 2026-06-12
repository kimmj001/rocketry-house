import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType: "personal" | "team" | "organization";
  organizationName?: string;
  organizationApprovalStatus?: "none" | "requested" | "approved";
  avatarUrl?: string;
  headline?: string;
  bio?: string;
  location?: string;
  website?: string;
  specialties?: string;
  createdAt?: string;
  isDemo?: boolean;
};

export const AUTH_STORAGE_KEY = "rocketry-house.auth-user";
export const AUTH_ACCOUNTS_KEY = "rocketry-house.auth-accounts";

type LocalAccountRecord = {
  user: AuthUser;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

export function readMockUser() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const user = JSON.parse(stored) as AuthUser;
    if (user.id?.startsWith("local-signin-")) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function writeMockUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...user, email: normalizeEmail(user.email), isDemo: false }));
  window.dispatchEvent(new Event("rocketry-auth-change"));
}

export async function signOutAuthUser() {
  const supabase = getSupabaseClient();
  if (supabase && !isMockMode) {
    await supabase.auth.signOut();
  }
  clearMockUser();
}

export function clearMockUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("rocketry-auth-change"));
}

export function mapSupabaseUserToAuthUser(user: User, fallback?: Partial<AuthUser>): AuthUser {
  const metadata = user.user_metadata ?? {};
  const accountType = metadata.account_type === "team" || metadata.account_type === "organization" || metadata.account_type === "personal"
    ? metadata.account_type
    : fallback?.accountType ?? "personal";
  const approvalStatus = metadata.organization_approval_status === "requested" || metadata.organization_approval_status === "approved" || metadata.organization_approval_status === "none"
    ? metadata.organization_approval_status
    : fallback?.organizationApprovalStatus ?? (accountType === "organization" ? "approved" : accountType === "team" ? "requested" : "none");

  return {
    id: user.id,
    name: String(metadata.name ?? metadata.display_name ?? fallback?.name ?? user.email?.split("@")[0] ?? "Rocketry House member"),
    email: normalizeEmail(user.email ?? fallback?.email ?? ""),
    accountType,
    organizationName: typeof metadata.organization_name === "string" ? metadata.organization_name : fallback?.organizationName,
    organizationApprovalStatus: approvalStatus,
    avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : fallback?.avatarUrl,
    headline: typeof metadata.headline === "string" ? metadata.headline : fallback?.headline,
    bio: typeof metadata.bio === "string" ? metadata.bio : fallback?.bio,
    location: typeof metadata.location === "string" ? metadata.location : fallback?.location,
    website: typeof metadata.website === "string" ? metadata.website : fallback?.website,
    specialties: typeof metadata.specialties === "string" ? metadata.specialties : fallback?.specialties,
    createdAt: user.created_at ?? fallback?.createdAt ?? new Date().toISOString(),
    isDemo: false
  };
}

export async function restoreAuthUserFromCloud() {
  const cachedUser = readMockUser();
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return cachedUser;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return cachedUser;
  }

  const user = mapSupabaseUserToAuthUser(data.user, cachedUser ?? undefined);
  writeMockUser(user);
  return user;
}

export async function saveAuthUserProfileToCloud(user: AuthUser) {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { cloud: false, error: null };

  const metadata = {
    name: user.name,
    display_name: user.name,
    account_type: user.accountType,
    organization_name: user.organizationName,
    organization_approval_status: user.organizationApprovalStatus,
    avatar_url: user.avatarUrl,
    headline: user.headline,
    bio: user.bio,
    location: user.location,
    website: user.website,
    specialties: user.specialties
  };

  const { error: authError } = await supabase.auth.updateUser({ data: metadata });
  const { error: recordError } = await supabase.from("user_data_records").upsert(
    {
      owner_key: `user:${user.id}`,
      collection: "profiles",
      record_key: user.id,
      payload: user,
      updated_at: new Date().toISOString()
    },
    { onConflict: "owner_key,collection,record_key" }
  );

  return { cloud: !authError, error: authError ?? recordError };
}

export async function createLocalAccount(user: AuthUser, password: string) {
  if (typeof window === "undefined") throw new Error("Account storage is unavailable.");
  const email = normalizeEmail(user.email);
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  validatePassword(password);

  const accounts = readLocalAccounts();
  if (accounts.some((account) => normalizeEmail(account.user.email) === email)) {
    throw new Error("An account already exists for this email. Sign in instead.");
  }

  const now = new Date().toISOString();
  const passwordSalt = createSalt();
  const record: LocalAccountRecord = {
    user: {
      ...user,
      id: user.id || createLocalUserId(),
      email,
      createdAt: user.createdAt ?? now,
      isDemo: false
    },
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt),
    createdAt: now,
    updatedAt: now
  };

  writeLocalAccounts([record, ...accounts]);
  return record.user;
}

export async function authenticateLocalAccount(email: string, password: string) {
  if (typeof window === "undefined") throw new Error("Account storage is unavailable.");
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) throw new Error("Enter a valid email address.");
  validatePassword(password);

  const account = readLocalAccounts().find((record) => normalizeEmail(record.user.email) === normalizedEmail);
  if (!account) {
    throw new Error("No account exists for this email. Create an account first.");
  }

  const passwordHash = await hashPassword(password, account.passwordSalt);
  if (passwordHash !== account.passwordHash) {
    throw new Error("Incorrect password.");
  }

  return { ...account.user, email: normalizedEmail, isDemo: false };
}

export function updateLocalAccountUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  const email = normalizeEmail(user.email);
  const accounts = readLocalAccounts();
  const nextAccounts = accounts.map((account) =>
    normalizeEmail(account.user.email) === email
      ? { ...account, user: { ...account.user, ...user, email, isDemo: false }, updatedAt: new Date().toISOString() }
      : account
  );
  writeLocalAccounts(nextAccounts);
}

function readLocalAccounts() {
  try {
    const stored = localStorage.getItem(AUTH_ACCOUNTS_KEY);
    const parsed = stored ? (JSON.parse(stored) as LocalAccountRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccountRecord[]) {
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function createLocalUserId() {
  if (globalThis.crypto?.randomUUID) return `local-${globalThis.crypto.randomUUID()}`;
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSalt() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function hashPassword(password: string, salt: string) {
  const text = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}
