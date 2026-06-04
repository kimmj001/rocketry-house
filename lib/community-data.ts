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
  createdLocally?: boolean;
  commentList?: CommunityComment[];
};

export const currentCommunityUser: CommunityAuthor = {
  name: "Myeon Kim",
  role: "Rocketry House builder",
  team: "UNIST Nova Lab",
  badge: "Verified profile",
  avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
  profileType: "Personal"
};

export function getCommunityAuthorFromAuth(user: {
  name: string;
  accountType: "personal" | "team" | "organization";
  organizationName?: string;
  avatarUrl?: string;
} | null): CommunityAuthor {
  if (!user) return currentCommunityUser;
  const profileType = user.accountType === "organization" ? "Organization" : user.accountType === "team" ? "Team" : "Personal";
  return {
    name: user.name,
    role: user.accountType === "organization" ? "Organization owner" : user.accountType === "team" ? "Team representative" : "Rocketry House builder",
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

export const communityPosts: CommunityPost[] = [
  {
    slug: "publication-strengthen-stem-application",
    topic: "Admissions / portfolio",
    title: "Can a public rocket research publication strengthen a STEM application?",
    preview: "A polished public project page can show research depth, English technical writing, evidence, and initiative beyond a school report.",
    body: [
      "A public Rocketry House project can be useful when it reads like an engineering publication instead of a casual activity log. Admissions readers can see the question, design assumptions, data, and what changed after testing.",
      "The strongest version links CAD, simulation, raw files, telemetry, and a written conclusion. That creates a portfolio artifact that says the student did more than participate: they built, measured, revised, and explained.",
      "For teams, I would recommend a short abstract, clear project role attribution, and one public evidence package. The goal is not to look flashy, but to make the work easy to verify."
    ],
    author: {
      name: "Alex Morgan",
      role: "Aerospace Portfolio Mentor",
      team: "Global Student Rocketry Alliance",
      badge: "Organization verified",
      profileType: "Organization"
    },
    time: "1 hour ago",
    views: "12,480",
    likes: 328,
    comments: 54,
    evidenceLinks: ["Portfolio publication template", "Example project evidence package"],
    linkedProject: "Beginner School Rocket",
    best: true,
    recommended: true
  },
  {
    slug: "measured-thrust-higher-than-simulation",
    topic: "Propulsion",
    title: "Measured thrust curve is higher than the simulation peak. What should I disclose?",
    preview: "Our static-fire CSV shows a sharper peak than the educational motor estimate. I want to publish the dataset without overstating certainty.",
    body: [
      "We ran a static-fire test and the measured thrust curve peaks higher than the simulation. The total impulse is closer than expected, but the pressure rise and peak thrust do not match the model.",
      "Before publishing this as a marketplace motor dataset, I want to know what metadata should be mandatory. My instinct is to include sensor range, sampling rate, filtering, calibration note, stand geometry, and the raw CSV.",
      "I am not trying to publish manufacturing detail. This is strictly about data quality, disclosure, and making the comparison useful for other builders."
    ],
    author: {
      name: "Daniel Lee",
      role: "Propulsion Data Reviewer",
      team: "Open Aerospace Systems Network",
      badge: "Verified builder",
      profileType: "Personal"
    },
    time: "2 hours ago",
    views: "8,914",
    likes: 241,
    comments: 37,
    evidenceLinks: ["Static-fire CSV", "Calibration note", "Sensor range summary"],
    linkedProject: "Static Fire Motor Dataset",
    best: true,
    recommended: true
  },
  {
    slug: "dual-deploy-apogee-missed-simulation",
    topic: "Flight results",
    title: "Our dual-deploy rocket separated cleanly, but measured apogee missed simulation by 11%.",
    preview: "We flew the same airframe twice with a saved H-class motor record. The second flight had cleaner rail departure but lower altitude.",
    body: [
      "We flew the same airframe twice with a saved H-class motor record. The second flight had cleaner rail departure, but measured apogee was still 11 percent lower than the pre-flight estimate.",
      "The airframe inspection looks clean and the recovery event was normal. I am wondering whether to publish this as a simulation mismatch note, a drag estimate issue, or a weather correction problem.",
      "I attached the altimeter CSV, launch rail length, wind estimate, and post-flight inspection photos in the project evidence package."
    ],
    author: {
      name: "Minjun Kim",
      role: "Flight Systems Lead",
      team: "Seoul STEM Launch Lab",
      badge: "Verified team member",
      profileType: "Team"
    },
    time: "2 hours ago",
    views: "2,184",
    likes: 72,
    comments: 19,
    evidenceLinks: ["Altimeter CSV", "Weather estimate", "Post-flight photos"],
    linkedProject: "Dual Deploy Certification Rocket"
  },
  {
    slug: "fin-planform-review-54mm-build",
    topic: "CAD review",
    title: "Fin planform review: clipped delta vs swept tapered for a 54 mm high-power build",
    preview: "The CP margin looks comfortable, but the current fin root length may be making the aft section heavier than it needs to be.",
    body: [
      "I am comparing a clipped delta fin set against a swept tapered version for a 54 mm high-power build. Both are stable in the current estimate, but the aft mass changes enough to affect CG.",
      "The web CAD model shows a strong stability margin, but I do not want to publish a design that looks good visually and performs poorly after motor installation.",
      "Would you publish both versions as forkable variants, or keep only the flight article and attach the rejected geometry as design history?"
    ],
    author: {
      name: "Jaeho Kim",
      role: "Founder / Lab Director",
      team: "UNIST Nova Lab",
      badge: "Organization verified",
      profileType: "Organization"
    },
    time: "4 hours ago",
    views: "1,732",
    likes: 38,
    comments: 14,
    evidenceLinks: ["Web CAD revision A", "Web CAD revision B", "Stability comparison"]
  },
  {
    slug: "mixed-gps-barometric-altitude-labeling",
    topic: "Telemetry",
    title: "How should we label mixed GPS and barometric altitude in a public flight log?",
    preview: "The GPS trace is noisy during boost, while the barometric altimeter has a clean apogee event.",
    body: [
      "The GPS trace is noisy during boost, while the barometric altimeter has a clean apogee event. I want the upload page to show both without implying one is the single source of truth.",
      "My current idea is to label GPS altitude as trajectory context and barometric altitude as event timing evidence. That still leaves questions around filtering and smoothing.",
      "For public evidence, should the project detail page prioritize raw logs, cleaned plots, or both side by side?"
    ],
    author: {
      name: "Hannah Park",
      role: "Avionics Engineer",
      team: "Open Aerospace Systems Network",
      badge: "Verified builder",
      profileType: "Personal"
    },
    time: "7 hours ago",
    views: "940",
    likes: 18,
    comments: 11,
    evidenceLinks: ["GPS log", "Barometric altimeter CSV", "Cleaned comparison chart"]
  },
  {
    slug: "post-flight-inspection-note",
    topic: "Safety notes",
    title: "What belongs in a post-flight inspection note?",
    preview: "Recovery photos, fin roots, motor retention, nozzle condition, and deployment state all seem important, but what should be required?",
    body: [
      "I want to make post-flight inspection notes more consistent across our team projects. We usually upload photos, but the conclusions are not structured enough for future builders.",
      "My proposed template includes airframe condition, fin root condition, motor retention, recovery harness, deployment evidence, avionics bay, and anomalies.",
      "If a project is later sold or forked, this inspection note may be more valuable than the polished launch video."
    ],
    author: {
      name: "Yuna Choi",
      role: "Recovery Systems Engineer",
      team: "Waterloo Recovery Systems",
      badge: "Verified team member",
      profileType: "Team"
    },
    time: "9 hours ago",
    views: "6,422",
    likes: 91,
    comments: 22,
    evidenceLinks: ["Inspection checklist", "Recovery photo set", "Deployment event note"],
    recommended: true
  }
];

export const communityComments: CommunityComment[] = [
  {
    id: "comment-yuna-evidence",
    author: {
      name: "Yuna Choi",
      role: "Recovery Systems Engineer",
      team: "Waterloo Recovery Systems",
      badge: "Verified team member",
      profileType: "Team"
    },
    body: "I would separate simulation assumptions from measured evidence. Keep predicted apogee and actual apogee side by side, then attach the raw altimeter export.",
    time: "42 minutes ago",
    likes: 12
  },
  {
    id: "comment-daniel-thrust",
    author: {
      name: "Daniel Lee",
      role: "Propulsion Data Reviewer",
      team: "Open Aerospace Systems Network",
      badge: "Verified builder",
      profileType: "Personal"
    },
    body: "For thrust curve mismatch, publish the measurement method first. Sensor range, sampling rate, filtering, and calibration notes matter more than a polished graph.",
    time: "35 minutes ago",
    likes: 8
  },
  {
    id: "comment-mina-revision",
    author: {
      name: "Mina Seo",
      role: "University Team Captain",
      team: "Seoul STEM Launch Lab",
      badge: "Verified team member",
      profileType: "Team"
    },
    body: "The best public posts are the ones that explain what the team would change on the next build. That is what makes the thread reusable.",
    time: "18 minutes ago",
    likes: 6
  }
];

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}
