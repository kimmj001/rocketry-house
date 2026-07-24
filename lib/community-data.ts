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
  "Marketplace",
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
  hwan: {
    name: "hwan rocket",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  solder: {
    name: "납땜요정",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  knsb: {
    name: "KNSB 초6",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  mira: {
    name: "mock-user-mira",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  },
  balloon: {
    name: "balloon",
    role: "Rocketry House builder",
    team: "Independent builder",
    badge: "Verified profile",
    profileType: "Personal"
  }
} satisfies Record<string, CommunityAuthor>;

function seedComment(id: string, author: CommunityAuthor, body: string, time: string, likes: number): CommunityComment {
  return { id, author, body, time, likes };
}

export const communityPosts: CommunityPost[] = [
  {
    slug: "nozzle-cfd-resolution-time-tradeoff",
    topic: "Propulsion",
    title: "노즐 CFD, 해상도는 올리고 계산 시간은 줄이는 쪽으로 정리해봤습니다",
    preview: "무작정 셀 수를 늘리는 대신, 민감한 구간을 먼저 찾고 그 주변만 촘촘하게 보는 방식이 훨씬 설득력 있어 보였습니다.",
    body: [
      "요즘 노즐 CFD를 돌리면서 제일 크게 느낀 건, 전체 도메인을 균일하게 고해상도로 밀어붙이는 방식은 계산 시간만 먹고 판단은 오히려 흐려진다는 점입니다. 먼저 축대칭 2D에서 압력 회복, 박리 가능 구간, 열/전단 변화가 큰 위치를 잡아두고 그 부분만 해상도를 올리는 방식이 훨씬 빨랐습니다.",
      "제가 추천하고 싶은 루틴은 격자 독립성 표를 작게라도 남기는 겁니다. coarse, reference, refined 세 케이스에서 관심 값이 얼마나 움직이는지만 봐도 '해상도를 올렸다'는 말이 훨씬 엄밀해집니다. 결과 이미지만 올리는 것보다 잔차, 질량 보존 오차, 관심 값 변화율을 함께 올리면 리뷰 받기 좋습니다.",
      "계산 시간은 먼저 형상을 단순화해서 병목을 찾고, 그 다음에 필요한 부분만 다시 복잡하게 넣는 방식이 낫다고 봅니다. 혹시 여기서 더 줄일 수 있는 체크포인트가 있으면 댓글로 공유해주세요. 제조 방법이 아니라 검증 방법 중심으로 모아두면 꽤 좋은 레퍼런스가 될 것 같습니다."
    ],
    author: launchAuthors.kim,
    time: "18 min ago",
    views: "2,840",
    likes: 86,
    comments: 3,
    evidenceLinks: ["Mesh independence table", "Residual history", "Mass balance check"],
    linkedProject: "Nozzle CFD worksheet",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T13:45:00.000Z",
    commentList: [
      seedComment("nozzle-cfd-resolution-time-tradeoff-1", launchAuthors.delft, "격자 독립성 표를 같이 올리는 제안 좋네요. 저희도 CAD 리뷰 때 결과 이미지보다 수렴 기준을 먼저 보게 만들면 논쟁이 빨리 끝났습니다.", "11 min ago", 18),
      seedComment("nozzle-cfd-resolution-time-tradeoff-2", launchAuthors.bps, "관심 값 변화율을 기준으로 삼는 쪽에 동의합니다. 예쁜 컬러맵보다 같은 위치에서 반복 측정한 숫자가 훨씬 오래 갑니다.", "8 min ago", 15),
      seedComment("nozzle-cfd-resolution-time-tradeoff-3", launchAuthors.solder, "초보 입장에서는 잔차 그래프를 같이 올려달라는 기준만 있어도 질문하기 쉬워질 것 같아요.", "4 min ago", 9)
    ]
  },
  {
    slug: "flight-log-with-uncropped-evidence",
    topic: "Flight results",
    title: "비행 로그 올릴 때 사진이 안 잘리니까 훨씬 믿음이 갑니다",
    preview: "사진 한 장이 예쁜 썸네일보다 중요한 증거일 때가 많아서, 업로드 후 원본 비율을 유지하는 쪽으로 글 포맷을 다시 잡아봤습니다.",
    body: [
      "커뮤니티에 비행 결과를 올릴 때 가장 먼저 보는 건 제목이 아니라 첨부 이미지였습니다. 노즈콘, 핀, 회수 장치, 현장 배치가 잘려 있으면 댓글을 다는 사람도 같은 장면을 보고 있는지 확신하기 어렵습니다.",
      "그래서 저는 사진을 '대표 장면'과 '검증 장면'으로 나눠 올리는 방식을 추천합니다. 대표 장면은 전체 형상이 보이는 이미지, 검증 장면은 파손 부위나 로그와 연결되는 디테일입니다. 둘 다 크롭 없이 보이면 질문이 훨씬 구체적이 됩니다.",
      "좋은 글은 성공 자랑보다 다음 사람이 재현 가능한 맥락을 남깁니다. 날씨, 질량 변화, 관측 위치, 사용한 센서, 회수 상태 같은 기본 정보를 첫 문단에 묶으면 댓글 품질이 확 올라갑니다."
    ],
    author: launchAuthors.hwan,
    time: "36 min ago",
    views: "1,960",
    likes: 64,
    comments: 2,
    evidenceLinks: ["Full-frame photo set", "Flight log template"],
    linkedProject: "Community flight evidence format",
    recommended: true,
    createdAt: "2026-07-24T13:27:00.000Z",
    commentList: [
      seedComment("flight-log-with-uncropped-evidence-1", launchAuthors.usc, "검증 장면을 따로 두는 방식 좋습니다. 실패 원인을 논의할 때 원본 비율 사진이 있으면 질문이 훨씬 덜 추측에 기대게 됩니다.", "25 min ago", 14),
      seedComment("flight-log-with-uncropped-evidence-2", launchAuthors.balloon, "회수 상태 사진은 진짜 중요합니다. 낙하산 줄이나 연결부가 잘리면 설명을 읽어도 감이 안 와요.", "19 min ago", 11)
    ]
  },
  {
    slug: "plot-these-telemetry-windows-first",
    topic: "Telemetry",
    title: "Before debating guidance, plot these telemetry windows first",
    preview: "A lively control-system thread gets better when everyone can see the same acceleration, altitude, event, voltage, and recovery windows.",
    body: [
      "When a flight thread starts with 'the controller did something weird', the useful replies usually arrive only after the raw story is visible. We ask students to post five windows first: acceleration around boost, altitude around apogee, event-channel timing, battery voltage under load, and recovery-state changes.",
      "The point is not to prove that a design is good. The point is to make the first round of comments less speculative. A noisy chart with labels is more useful than a perfect-looking screenshot without axes, units, or event markers.",
      "If Rocketry House can normalize this format, the community gets a shared language. People can disagree about interpretation while still looking at the same evidence."
    ],
    author: launchAuthors.bps,
    time: "52 min ago",
    views: "4,180",
    likes: 112,
    comments: 3,
    evidenceLinks: ["Telemetry window checklist", "Event marker legend"],
    linkedProject: "Avionics review starter pack",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T13:11:00.000Z",
    commentList: [
      seedComment("plot-these-telemetry-windows-first-1", launchAuthors.solder, "Voltage under load deserves to be in the first chart set. It catches so many 'software' bugs that are actually wiring or power issues.", "42 min ago", 22),
      seedComment("plot-these-telemetry-windows-first-2", launchAuthors.princeton, "For portfolio reviews, labeled event markers are gold. They show that the builder can explain the system, not just capture data.", "31 min ago", 19),
      seedComment("plot-these-telemetry-windows-first-3", launchAuthors.knsb, "초보자용 예시 파일이 있으면 좋겠습니다. 축 이름이랑 단위를 어디까지 적어야 하는지 헷갈려요.", "17 min ago", 8)
    ]
  },
  {
    slug: "one-page-cad-review-caught-the-mistake",
    topic: "CAD review",
    title: "The one-page CAD review that caught our mistake before machining",
    preview: "A boring checklist beat a beautiful render: interfaces, access, tolerances, service order, and recovery packaging on one printable page.",
    body: [
      "We tried a one-page CAD review format for a student assembly and it found a problem the 3D render hid very well: a fastener could be installed in CAD, but not with a real tool once the neighboring bracket existed.",
      "The review page had five blocks: interface assumptions, access paths, tolerance-sensitive features, service order, and recovery packaging. None of those blocks require proprietary dimensions to discuss in public, which makes the format suitable for community review.",
      "A good CAD post should invite another builder to ask one precise question. 'Does this look good?' is too broad. 'Can this part be inspected after assembly?' gets useful replies."
    ],
    author: launchAuthors.delft,
    time: "1 hr ago",
    views: "3,760",
    likes: 97,
    comments: 2,
    evidenceLinks: ["Interface checklist", "Assembly-access sketch"],
    linkedProject: "CAD review one-pager",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T12:49:00.000Z",
    commentList: [
      seedComment("one-page-cad-review-caught-the-mistake-1", launchAuthors.copenhagen, "Service order is underrated. If a design cannot be inspected or disassembled calmly, it tends to create pressure at exactly the wrong moment.", "51 min ago", 17),
      seedComment("one-page-cad-review-caught-the-mistake-2", launchAuthors.mira, "This is also a good marketplace standard. A seller could include an access-path image without revealing sensitive drawings.", "28 min ago", 12)
    ]
  },
  {
    slug: "failure-section-first-portfolio",
    topic: "Admissions / portfolio",
    title: "Portfolio reviewers read the failure section first",
    preview: "A polished project page is nice, but a clear failure note tells reviewers whether the builder can learn, measure, and communicate under pressure.",
    body: [
      "For students using Rocketry House as a portfolio, the strongest section is often not the final hero image. It is the failure section: what was expected, what happened, what evidence was collected, and what changed afterward.",
      "A good failure section is specific without being dramatic. Avoid blaming a mystery force. Show the assumption, the observation, and the next design decision. That pattern makes the project easier to trust.",
      "If you are writing for admissions or team recruiting, add a short 'what I would ask my past self' note. It turns the page from a trophy into an engineering conversation."
    ],
    author: launchAuthors.princeton,
    time: "2 hr ago",
    views: "2,520",
    likes: 71,
    comments: 2,
    evidenceLinks: ["Failure note outline", "Reviewer question list"],
    linkedProject: "Portfolio review guide",
    recommended: true,
    createdAt: "2026-07-24T11:44:00.000Z",
    commentList: [
      seedComment("failure-section-first-portfolio-1", launchAuthors.usc, "The 'expected / happened / evidence / changed' structure is exactly what makes a flight result readable.", "1 hr ago", 15),
      seedComment("failure-section-first-portfolio-2", launchAuthors.kim, "한국어 포트폴리오에도 그대로 쓸 수 있겠네요. 실패를 숨기지 않고 판단 과정을 보여주는 쪽이 더 전문적으로 보입니다.", "47 min ago", 13)
    ]
  },
  {
    slug: "solder-joint-telemetry-qa",
    topic: "Telemetry",
    title: "센서 로그가 이상할 때, 저는 코드보다 납땜을 먼저 의심합니다",
    preview: "갑자기 튀는 데이터가 알고리즘 문제처럼 보였는데, 전원/접지/커넥터 확인 루틴을 넣으니 원인 분리가 훨씬 빨라졌습니다.",
    body: [
      "텔레메트리 글에서 '필터를 어떻게 바꿀까요?'라는 질문이 나오면 저는 먼저 배선 사진과 전원 로그를 보고 싶습니다. 센서 값이 이상하다고 해서 항상 코드가 문제인 건 아니었습니다.",
      "제 체크 순서는 간단합니다. 전원 전압이 이벤트 순간에 흔들렸는지, 접지 기준이 바뀔 여지가 있었는지, 커넥터가 진동을 받는 방향으로 물려 있었는지, 같은 센서를 책상 위에서 다시 읽었을 때도 튀는지 봅니다.",
      "이런 글은 사진과 로그가 같이 있어야 댓글이 좋아집니다. 크롭된 사진 한 장보다, 전체 배치와 커넥터 주변 클로즈업을 함께 올리는 쪽이 훨씬 낫습니다."
    ],
    author: launchAuthors.solder,
    time: "3 hr ago",
    views: "2,230",
    likes: 68,
    comments: 2,
    evidenceLinks: ["Power log", "Wiring photo pair", "Bench replay note"],
    linkedProject: "Telemetry QA checklist",
    recommended: true,
    createdAt: "2026-07-24T10:53:00.000Z",
    commentList: [
      seedComment("solder-joint-telemetry-qa-1", launchAuthors.bps, "This is the kind of practical debugging post communities need. A sensor chart without the power story is only half a chart.", "2 hr ago", 21),
      seedComment("solder-joint-telemetry-qa-2", launchAuthors.hwan, "사진 두 장 규칙 좋네요. 전체 배치 하나, 문제 주변 하나로 올리면 댓글 달기 쉬울 것 같습니다.", "1 hr ago", 10)
    ]
  },
  {
    slug: "public-test-day-safety-brief",
    topic: "Safety notes",
    title: "Public test days need a calmer safety brief",
    preview: "The best safety briefing is not louder. It is shorter, visible, repeated, and tied to what spectators can actually observe.",
    body: [
      "A public test day is partly engineering and partly communication. Spectators should not need to decode internal team language to understand where to stand, when to be quiet, and what signal means the test is paused.",
      "We have had better results with a short visible brief: boundary, pause signal, countdown discipline, recovery boundary, and who answers public questions. None of that requires revealing sensitive technical details, but it makes the event feel much more professional.",
      "Community posts about safety should be easy to reuse. If you have a briefing card or a simple diagram that improved behavior on site, share the format and the lesson learned."
    ],
    author: launchAuthors.copenhagen,
    time: "4 hr ago",
    views: "2,970",
    likes: 82,
    comments: 2,
    evidenceLinks: ["Safety brief card", "Observer boundary sketch"],
    linkedProject: "Public test-day communication",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T09:39:00.000Z",
    commentList: [
      seedComment("public-test-day-safety-brief-1", launchAuthors.princeton, "This is also a recruiting signal. New members notice when a team can explain safety calmly.", "3 hr ago", 16),
      seedComment("public-test-day-safety-brief-2", launchAuthors.balloon, "회수 구역 설명을 미리 해두면 사람들이 착지 직후에 움직이는 실수를 덜 할 것 같아요.", "2 hr ago", 12)
    ]
  },
  {
    slug: "flight-log-people-finish-reading",
    topic: "Flight results",
    title: "A flight log people actually finish reading",
    preview: "Lead with the decision, then show the evidence. The chart belongs near the top, but the takeaway has to arrive before the reader gets tired.",
    body: [
      "A long flight report can be excellent and still fail as a community post. We have started writing logs in this order: one-sentence outcome, three key numbers, one plot, what changed from the previous attempt, and only then the detailed notes.",
      "This format respects the reader. Someone with five minutes can still understand the result, while deeper reviewers can scroll into the full context. It also makes disagreement more productive because the claim is visible before the evidence dump begins.",
      "The best thread starter is a specific question at the end. Ask whether the evidence supports the conclusion, not whether the whole flight was 'good'."
    ],
    author: launchAuthors.usc,
    time: "5 hr ago",
    views: "3,340",
    likes: 88,
    comments: 2,
    evidenceLinks: ["Flight summary order", "Chart annotation example"],
    linkedProject: "Readable flight report template",
    recommended: true,
    createdAt: "2026-07-24T08:24:00.000Z",
    commentList: [
      seedComment("flight-log-people-finish-reading-1", launchAuthors.delft, "Putting the decision before the full evidence dump makes review much easier. The reader knows what claim they are testing.", "4 hr ago", 18),
      seedComment("flight-log-people-finish-reading-2", launchAuthors.kim, "마지막 질문을 좁히는 방식 좋습니다. '무엇을 봐주세요'가 명확해야 댓글도 깊어지는 것 같아요.", "3 hr ago", 13)
    ]
  },
  {
    slug: "marketplace-bench-test-receipt",
    topic: "Marketplace",
    title: "Used avionics listings should come with a bench-test receipt",
    preview: "A marketplace can feel trustworthy if the listing asks for the right evidence: timestamped photos, power-on state, firmware note, and known limits.",
    body: [
      "A used avionics listing should not be judged by the prettiest photo. The useful evidence is boring: timestamped board photo, power-on state, firmware or configuration note, connector condition, and a clear list of what the seller did not test.",
      "This does not have to become a heavy certification process. It can be a lightweight receipt attached to the listing. The buyer gets enough context to ask better questions, and the seller avoids repeating the same explanation in messages.",
      "I would love to see Rocketry House make evidence-first marketplace posts the norm. It protects beginners from vague listings and rewards sellers who document their gear honestly."
    ],
    author: launchAuthors.mira,
    time: "6 hr ago",
    views: "1,880",
    likes: 54,
    comments: 2,
    evidenceLinks: ["Bench-test receipt", "Listing photo standard"],
    linkedProject: "Marketplace trust checklist",
    recommended: true,
    createdAt: "2026-07-24T07:12:00.000Z",
    commentList: [
      seedComment("marketplace-bench-test-receipt-1", launchAuthors.solder, "Connector condition 사진은 꼭 있었으면 좋겠습니다. 납땜이나 커넥터 문제는 사진 없으면 거의 추측이 됩니다.", "5 hr ago", 14),
      seedComment("marketplace-bench-test-receipt-2", launchAuthors.copenhagen, "Known limits are important. Honest uncertainty is more useful than overconfident listing copy.", "4 hr ago", 11)
    ]
  },
  {
    slug: "beginner-openrocket-feedback-format",
    topic: "Admissions / portfolio",
    title: "초보자가 OpenRocket 결과를 올릴 때 피드백 잘 받는 포맷",
    preview: "파일만 던지는 것보다 목표, 바꾼 값, 걱정되는 지점, 검증하고 싶은 질문을 같이 쓰면 댓글이 훨씬 빨리 달립니다.",
    body: [
      "시뮬레이션 결과를 처음 올릴 때는 '이거 맞나요?'보다 '이 조건에서 이 판단을 해도 되나요?'가 훨씬 좋은 질문입니다. 보는 사람이 어디를 확인해야 하는지 바로 알 수 있기 때문입니다.",
      "제가 쓰는 포맷은 네 줄입니다. 목표, 바꾼 값, 걱정되는 지점, 검증하고 싶은 질문. 여기에 스크린샷은 축과 단위가 보이게 올리고, 원본 파일은 프로젝트에 연결해두면 됩니다.",
      "포트폴리오 관점에서도 이 방식이 좋습니다. 정답을 맞혔다는 느낌보다, 본인이 어떤 가정을 세우고 어떤 부분을 확인하려 했는지가 드러납니다."
    ],
    author: launchAuthors.knsb,
    time: "8 hr ago",
    views: "1,540",
    likes: 49,
    comments: 2,
    evidenceLinks: ["Question template", "Simulation screenshot guide"],
    linkedProject: "Beginner simulation review",
    recommended: true,
    createdAt: "2026-07-24T05:31:00.000Z",
    commentList: [
      seedComment("beginner-openrocket-feedback-format-1", launchAuthors.princeton, "This is a strong student portfolio habit. Reviewers can see the reasoning path instead of only the final number.", "7 hr ago", 12),
      seedComment("beginner-openrocket-feedback-format-2", launchAuthors.hwan, "걱정되는 지점을 먼저 쓰면 고수들이 바로 그 부분을 봐줄 수 있겠네요.", "6 hr ago", 9)
    ]
  },
  {
    slug: "recovery-failures-worth-bookmarking",
    topic: "Safety notes",
    title: "낙하산 실패 로그는 부끄러운 글이 아니라, 제일 북마크할 만한 글입니다",
    preview: "회수 실패는 보기 불편하지만, 연결부 상태와 이벤트 타이밍을 정직하게 남긴 글이 다음 사람의 체크리스트가 됩니다.",
    body: [
      "성공한 사진보다 오래 남는 글은 회수 실패 로그일 때가 많습니다. 실패를 숨기지 않고 올린 사람이 다음 사람의 안전 여유를 만들어주기 때문입니다.",
      "좋은 회수 실패 글에는 감정보다 관찰이 많습니다. 이벤트 타이밍, 연결부 상태, 현장 사진, 예상과 달랐던 움직임, 다음 번에 바꿀 검사 항목을 나눠 쓰면 댓글도 책임감 있게 달립니다.",
      "특히 사진은 전체 장면과 디테일을 둘 다 보여주는 게 좋습니다. 이제 커뮤니티 이미지가 잘리지 않으니, 회수 장치 주변을 설명하기가 훨씬 쉬워졌습니다."
    ],
    author: launchAuthors.balloon,
    time: "10 hr ago",
    views: "2,110",
    likes: 62,
    comments: 2,
    evidenceLinks: ["Recovery postmortem format", "Inspection checklist"],
    linkedProject: "Recovery lessons archive",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T03:28:00.000Z",
    commentList: [
      seedComment("recovery-failures-worth-bookmarking-1", launchAuthors.usc, "A clean postmortem is one of the healthiest things a community can reward. It turns discomfort into shared prevention.", "9 hr ago", 17),
      seedComment("recovery-failures-worth-bookmarking-2", launchAuthors.knsb, "실패 글도 이렇게 쓰면 무섭다기보다 배울 게 많아 보입니다.", "8 hr ago", 8)
    ]
  }
];

export const communityComments: CommunityComment[] = [];

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}
