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

export const demoUser: AuthUser = {
  id: "mock-user-mira",
  name: "Mira Park",
  email: "mira@rocketry.house",
  accountType: "personal",
  avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  headline: "Flight systems and propulsion data builder",
  bio: "Building public rocket dossiers with CAD, motor analysis, telemetry, and repeatable launch evidence.",
  location: "Seoul / Daejeon",
  website: "https://rocketry.house",
  specialties: "Propulsion analysis, flight systems, recovery design, telemetry review",
  createdAt: "2026-05-01T00:00:00.000Z",
  isDemo: true
};

export function isDemoAccount(user: AuthUser | null) {
  return Boolean(user?.isDemo || user?.id === demoUser.id || user?.email === demoUser.email);
}

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
