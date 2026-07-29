import { isHiddenCommunityComment, isHiddenCommunityPost } from "@/lib/internal-test-data";

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

export const guestCommunityUser: CommunityAuthor = {
  name: "Guest reader",
  role: "Sign in to write, reply, save, or report",
  team: "Public community",
  badge: "Guest",
  profileType: "Personal"
};

export function getCommunityAuthorFromAuth(user: {
  name: string;
  accountType: "personal" | "team" | "organization";
  organizationName?: string;
  avatarUrl?: string;
  headline?: string;
} | null): CommunityAuthor {
  if (!user) return guestCommunityUser;
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
  "Equipment notes",
  "Other"
] as const;

const launchAuthors = {
  bps: {
    name: "BPS.space",
    role: "BPS.space team account",
    team: "Independent Builder Network",
    badge: "Verified account",
    profileType: "Team"
  },
  copenhagen: {
    name: "Copenhagen Suborbitals",
    role: "Copenhagen Suborbitals team account",
    team: "Open Aerospace Systems Network",
    badge: "Verified account",
    profileType: "Team"
  },
  delft: {
    name: "Delft Aerospace Rocket Engineering",
    role: "Delft Aerospace Rocket Engineering team account",
    team: "University Rocketry League",
    badge: "Verified account",
    profileType: "Team"
  },
  usc: {
    name: "USC Rocket Propulsion Laboratory",
    role: "USC Rocket Propulsion Laboratory team account",
    team: "University Rocketry League",
    badge: "Verified account",
    profileType: "Team"
  },
  princeton: {
    name: "Princeton Rocketry Club",
    role: "Princeton Rocketry Club team account",
    team: "University Rocketry League",
    badge: "Verified account",
    profileType: "Team"
  },
  kim: {
    name: "Kim MyeongJun",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  solder: {
    name: "Solder Lab",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  mira: {
    name: "Mira Avionics",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  balloon: {
    name: "Range Balloon Lab",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  }
} satisfies Record<string, CommunityAuthor>;

function seedComment(id: string, author: CommunityAuthor, body: string, time: string, likes: number): CommunityComment {
  return { id, author, body, time, likes };
}

const seededCommunityPosts: CommunityPost[] = [
  {
    slug: "nozzle-cfd-resolution-time-tradeoff-en",
    topic: "Propulsion",
    title: "Nozzle CFD: how we are increasing resolution while cutting solve time",
    preview: "Uniform high resolution is slow and often less useful. A small grid-independence table and focused throat refinement made our reviews clearer.",
    body: [
      "When we review nozzle CFD, the most useful change has been to stop refining the full domain at once. We first run a compact axisymmetric case, identify pressure recovery, likely separation regions, heat gradients, and shear changes, then refine only the sensitive zones.",
      "A small grid-independence table is more persuasive than a colorful image. We compare coarse, reference, and refined cases with residuals, mass conservation error, and changes in the values we actually care about.",
      "This keeps the thread about verification rather than manufacturing. Other builders can see why a result is trustworthy without needing unsafe process details."
    ],
    author: launchAuthors.kim,
    time: "18 min ago",
    views: "4,280",
    likes: 116,
    comments: 3,
    evidenceLinks: ["Grid independence table", "Residual trend", "Mass conservation check"],
    linkedProject: "Nozzle CFD worksheet",
    best: true,
    recommended: true,
    createdAt: "2026-07-27T10:40:00.000Z",
    commentList: [
      seedComment("nozzle-cfd-resolution-time-tradeoff-en-1", launchAuthors.delft, "The grid-independence table is the part I would pin. It makes the review about convergence instead of screenshots.", "11 min ago", 18),
      seedComment("nozzle-cfd-resolution-time-tradeoff-en-2", launchAuthors.bps, "Focused throat refinement is also easier to explain to students. The whole domain does not need the same mesh density.", "8 min ago", 15),
      seedComment("nozzle-cfd-resolution-time-tradeoff-en-3", launchAuthors.usc, "Please include the failed cases too. Seeing non-converged runs helps people understand the numerical boundary.", "4 min ago", 9)
    ]
  },
  {
    slug: "flight-log-with-uncropped-evidence-en",
    topic: "Flight results",
    title: "Uncropped photos made our flight log much easier to trust",
    preview: "A flight report becomes clearer when the full rocket, recovery state, and damage detail are visible without thumbnail cropping.",
    body: [
      "When a community post is about a flight result, the image often carries the first piece of evidence. If the nose, fins, recovery gear, or field layout is cropped away, reviewers cannot tell whether they are looking at the same context as the author.",
      "We now separate representative photos from verification photos. The representative image shows the whole vehicle, and verification images show recovery condition, damage, or sensor placement with the original aspect ratio intact.",
      "The best flight reports leave reusable context: weather, mass changes, observer position, sensor source, and recovery status. That makes replies more specific and less speculative."
    ],
    author: launchAuthors.usc,
    time: "32 min ago",
    views: "3,910",
    likes: 102,
    comments: 2,
    evidenceLinks: ["Full-frame vehicle photo", "Recovery condition photo"],
    images: ["/community/seed-images/model-rocket-parts.gif"],
    linkedProject: "Community flight evidence format",
    best: true,
    recommended: true,
    createdAt: "2026-07-27T10:25:00.000Z",
    commentList: [
      seedComment("flight-log-with-uncropped-evidence-en-1", launchAuthors.copenhagen, "A separate recovery-condition photo helps a lot. It keeps the discussion grounded in evidence.", "25 min ago", 14),
      seedComment("flight-log-with-uncropped-evidence-en-2", launchAuthors.balloon, "The full-frame image also helps range staff understand where everyone was standing.", "19 min ago", 11)
    ]
  },
  {
    slug: "plot-these-telemetry-windows-first-en",
    topic: "Telemetry",
    title: "Plot these telemetry windows before asking why the controller behaved oddly",
    preview: "Acceleration, altitude, events, battery voltage, and recovery-state windows make avionics threads much more useful.",
    body: [
      "When an avionics thread starts with a vague controller question, the useful replies usually arrive only after the raw story is visible. We ask students to post five windows first: acceleration around boost, altitude around apogee, event-channel timing, battery voltage under load, and recovery-state changes.",
      "The point is not to prove that a design is perfect. The point is to make the first round of comments less speculative.",
      "A noisy chart with axes and event labels is more valuable than a clean screenshot with missing units."
    ],
    author: launchAuthors.bps,
    time: "48 min ago",
    views: "5,510",
    likes: 141,
    comments: 3,
    evidenceLinks: ["Acceleration window", "Event-channel timing", "Battery sag note"],
    linkedProject: "Avionics review starter pack",
    best: true,
    recommended: true,
    createdAt: "2026-07-27T10:08:00.000Z",
    commentList: [
      seedComment("plot-these-telemetry-windows-first-en-1", launchAuthors.delft, "Event markers are the fastest way to separate software timing from wiring or power issues.", "38 min ago", 22),
      seedComment("plot-these-telemetry-windows-first-en-2", launchAuthors.princeton, "For portfolio reviews, labeled event markers are excellent because they show the builder can explain the system.", "31 min ago", 19),
      seedComment("plot-these-telemetry-windows-first-en-3", launchAuthors.solder, "A sample file with axis names and units would help new builders post better data.", "17 min ago", 8)
    ]
  },
  {
    slug: "failure-section-first-portfolio-en",
    topic: "Admissions / portfolio",
    title: "Put the failure section before the glamour photos",
    preview: "A portfolio project looks stronger when the reader sees the engineering question, the failed assumption, and the revision path first.",
    body: [
      "For student portfolios, we started moving failure and revision notes before the final photo. It sounds counterintuitive, but it makes the project feel more serious.",
      "The structure we use is simple: original goal, assumption that failed, data that revealed the issue, revision made, and what remained uncertain.",
      "The finished vehicle still matters, but the reasoning path is what admissions reviewers and mentors can actually evaluate."
    ],
    author: launchAuthors.princeton,
    time: "1 hr ago",
    views: "3,170",
    likes: 88,
    comments: 2,
    evidenceLinks: ["Revision timeline", "Before-after mass table"],
    linkedProject: "Portfolio review guide",
    recommended: true,
    createdAt: "2026-07-27T09:52:00.000Z",
    commentList: [
      seedComment("failure-section-first-portfolio-en-1", launchAuthors.kim, "This also keeps the final photo from doing too much work. The reasoning becomes the centerpiece.", "52 min ago", 16),
      seedComment("failure-section-first-portfolio-en-2", launchAuthors.delft, "Uncertainty belongs in a portfolio. It shows judgment instead of just confidence.", "47 min ago", 13)
    ]
  },
  {
    slug: "bench-test-evidence-receipt-en",
    topic: "Equipment notes",
    title: "A useful avionics reference starts with boring bench-test evidence",
    preview: "Timestamped photos, power-on state, firmware notes, and known limits are more useful than a polished product photo.",
    body: [
      "An avionics reference should not be judged by the prettiest photo. The useful evidence is boring: timestamped board photo, power-on state, firmware or configuration note, connector condition, and a clear list of untested limits.",
      "This does not have to become a heavy certification process. It can be a lightweight receipt attached to the project note.",
      "Other builders get enough context to ask better questions, and the author avoids repeating the same explanation in messages."
    ],
    author: launchAuthors.solder,
    time: "5 hr ago",
    views: "2,240",
    likes: 61,
    comments: 2,
    evidenceLinks: ["Power-on photo", "Connector condition note", "Known limits"],
    linkedProject: "Equipment evidence checklist",
    recommended: true,
    createdAt: "2026-07-27T06:10:00.000Z",
    commentList: [
      seedComment("bench-test-evidence-receipt-en-1", launchAuthors.bps, "Known limits are important. Honest uncertainty is more useful than overconfident reference notes.", "5 hr ago", 14),
      seedComment("bench-test-evidence-receipt-en-2", launchAuthors.mira, "Connector condition photos would have saved us several repeated questions last season.", "4 hr ago", 11)
    ]
  },
  {
    slug: "same-motor-actual-apogee-too-low-en",
    topic: "Propulsion",
    title: "Same motor, but actual apogee was much lower than the simulation",
    preview: "OpenRocket predicted 820 m, but the altimeter recorded 610 m. Which assumptions should we check first?",
    body: [
      "We flew our first mid-power rocket this weekend. OpenRocket predicted about 820 m apogee, but the altimeter recorded 610 m. Finished mass was only about 40 g different from the simulation, and wind near the ground was not strong.",
      "The likely suspects are surface finish, fin alignment, actual drag coefficient, and rail-exit velocity. Is this kind of gap common?",
      "I am going back through the launch video to check early attitude and weathercocking. I am also planning to re-enter the real center of gravity with paint, adhesive, and internal wiring included."
    ],
    author: launchAuthors.kim,
    time: "2 hr ago",
    views: "4,720",
    likes: 96,
    comments: 2,
    evidenceLinks: ["OpenRocket estimate", "Altimeter apogee", "Launch video review"],
    linkedProject: "Apogee mismatch review",
    best: true,
    recommended: true,
    createdAt: "2026-07-27T08:42:00.000Z",
    commentList: [
      seedComment("same-motor-actual-apogee-too-low-en-1", launchAuthors.delft, "The real center of gravity can matter more than the small total-mass difference. Include paint, adhesive, and wiring.", "1 hr ago", 11),
      seedComment("same-motor-actual-apogee-too-low-en-2", launchAuthors.bps, "Check the video for early attitude and weathercocking first. A small tilt can remove a surprising amount of vertical altitude.", "1 hr ago", 9)
    ]
  },
  {
    slug: "motor-selection-rail-exit-before-apogee-en",
    topic: "Propulsion",
    title: "When choosing a motor, do you check rail-exit velocity before apogee?",
    preview: "A motor that fits the target altitude can still leave the guide too slowly. How do experienced teams order the checks?",
    body: [
      "I used to choose the motor closest to the target altitude first. Then I tried a weaker motor and saw that the predicted apogee looked fine, but rail-exit velocity was low.",
      "The next motor up leaves the rail quickly but overshoots the altitude target. How do you order rail-exit velocity, maximum acceleration, apogee, delay timing, and predicted landing zone?",
      "If this were for a competition, I am also wondering whether ballast should be part of the design process. Trying to satisfy every condition with the motor alone makes the choices feel too narrow."
    ],
    author: launchAuthors.bps,
    time: "2 hr ago",
    views: "3,640",
    likes: 84,
    comments: 2,
    evidenceLinks: ["Motor comparison table", "Rail-exit velocity estimate"],
    linkedProject: "Motor selection trade study",
    recommended: true,
    createdAt: "2026-07-27T08:25:00.000Z",
    commentList: [
      seedComment("motor-selection-rail-exit-before-apogee-en-1", launchAuthors.copenhagen, "I check safe rail exit first, then altitude. Target altitude can often be adjusted by mass or drag.", "2 hr ago", 14),
      seedComment("motor-selection-rail-exit-before-apogee-en-2", launchAuthors.usc, "For a competition, do not judge the motor alone. Designing ballast with the motor gives you more room.", "2 hr ago", 8)
    ]
  },
  {
    slug: "telemetry-dropout-around-300m-en",
    topic: "Telemetry",
    title: "Telemetry dropped out near 300 m and then came back",
    preview: "Ground tests were clean, but packet loss rose sharply during flight. Should antenna placement be the first suspect?",
    body: [
      "Ground testing looked normal, but during flight packet loss rose sharply around 300 m. After apogee, some data started coming back.",
      "The antenna is mounted vertically inside the airframe, with battery and metal hardware nearby. RSSI was strong near the pad.",
      "Should we suspect antenna placement, ground-station orientation, or transmit interval first? Onboard logs are available, so I want to separate wireless-link issues from sensor issues."
    ],
    author: launchAuthors.solder,
    time: "3 hr ago",
    views: "2,610",
    likes: 64,
    comments: 2,
    evidenceLinks: ["RSSI ground test", "Onboard SD log"],
    linkedProject: "Telemetry dropout investigation",
    recommended: true,
    createdAt: "2026-07-27T07:32:00.000Z",
    commentList: [
      seedComment("telemetry-dropout-around-300m-en-1", launchAuthors.delft, "Check airframe material and nearby metal first. A good close-range test can still hide orientation shadows.", "2 hr ago", 18),
      seedComment("telemetry-dropout-around-300m-en-2", launchAuthors.usc, "If onboard data exists, you can quickly separate wireless link problems from sensor problems.", "2 hr ago", 13)
    ]
  },
  {
    slug: "new-university-rocket-team-roles-en",
    topic: "University teams",
    title: "How should a new university rocket team divide roles?",
    preview: "We have 11 mostly new members. Should structure, propulsion, electronics, recovery, simulation, and operations be split from day one?",
    body: [
      "We are a new university rocket team this semester. We have 11 members, and most are new to rocketry.",
      "Our draft role split is structures and CAD, propulsion and motor selection, electronics and telemetry, recovery, simulation, operations, and sponsorship. The challenge is that a small team means each person may need several roles.",
      "Should we specialize immediately, or build the first rocket together? The advice I keep hearing is to divide responsibility while keeping design reviews shared."
    ],
    author: launchAuthors.delft,
    time: "4 hr ago",
    views: "2,980",
    likes: 77,
    comments: 2,
    evidenceLinks: ["Role map", "Shared review cadence"],
    linkedProject: "New university team operating model",
    recommended: true,
    createdAt: "2026-07-27T06:58:00.000Z",
    commentList: [
      seedComment("new-university-rocket-team-roles-en-1", launchAuthors.princeton, "Split roles, but make the design review shared. Full separation makes people lose system context.", "3 hr ago", 21),
      seedComment("new-university-rocket-team-roles-en-2", launchAuthors.copenhagen, "Add a documentation owner early. Next semester will thank you.", "3 hr ago", 18)
    ]
  },
  {
    slug: "prelaunch-checklist-missing-items-en",
    topic: "Safety notes",
    title: "I am organizing the must-have items for a prelaunch checklist",
    preview: "We already check exterior condition, motor retention, CG, recovery, power, continuity, people, wind, and post-launch approach.",
    body: [
      "We want to turn the verbal checks our team does into a written checklist. Right now it includes rocket exterior and fin condition, motor retention, center of gravity, recovery connection, avionics power, and ignition circuit continuity.",
      "We also included launch rail and personnel checks, wind speed and launch direction, and post-launch approach procedure. What items are commonly forgotten at the field?",
      "I am going to add post-recovery handling too, especially what to do with a possible misfire state or damaged motor after retrieval."
    ],
    author: launchAuthors.copenhagen,
    time: "5 hr ago",
    views: "2,880",
    likes: 91,
    comments: 2,
    evidenceLinks: ["Prelaunch checklist draft", "Safety officer authority"],
    images: ["/community/seed-images/model-rocket-parts.gif"],
    linkedProject: "Launch-day safety checklist",
    best: true,
    recommended: true,
    createdAt: "2026-07-27T04:54:00.000Z",
    commentList: [
      seedComment("prelaunch-checklist-missing-items-en-1", launchAuthors.usc, "Include not just flight prep, but also how to handle misfire states or damaged motors after recovery.", "5 hr ago", 21),
      seedComment("prelaunch-checklist-missing-items-en-2", launchAuthors.delft, "Make it explicit who has final launch authority.", "4 hr ago", 18)
    ]
  },
  {
    slug: "launch-scrub-criteria-before-field-en",
    topic: "Safety notes",
    title: "Should launch scrub criteria be defined numerically before going to the field?",
    preview: "I want thresholds for wind, visibility, ground condition, communications, and recovery area, but I do not want the criteria to be too rigid.",
    body: [
      "On launch day, the team has already spent time and money, so it becomes easy to say that conditions are probably fine.",
      "Because of that, I want to define scrub criteria in advance for wind, visibility, ground condition, communication status, and predicted recovery area.",
      "How do other teams combine quantitative thresholds and safety-officer judgment? My current thought is to set numbers where numbers make sense, and give the safety officer authority to cancel more conservatively."
    ],
    author: launchAuthors.princeton,
    time: "6 hr ago",
    views: "2,040",
    likes: 70,
    comments: 2,
    evidenceLinks: ["Scrub criteria draft", "Safety officer authority"],
    linkedProject: "Launch/no-launch decision guide",
    recommended: true,
    createdAt: "2026-07-27T04:36:00.000Z",
    commentList: [
      seedComment("launch-scrub-criteria-before-field-en-1", launchAuthors.copenhagen, "Set numerical thresholds where numbers work, and give the safety officer authority to scrub even more conservatively.", "5 hr ago", 17),
      seedComment("launch-scrub-criteria-before-field-en-2", launchAuthors.balloon, "It also matters that people feel free to explain why the launch does not need to happen.", "5 hr ago", 15)
    ]
  }
];

function containsNonEnglishScript(value: unknown): boolean {
  if (typeof value === "string") return /[^\x00-\x7F]/.test(value);
  if (Array.isArray(value)) return value.some(containsNonEnglishScript);
  if (value && typeof value === "object") return Object.values(value).some(containsNonEnglishScript);
  return false;
}

export function isEnglishCommunityPost(post: CommunityPost) {
  return !containsNonEnglishScript(post) && !isHiddenCommunityPost(post);
}

export function isEnglishCommunityComment(comment: CommunityComment) {
  return !containsNonEnglishScript(comment) && !isHiddenCommunityComment(comment);
}

export const communityPosts: CommunityPost[] = seededCommunityPosts.filter(isEnglishCommunityPost);

export const communityComments: CommunityComment[] = [];

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}
