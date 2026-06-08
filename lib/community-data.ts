export type CommunityAuthor = {
  name: string;
  role: string;
  team: string;
  badge: string;
  avatarUrl?: string;
  profileType: "Personal" | "Team" | "Organization";
};

export type CommunityComment = {
  id: string;
  author: CommunityAuthor;
  body: string;
  time: string;
  likes: number;
};

export type CommunityPost = {
  slug: string;
  topic: string;
  title: string;
  preview: string;
  body: string[];
  author: CommunityAuthor;
  time: string;
  views: string;
  likes: number;
  comments: number;
  evidenceLinks: string[];
  images?: string[];
  linkedProject?: string;
  best?: boolean;
  recommended?: boolean;
  createdAt?: string;
  createdLocally?: boolean;
  commentList?: CommunityComment[];
};

export const currentCommunityUser: CommunityAuthor = {
  name: "Signed-in builder",
  role: "Rocketry House member",
  team: "Independent builder",
  badge: "Profile",
  profileType: "Personal"
};

export function getCommunityAuthorFromAuth(user: {
  name: string;
  accountType: "personal" | "team" | "organization";
  organizationName?: string;
  avatarUrl?: string;
  headline?: string;
} | null): CommunityAuthor {
  if (!user) return currentCommunityUser;
  const profileType = user.accountType === "organization" ? "Organization" : user.accountType === "team" ? "Team" : "Personal";
  return {
    name: user.name,
    role: user.headline?.trim() || (user.accountType === "organization" ? "Organization owner" : user.accountType === "team" ? "Team representative" : "Rocketry House builder"),
    team: user.organizationName ?? (user.accountType === "personal" ? "Independent builder" : user.name),
    badge: user.accountType === "personal" ? "Verified profile" : "Verified account",
    avatarUrl: user.avatarUrl,
    profileType
  };
}

export const communityTopics = [
  "All topics",
  "Propulsion",
  "Flight results",
  "CAD review",
  "Telemetry",
  "University teams",
  "Admissions / portfolio",
  "Safety notes",
  "Marketplace"
] as const;

export const communityPosts: CommunityPost[] = [];

export const communityComments: CommunityComment[] = [];

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}
