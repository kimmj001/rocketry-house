export type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType: "personal" | "team" | "organization";
  organizationName?: string;
  organizationApprovalStatus?: "none" | "requested" | "approved";
};

export const AUTH_STORAGE_KEY = "rocketry-house.auth-user";

export const demoUser: AuthUser = {
  id: "mock-user-mira",
  name: "Mira Park",
  email: "mira@rocketry.house",
  accountType: "personal"
};

export function readMockUser() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function writeMockUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("rocketry-auth-change"));
}

export function clearMockUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("rocketry-auth-change"));
}
