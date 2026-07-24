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
  },
  {
    slug: "same-motor-actual-apogee-too-low",
    topic: "Propulsion",
    title: "같은 모터인데 실제 최고고도가 시뮬레이션보다 너무 낮습니다",
    preview: "OpenRocket은 820m를 예상했는데 실제 고도계는 610m였습니다. 표면 마찰, 핀 정렬, 항력계수, 발사대 이탈 속도 중 어디부터 봐야 할까요?",
    body: [
      "이번 주말에 첫 중형 로켓을 발사했습니다. OpenRocket에서는 최고고도 820m 정도였는데, 실제 고도계 기록은 610m였습니다. 총중량은 시뮬레이션과 40g 정도밖에 차이 나지 않았고 바람도 강하지 않았습니다.",
      "가능성이 있는 원인으로는 표면 마찰, 핀 정렬, 실제 항력계수, 발사대 이탈 속도 정도를 생각하고 있습니다. 이런 차이는 흔한 편인가요? 다음 시뮬레이션에서는 어떤 값을 가장 먼저 수정하는 게 좋을까요?",
      "발사 직후 자세와 웨더코킹 여부를 다시 보려고 합니다. 특히 실제 무게중심, 도색과 접착제, 내부 배선까지 반영한 값을 다시 넣어볼 생각입니다."
    ],
    author: launchAuthors.hwan,
    time: "just now",
    views: "1,420",
    likes: 42,
    comments: 2,
    evidenceLinks: ["OpenRocket 820m vs altimeter 610m", "Image: Wikimedia Commons / newmexico.photographer, CC BY 2.0"],
    images: ["/community/seed-images/model-rocket-launch-2019.jpg"],
    linkedProject: "Apogee mismatch review",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T14:22:00.000Z",
    commentList: [
      seedComment("same-motor-actual-apogee-too-low-1", launchAuthors.delft, "시뮬레이션에 입력한 완성 중량보다 실제 무게중심 위치가 더 중요한 경우도 있어요. 도색, 접착제, 내부 배선까지 포함한 실물 값을 다시 넣어보세요.", "3 min ago", 11),
      seedComment("same-motor-actual-apogee-too-low-2", launchAuthors.bps, "발사 영상이 있으면 초기 자세와 웨더코킹 여부부터 확인해보세요. 로켓이 약간만 기울어도 수직 고도는 꽤 줄어듭니다.", "1 min ago", 9)
    ]
  },
  {
    slug: "motor-selection-rail-exit-before-apogee",
    topic: "Propulsion",
    title: "모터 선택할 때 최고고도보다 발사대 이탈 속도를 먼저 보나요?",
    preview: "목표고도에 맞는 모터는 이탈 속도가 낮고, 한 단계 큰 모터는 목표고도를 너무 초과합니다. 경험자들은 어떤 순서로 보나요?",
    body: [
      "처음에는 무조건 목표고도에 가장 가까운 모터를 고르면 된다고 생각했습니다. 그런데 약한 모터를 넣어보니 예상 최고고도는 적당한데 rail exit velocity가 낮게 나옵니다.",
      "반대로 한 단계 큰 모터는 발사대에서 빠르게 나가지만 목표고도를 많이 초과합니다. 경험자분들은 발사대 이탈 속도, 최대 가속도, 최고고도, 지연시간, 착륙 예상 지점 중 어떤 순서로 확인하시나요?",
      "대회 조건이라면 ballast까지 같이 설계하는 게 나을지도 고민 중입니다. 한 모터로 모든 조건을 맞추려 하니 선택지가 너무 좁아지는 느낌입니다."
    ],
    author: launchAuthors.bps,
    time: "6 min ago",
    views: "1,780",
    likes: 51,
    comments: 2,
    evidenceLinks: ["Rail exit velocity checklist", "Image: NASA Glenn Research Center engine performance diagram"],
    images: ["/community/seed-images/rocket-engine-performance.gif"],
    linkedProject: "Motor selection trade study",
    recommended: true,
    createdAt: "2026-07-24T14:18:00.000Z",
    commentList: [
      seedComment("motor-selection-rail-exit-before-apogee-1", launchAuthors.copenhagen, "저는 안전한 발사대 이탈 속도를 먼저 보고 그다음 고도를 봅니다. 목표고도는 무게나 항력으로 조정할 수 있지만, 느린 이탈은 발사 순간부터 위험할 수 있어서요.", "5 min ago", 14),
      seedComment("motor-selection-rail-exit-before-apogee-2", launchAuthors.usc, "대회라면 모터만 보지 말고 ballast까지 같이 설계하는 편이 낫습니다. 한 모터로 조건을 맞추려 하면 선택지가 너무 좁아져요.", "2 min ago", 8)
    ]
  },
  {
    slug: "first-tms-thrust-curve-too-jagged",
    topic: "Propulsion",
    title: "첫 TMS 결과인데 추력 곡선이 너무 울퉁불퉁합니다",
    preview: "총 임펄스는 제조사 데이터와 비슷한데 곡선이 거칠게 흔들립니다. 센서, 프레임 공진, 샘플링 중 어디부터 분리해야 할까요?",
    body: [
      "상용 모터를 이용해 소형 추력측정장치의 데이터 수집 기능을 시험했습니다. 전체적인 연소시간과 총 임펄스는 제조사 데이터와 비슷하지만 추력 곡선이 굉장히 울퉁불퉁합니다.",
      "센서 자체의 진동인지, 프레임 공진인지, 샘플링 문제인지 구분이 어렵습니다. 다음 시험 전에는 프레임 보강, 센서 배선 고정, 무부하 상태 데이터 기록, 필터 적용 전 원본 데이터 저장, 카메라 프레임과 측정값 시간 동기화를 해보려 합니다.",
      "이 중 가장 먼저 확인할 항목이 있을까요? 필터를 강하게 걸면 실제 변동까지 지워질 수 있어서 원본 데이터 보존은 반드시 하려고 합니다."
    ],
    author: launchAuthors.solder,
    time: "11 min ago",
    views: "2,260",
    likes: 67,
    comments: 2,
    evidenceLinks: ["Raw thrust data first", "Image: Wikimedia Commons / Jesman, CC0", "Image: NASA Glenn Research Center performance curves"],
    images: ["/community/seed-images/thrustcurve-d12.jpg", "/community/seed-images/rocket-engine-performance.gif"],
    linkedProject: "TMS noise isolation",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T14:13:00.000Z",
    commentList: [
      seedComment("first-tms-thrust-curve-too-jagged-1", launchAuthors.kim, "무부하 데이터와 알려진 정적 하중부터 측정해보세요. 모터 없이도 노이즈가 크면 구조보다 전기나 데이터 처리 문제일 가능성이 큽니다.", "8 min ago", 19),
      seedComment("first-tms-thrust-curve-too-jagged-2", launchAuthors.bps, "필터를 먼저 강하게 적용하면 실제 변동까지 지워질 수 있어요. 원본 데이터는 반드시 따로 보존하는 게 좋습니다.", "4 min ago", 16)
    ]
  },
  {
    slug: "rocket-bent-hard-toward-wind",
    topic: "Flight results",
    title: "로켓이 상승 중 갑자기 바람 쪽으로 크게 꺾였습니다",
    preview: "초반은 수직이었는데 일정 고도 뒤 한 번에 왼쪽으로 꺾였습니다. 웨더코킹, 핀 정렬, 과도한 안정성 중 무엇을 먼저 봐야 할까요?",
    body: [
      "비행 초반에는 거의 수직으로 올라갔는데, 어느 정도 고도가 생긴 뒤 갑자기 왼쪽으로 크게 꺾였습니다. 이후에는 안정적으로 계속 상승했고 텀블링은 없었습니다.",
      "발사 당시 지상풍은 약했지만 상공에는 바람이 있었던 것 같습니다. 안정 마진은 출발 시점 기준 약 2 caliber였습니다.",
      "이 정도면 웨더코킹으로 보는 게 맞을까요? 아니면 핀 정렬이나 과도한 안정성도 의심해야 할까요? 영상에서 회전이나 롤이 같이 발생했는지도 다시 확인해보려고 합니다."
    ],
    author: launchAuthors.balloon,
    time: "18 min ago",
    views: "1,930",
    likes: 46,
    comments: 2,
    evidenceLinks: ["Video review: pitch/yaw/roll", "Stability margin note"],
    linkedProject: "Weathercocking review",
    recommended: true,
    createdAt: "2026-07-24T14:06:00.000Z",
    commentList: [
      seedComment("rocket-bent-hard-toward-wind-1", launchAuthors.usc, "천천히 휘어진 게 아니라 한 번에 크게 방향이 바뀌었다면 돌풍이나 상층풍 변화일 수도 있습니다. 영상에서 회전이나 롤이 같이 발생했는지 보세요.", "14 min ago", 13),
      seedComment("rocket-bent-hard-toward-wind-2", launchAuthors.princeton, "안정 마진이 크면 바람을 더 적극적으로 따라가는 경향이 있습니다. 무조건 클수록 좋은 건 아니더라고요.", "9 min ago", 10)
    ]
  },
  {
    slug: "parachute-deployed-descent-twice-fast",
    topic: "Flight results",
    title: "낙하산이 펼쳐졌는데 하강 속도가 예상보다 두 배 빨랐습니다",
    preview: "시뮬레이션은 6m/s였지만 실제 기록은 11m/s 근처였습니다. 직경보다 통풍구, 줄 길이, 연결 길이, 전개 당시 속도가 더 중요할까요?",
    body: [
      "시뮬레이션에서는 하강 속도가 약 6m/s였는데 실제 기록은 11m/s 근처였습니다. 낙하산은 완전히 나온 것처럼 보였지만 영상에서는 캐노피가 계속 흔들리고 한쪽이 약간 접힌 것처럼 보입니다.",
      "줄 꼬임은 발견하지 못했습니다. 혹시 낙하산 직경보다 통풍구 크기, 줄 길이, 캐노피 재질, 로켓과의 연결 길이, 전개 당시 속도가 더 중요할까요?",
      "영상에서 완전히 팽창한 시간이 얼마나 되는지 다시 확인하려고 합니다. 전개는 됐지만 안정된 형태를 만들지 못했을 가능성이 있어 보입니다."
    ],
    author: launchAuthors.kim,
    time: "25 min ago",
    views: "2,090",
    likes: 58,
    comments: 2,
    evidenceLinks: ["Recovery video frame review", "Image: NASA Glenn Research Center flight stages diagram"],
    images: ["/community/seed-images/model-rocket-flight.gif"],
    linkedProject: "Recovery descent mismatch",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T13:59:00.000Z",
    commentList: [
      seedComment("parachute-deployed-descent-twice-fast-1", launchAuthors.copenhagen, "영상에서 완전히 팽창한 시간이 얼마나 되는지 확인해보세요. 전개는 됐지만 안정된 형태를 만들지 못했을 수 있습니다.", "21 min ago", 17),
      seedComment("parachute-deployed-descent-twice-fast-2", launchAuthors.delft, "시뮬레이션에 입력한 항력계수가 실제 낙하산과 맞지 않을 가능성도 큽니다. 낙하산은 표시 직경만으로 성능을 예측하기 어렵더라고요.", "16 min ago", 12)
    ]
  },
  {
    slug: "first-flight-fin-fillet-crack",
    topic: "Flight results",
    title: "첫 비행 성공했는데 착륙 후 핀 하나가 갈라졌습니다",
    preview: "비행과 회수는 성공했지만 착륙 후 핀 필렛 근처에 15mm 미세 균열이 생겼습니다. 부분 보강이면 충분할까요?",
    body: [
      "비행 자체는 성공했고 전자장비도 모두 회수했습니다. 다만 착륙 후 확인해보니 핀 한 장의 필렛 근처에 미세한 균열이 생겼습니다.",
      "지면이 단단했고 착륙 순간 로켓이 옆으로 쓰러지면서 핀이 먼저 닿았습니다. 다음 비행 전에 해당 부분만 보강해도 될까요, 아니면 핀 전체를 교체하는 편이 나을까요?",
      "균열 길이는 약 15mm이고 손으로 흔들었을 때 눈에 띄는 유격은 없습니다. 겉 균열보다 내부 접착면을 확인해야 한다는 의견도 있어 고민됩니다."
    ],
    author: launchAuthors.hwan,
    time: "34 min ago",
    views: "1,310",
    likes: 37,
    comments: 2,
    evidenceLinks: ["Landing damage note", "Fin fillet inspection"],
    linkedProject: "Post-flight damage inspection",
    recommended: true,
    createdAt: "2026-07-24T13:50:00.000Z",
    commentList: [
      seedComment("first-flight-fin-fillet-crack-1", launchAuthors.delft, "겉에서 보이는 균열보다 내부 접착면이 더 중요해요. 가능하면 내부까지 확인한 뒤 판단하는 게 좋습니다.", "29 min ago", 12),
      seedComment("first-flight-fin-fillet-crack-2", launchAuthors.usc, "저라면 다음 비행 전에 수리하고 저출력 모터로 확인 비행을 한 번 할 것 같아요. 바로 더 큰 모터는 부담스럽습니다.", "23 min ago", 10)
    ]
  },
  {
    slug: "fin-tab-motor-mount-clearance-tight",
    topic: "CAD review",
    title: "핀 탭과 모터 마운트 사이 간격이 너무 좁을까요?",
    preview: "리테이너와 핀 탭 끝 사이 여유가 3mm뿐입니다. 접착제와 제작 오차, 공구 접근까지 고려하면 너무 빡빡해 보입니다.",
    body: [
      "첫 자체 설계 로켓 CAD를 검토 중입니다. 핀 탭이 모터 튜브까지 연결되는 구조인데, 리테이너와 핀 탭 끝 사이 여유가 약 3mm뿐입니다.",
      "조립은 가능해 보이지만 접착제와 제작 오차까지 고려하면 너무 빡빡할 것 같습니다. 일반적으로 CAD 단계에서 최소 간격을 어느 정도 두는 편인가요?",
      "특히 실제 제작에서는 도면보다 접착제가 더 많은 공간을 차지하는 느낌입니다. 완성품만 볼 게 아니라 공구가 들어갈 공간과 조립 순서까지 CAD에서 재현해보려고 합니다."
    ],
    author: launchAuthors.delft,
    time: "45 min ago",
    views: "1,870",
    likes: 52,
    comments: 2,
    evidenceLinks: ["Assembly clearance review", "Image: NASA Glenn Research Center model rocket parts diagram"],
    images: ["/community/seed-images/model-rocket-parts.gif"],
    linkedProject: "Fin tab clearance CAD check",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T13:39:00.000Z",
    commentList: [
      seedComment("fin-tab-motor-mount-clearance-tight-1", launchAuthors.princeton, "3mm면 출력 오차와 접착제까지 고려했을 때 꽤 타이트해 보여요. 조립 순서까지 CAD에서 한번 재현해보는 걸 추천합니다.", "39 min ago", 15),
      seedComment("fin-tab-motor-mount-clearance-tight-2", launchAuthors.solder, "완성품만 보지 말고 공구가 들어갈 공간도 확인하세요. 부품은 들어가는데 조이거나 붙일 방법이 없는 경우가 꽤 있습니다.", "33 min ago", 13)
    ]
  },
  {
    slug: "how-hollow-can-printed-nosecone-be",
    topic: "CAD review",
    title: "3D 프린트 노즈콘 내부를 얼마나 비워도 될까요?",
    preview: "외벽 2.4mm와 내부 리브 구조로 질량을 줄이고 싶지만, 착륙과 운반 중 손상이 걱정됩니다. 어디가 먼저 깨지나요?",
    body: [
      "노즈콘을 3D 프린트하려고 합니다. 현재 모델은 외벽 2.4mm, 내부 리브 구조이며 아래쪽에 무게추를 넣을 수 있는 공간을 남겨두었습니다.",
      "질량을 줄이고 싶지만 너무 얇게 만들면 착륙이나 운반 중 손상될 것 같습니다. 비행하중보다는 지상에서 떨어뜨리는 상황이 더 걱정됩니다.",
      "비슷한 크기의 노즈콘을 출력해본 분들은 어떤 부분이 가장 먼저 깨졌나요? 팁보다 어깨 부분과 동체가 만나는 경계가 약하다는 이야기를 들었습니다."
    ],
    author: launchAuthors.kim,
    time: "56 min ago",
    views: "1,520",
    likes: 39,
    comments: 2,
    evidenceLinks: ["Nose cone shell thickness note", "Layer direction test plan"],
    linkedProject: "3D printed nose cone review",
    recommended: true,
    createdAt: "2026-07-24T13:28:00.000Z",
    commentList: [
      seedComment("how-hollow-can-printed-nosecone-be-1", launchAuthors.balloon, "팁보다는 어깨 부분과 동체가 만나는 경계가 잘 깨졌습니다. 삽입과 분리를 반복하면서 응력이 쌓이더라고요.", "49 min ago", 11),
      seedComment("how-hollow-can-printed-nosecone-be-2", launchAuthors.bps, "벽 두께만 늘리기보다 레이어 방향과 재료 선택도 중요해요. 출력 후 실제 동체에 여러 번 끼워보는 테스트를 추천합니다.", "42 min ago", 10)
    ]
  },
  {
    slug: "avionics-bay-cad-review-maintenance",
    topic: "CAD review",
    title: "전자장비 베이 CAD 검토 부탁드립니다",
    preview: "부품 간 간격은 충분하지만 배선 경로가 복잡하고 조립 후 가운데 커넥터에 손이 닿지 않습니다. 유지보수성을 우선해도 될까요?",
    body: [
      "전자장비 베이를 처음 설계했습니다. 구성은 비행컴퓨터 1개, 배터리 2개, 스위치 2개, 안테나 고정부로 되어 있습니다.",
      "부품 간 간격은 충분해 보이는데 배선 경로가 복잡하고, 조립 후에는 가운데 커넥터에 손이 닿지 않습니다. 현재 고민은 트레이를 양쪽에서 꺼낼 수 있게 만들기, 커넥터 위치를 바깥쪽으로 이동하기 두 가지입니다.",
      "진동보다 유지보수성을 우선해도 될까요? 현장에서 배터리 교체와 continuity 확인을 해야 하니 유지보수성도 안전의 일부라고 생각하게 됩니다."
    ],
    author: launchAuthors.solder,
    time: "1 hr ago",
    views: "1,660",
    likes: 44,
    comments: 2,
    evidenceLinks: ["Avionics tray access review", "Strain relief placement"],
    linkedProject: "Avionics bay CAD access",
    recommended: true,
    createdAt: "2026-07-24T13:16:00.000Z",
    commentList: [
      seedComment("avionics-bay-cad-review-maintenance-1", launchAuthors.copenhagen, "현장에서 배터리 교체와 continuity 확인을 해야 하므로 유지보수성도 안전의 일부라고 생각합니다.", "58 min ago", 14),
      seedComment("avionics-bay-cad-review-maintenance-2", launchAuthors.delft, "배선이 커넥터를 잡아당기지 않도록 strain relief를 어디에 둘지도 CAD에 표시해두면 좋아요.", "51 min ago", 12)
    ]
  },
  {
    slug: "telemetry-dropout-around-300m",
    topic: "Telemetry",
    title: "300m 부근에서 텔레메트리가 끊겼다가 다시 잡혔습니다",
    preview: "지상 테스트는 정상인데 실제 비행에서 300m 부근부터 패킷 손실이 급격히 늘었습니다. 안테나 배치부터 볼까요?",
    body: [
      "지상 테스트에서는 문제가 없었지만 실제 비행에서 약 300m 부근부터 패킷 손실이 급격히 늘었습니다. 최고점 이후에는 다시 일부 데이터가 들어왔습니다.",
      "안테나는 동체 내부에 세로로 설치했고 근처에 배터리와 금속 고정봉이 있습니다. 발사대 근처에서는 RSSI가 충분했습니다.",
      "이런 경우에는 안테나 배치, 지상국 방향, 송신 주기 중 어떤 것을 먼저 의심하는 게 좋을까요? 온보드 저장 데이터는 남아 있어 무선 링크 문제인지 센서 오류인지 먼저 분리해보려 합니다."
    ],
    author: launchAuthors.bps,
    time: "1 hr ago",
    views: "2,350",
    likes: 73,
    comments: 2,
    evidenceLinks: ["RSSI versus altitude review", "Onboard log comparison"],
    linkedProject: "Telemetry dropout investigation",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T13:04:00.000Z",
    commentList: [
      seedComment("telemetry-dropout-around-300m-1", launchAuthors.solder, "동체 재질과 안테나 주변 금속부터 확인해보세요. 지상에서 가까울 때 괜찮아도 자세가 바뀌면서 음영 구간이 생길 수 있습니다.", "1 hr ago", 18),
      seedComment("telemetry-dropout-around-300m-2", launchAuthors.usc, "온보드 저장 데이터가 남아 있다면 실제 센서 오류인지 무선 링크 문제인지 먼저 분리할 수 있겠네요.", "55 min ago", 13)
    ]
  },
  {
    slug: "telemetry-and-onboard-log-time-drift",
    topic: "Telemetry",
    title: "텔레메트리 데이터와 온보드 로그 시간이 맞지 않습니다",
    preview: "90초 뒤 실시간 데이터와 SD 로그가 0.8초 벌어집니다. GPS 시간 동기화와 이벤트 기준 사후 보정 중 무엇이 단순할까요?",
    body: [
      "수신한 실시간 데이터와 SD 카드에 저장된 데이터의 타임스탬프가 조금씩 벌어집니다. 초기에는 거의 일치하지만 90초 정도 지나면 약 0.8초 차이가 납니다.",
      "최고고도와 낙하산 전개 시점을 비교할 때 꽤 불편합니다. GPS 시간을 기준으로 다시 동기화하는 게 좋을까요? 아니면 비행 시작 이벤트를 기준으로 사후 보정하는 편이 단순할까요?",
      "각 장치의 로컬 클럭 오차라면 시작점만 맞춰서는 해결이 안 될 것 같아서, 시간에 따른 drift 비율을 계산하는 방식도 고민 중입니다."
    ],
    author: launchAuthors.mira,
    time: "2 hr ago",
    views: "1,470",
    likes: 36,
    comments: 2,
    evidenceLinks: ["Clock drift estimate", "Shared event markers"],
    linkedProject: "Telemetry log alignment",
    recommended: true,
    createdAt: "2026-07-24T12:51:00.000Z",
    commentList: [
      seedComment("telemetry-and-onboard-log-time-drift-1", launchAuthors.bps, "각 장치의 로컬 클럭 오차라면 시작점만 맞춰서는 해결이 안 됩니다. 시간에 따른 drift 비율을 계산해 보정해야 할 것 같아요.", "1 hr ago", 11),
      seedComment("telemetry-and-onboard-log-time-drift-2", launchAuthors.princeton, "발사 감지, 최고점, 전개처럼 여러 개의 공통 이벤트를 기준점으로 쓰면 사후 정렬 정확도가 더 좋아집니다.", "1 hr ago", 9)
    ]
  },
  {
    slug: "live-telemetry-dashboard-essential-values",
    topic: "Telemetry",
    title: "라이브 대시보드에서 정말 필요한 값은 무엇인가요?",
    preview: "고도, 속도, 가속도, 전압, GPS, RSSI, 상태 코드를 한 화면에 다 넣으니 발사 중 핵심 상태를 놓치기 쉽습니다.",
    body: [
      "팀용 지상국 화면을 새로 만들고 있습니다. 현재는 고도, 속도, 가속도, 배터리 전압, GPS 좌표, RSSI, 상태 코드까지 전부 한 화면에 표시합니다.",
      "그런데 실제 발사 때는 정보가 너무 많아서 핵심 상태를 놓치기 쉽습니다. 발사 중 반드시 크게 보여야 하는 값과, 분석 화면으로 넘겨도 되는 값을 어떻게 구분하시나요?",
      "실시간 화면은 상태와 경고 중심으로 단순하게 두고, 그래프는 고도와 링크 상태 정도만 크게 보여도 충분하다는 의견을 들었습니다."
    ],
    author: launchAuthors.usc,
    time: "2 hr ago",
    views: "1,980",
    likes: 59,
    comments: 2,
    evidenceLinks: ["Ground station screen priority", "Warning-first dashboard"],
    linkedProject: "Live telemetry dashboard",
    recommended: true,
    createdAt: "2026-07-24T12:37:00.000Z",
    commentList: [
      seedComment("live-telemetry-dashboard-essential-values-1", launchAuthors.delft, "실시간 화면은 상태와 경고 중심으로 단순하게 두는 게 좋았습니다. 그래프는 고도와 링크 상태 정도만 크게 보여도 충분했어요.", "2 hr ago", 16),
      seedComment("live-telemetry-dashboard-essential-values-2", launchAuthors.solder, "정상 값을 많이 보여주는 것보다 비정상 상태가 발생했을 때 색이나 소리로 확실히 알려주는 게 더 유용합니다.", "1 hr ago", 15)
    ]
  },
  {
    slug: "new-university-rocket-team-roles",
    topic: "University teams",
    title: "신생 대학 로켓팀에서 역할을 어떻게 나누면 좋을까요?",
    preview: "인원 11명 대부분이 처음입니다. 구조, 추진, 전자, 회수, 시뮬레이션, 운영을 처음부터 세분화해도 될까요?",
    body: [
      "이번 학기에 새로 만들어진 대학 로켓팀입니다. 현재 인원은 11명이고 대부분 로켓 제작 경험이 없습니다.",
      "우선 구조·CAD, 추진 및 모터 선정, 전자·텔레메트리, 회수 시스템, 시뮬레이션, 운영·후원으로 나누려고 합니다. 하지만 사람이 적어서 한 명이 여러 역할을 맡아야 합니다.",
      "처음부터 파트를 세분화하는 게 좋을까요, 아니면 첫 로켓은 전원이 같이 만드는 편이 좋을까요? 대학팀 커뮤니티에서는 역할을 나누되 기록과 협업을 중요하게 보라는 조언이 반복되는 것 같습니다."
    ],
    author: launchAuthors.princeton,
    time: "3 hr ago",
    views: "2,740",
    likes: 81,
    comments: 2,
    evidenceLinks: ["Team structure draft", "Shared design review ritual"],
    linkedProject: "New university team operating model",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T12:19:00.000Z",
    commentList: [
      seedComment("new-university-rocket-team-roles-1", launchAuthors.delft, "초기에는 파트를 나누되 설계 리뷰는 전원이 참여하는 방식이 좋았습니다. 완전히 분리하면 서로 무엇을 하는지 모르게 돼요.", "2 hr ago", 21),
      seedComment("new-university-rocket-team-roles-2", launchAuthors.usc, "CAD와 문서 담당을 별도 역할로 두는 걸 추천합니다. 설계 결정과 변경 이유를 남기는 사람이 없으면 다음 학기에 처음부터 다시 시작하게 됩니다.", "2 hr ago", 18)
    ]
  },
  {
    slug: "team-files-disappear-after-graduation",
    topic: "University teams",
    title: "팀원이 만든 파일과 데이터가 졸업할 때마다 사라집니다",
    preview: "코드, CAD, 시험 결과가 개인 계정과 메신저에 흩어져 있습니다. GitHub와 공유 드라이브를 어떻게 정리하면 좋을까요?",
    body: [
      "저희 팀의 가장 큰 문제는 기술보다 인수인계입니다. 지난해 비행컴퓨터 코드는 개인 계정에 있고, CAD 파일은 여러 버전이 메신저에 흩어져 있으며, 시험 결과는 엑셀과 사진으로 따로 존재합니다.",
      "올해부터 GitHub와 공유 드라이브를 도입하려고 합니다. CAD 원본, 제작 도면, BOM, 시험 데이터, 비행 결과, 설계 변경 기록을 다른 대학팀은 어떻게 정리하시나요?",
      "최종 파일만 저장하지 말고 왜 그렇게 결정했는지 남기는 게 핵심이라는 조언이 와닿았습니다. 실패한 안도 기록해두면 다음 팀이 같은 실수를 피할 수 있을 것 같습니다."
    ],
    author: launchAuthors.delft,
    time: "3 hr ago",
    views: "2,210",
    likes: 66,
    comments: 2,
    evidenceLinks: ["CAD/BOM/test-data archive plan", "Approved version marker"],
    linkedProject: "Team handoff archive",
    recommended: true,
    createdAt: "2026-07-24T12:03:00.000Z",
    commentList: [
      seedComment("team-files-disappear-after-graduation-1", launchAuthors.princeton, "최종 파일만 저장하지 말고 왜 그렇게 결정했는지 남기는 게 핵심입니다. 실패한 안도 기록해두면 다음 팀이 같은 실수를 피할 수 있어요.", "3 hr ago", 18),
      seedComment("team-files-disappear-after-graduation-2", launchAuthors.copenhagen, "파일명 규칙보다 승인된 버전을 표시하는 절차가 더 중요했습니다. 폴더는 정리돼 있어도 어떤 파일을 제작에 사용했는지 모르는 경우가 많았어요.", "2 hr ago", 15)
    ]
  },
  {
    slug: "first-competition-technical-goals-too-high",
    topic: "University teams",
    title: "대회 첫 참가인데 기술 목표를 너무 높게 잡은 것 같습니다",
    preview: "첫해부터 자체 비행컴퓨터, 이중 전개, 능동제어, 커스텀 추진기관을 모두 하자는 의견이 나왔습니다. 너무 과할까요?",
    body: [
      "첫해부터 자체 비행컴퓨터, 이중 전개, 능동제어, 커스텀 추진기관을 전부 하자는 의견이 나왔습니다.",
      "개인적으로는 상용 모터와 검증된 회수 시스템으로 우선 안정적인 비행을 성공시키고, 자체 개발 요소는 하나만 넣는 게 낫다고 생각합니다.",
      "첫 대회에서 기술 난도를 낮추는 것이 소극적인 판단일까요? 아니면 완성도와 비행 성공률을 먼저 확보하는 게 맞을까요?"
    ],
    author: launchAuthors.usc,
    time: "4 hr ago",
    views: "2,680",
    likes: 74,
    comments: 2,
    evidenceLinks: ["Scope control note", "Integration risk list"],
    linkedProject: "First competition scope review",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T11:45:00.000Z",
    commentList: [
      seedComment("first-competition-technical-goals-too-high-1", launchAuthors.bps, "처음에는 인터페이스가 적은 구조가 훨씬 낫습니다. 기능이 늘수록 각 파트가 성공해도 통합 단계에서 문제가 생겨요.", "3 hr ago", 20),
      seedComment("first-competition-technical-goals-too-high-2", launchAuthors.princeton, "기술적으로 어려운 기능 하나를 명확하게 보여주는 편이, 미완성 기능 다섯 개보다 포트폴리오에도 좋아 보입니다.", "3 hr ago", 17)
    ]
  },
  {
    slug: "rocket-project-for-admissions-portfolio",
    topic: "Admissions / portfolio",
    title: "로켓 프로젝트를 대학 포트폴리오에 어떻게 보여주면 좋을까요?",
    preview: "완성 사진만으로 끝내면 얕아 보일 것 같습니다. 설계 과정, 시뮬레이션, 실패와 수정, 비행 데이터 중 무엇을 중심에 둘까요?",
    body: [
      "고등학생이고 모델 로켓 프로젝트를 대학 지원 포트폴리오에 넣으려고 합니다. 완성된 로켓 사진은 있지만 단순히 '만들어서 발사했다'로 끝나면 깊이가 부족해 보일 것 같습니다.",
      "설계 과정, OpenRocket 시뮬레이션, 제작 실패와 수정, 실제 비행 데이터, 팀 내 역할, 안전 계획 중 무엇을 중심으로 구성하는 것이 좋을까요?",
      "최종 결과보다 문제를 발견하고 수정한 과정을 보여주는 게 좋다는 의견이 많았습니다. 예상과 실제가 달랐던 부분이 오히려 좋은 소재가 될 수 있을 것 같습니다."
    ],
    author: launchAuthors.knsb,
    time: "4 hr ago",
    views: "1,950",
    likes: 63,
    comments: 2,
    evidenceLinks: ["Portfolio story outline", "Expected vs actual comparison"],
    linkedProject: "Admissions portfolio structure",
    recommended: true,
    createdAt: "2026-07-24T11:29:00.000Z",
    commentList: [
      seedComment("rocket-project-for-admissions-portfolio-1", launchAuthors.princeton, "최종 결과보다 문제를 발견하고 수정한 과정을 보여주는 게 좋을 것 같습니다. 예상과 실제가 달랐던 부분이 오히려 좋은 소재예요.", "4 hr ago", 19),
      seedComment("rocket-project-for-admissions-portfolio-2", launchAuthors.kim, "본인이 직접 맡은 부분을 분명히 표시하세요. 팀 프로젝트인데 모든 것을 혼자 한 것처럼 보이면 신뢰도가 떨어질 수 있습니다.", "3 hr ago", 15)
    ]
  },
  {
    slug: "rocket-project-outside-aerospace-major",
    topic: "Admissions / portfolio",
    title: "항공우주 전공이 아니어도 로켓 프로젝트가 도움이 될까요?",
    preview: "기계공학과 전기전자공학 사이에서 고민 중입니다. 로켓 프로젝트를 특정 전공에 맞춰 억지로 정리해야 할까요?",
    body: [
      "기계공학과와 전기전자공학과 사이에서 고민하고 있습니다. 로켓팀에서는 CAD와 구조 설계를 맡았지만, 최근에는 센서와 데이터 분석에도 관심이 생겼습니다.",
      "포트폴리오를 특정 전공에 맞춰 억지로 정리해야 하는지, 아니면 여러 분야가 연결된 프로젝트로 보여줘도 되는지 궁금합니다.",
      "로켓은 원래 여러 전공이 섞인 시스템이라 연결성을 보여주기 좋은 프로젝트라고 생각합니다. 다만 '로켓을 좋아한다'에서 끝내지 말고 어떤 공학적 질문에 관심을 갖게 됐는지를 전공과 연결하려 합니다."
    ],
    author: launchAuthors.mira,
    time: "5 hr ago",
    views: "1,610",
    likes: 47,
    comments: 2,
    evidenceLinks: ["Cross-major portfolio framing", "Systems engineering reflection"],
    linkedProject: "Major-fit portfolio note",
    recommended: true,
    createdAt: "2026-07-24T11:12:00.000Z",
    commentList: [
      seedComment("rocket-project-outside-aerospace-major-1", launchAuthors.delft, "로켓은 원래 여러 전공이 섞인 시스템이라 오히려 연결성을 보여주기 좋은 프로젝트라고 생각합니다.", "4 hr ago", 14),
      seedComment("rocket-project-outside-aerospace-major-2", launchAuthors.princeton, "'로켓을 좋아한다'에서 끝내지 말고, 그 과정에서 어떤 공학적 질문에 관심을 갖게 됐는지를 전공과 연결하면 좋을 것 같아요.", "4 hr ago", 13)
    ]
  },
  {
    slug: "prelaunch-checklist-missing-items",
    topic: "Safety notes",
    title: "발사 전 점검표에 꼭 들어가야 할 항목을 정리하고 있습니다",
    preview: "외관, 모터 고정, 무게중심, 회수장치, 전원, 점화 회로, 인원 확인, 풍속, 접근 절차 외에 현장에서 자주 빠지는 항목이 있을까요?",
    body: [
      "팀마다 구두로 확인하던 내용을 체크리스트로 바꾸려고 합니다. 현재 포함한 항목은 로켓 외관과 핀 상태, 모터 고정, 무게중심 위치, 회수장치 연결, 전자장비 전원, 점화 회로 연속성입니다.",
      "여기에 발사대와 주변 인원 확인, 풍속과 발사 방향, 발사 후 접근 절차까지 넣었습니다. 실제 현장에서 자주 빠뜨리는 항목이 있다면 알려주세요.",
      "비행 준비뿐 아니라 회수 후 미점화 상태나 손상된 모터를 어떻게 다룰지도 체크리스트에 넣어야 한다는 의견을 반영하려고 합니다."
    ],
    author: launchAuthors.copenhagen,
    time: "5 hr ago",
    views: "2,880",
    likes: 91,
    comments: 2,
    evidenceLinks: ["Prelaunch checklist draft", "Image: NASA Glenn Research Center model rocket parts diagram"],
    images: ["/community/seed-images/model-rocket-parts.gif"],
    linkedProject: "Launch-day safety checklist",
    best: true,
    recommended: true,
    createdAt: "2026-07-24T10:56:00.000Z",
    commentList: [
      seedComment("prelaunch-checklist-missing-items-1", launchAuthors.usc, "비행 준비뿐 아니라 회수 후 미점화 상태나 손상된 모터를 어떻게 다룰지도 체크리스트에 넣는 게 좋습니다.", "5 hr ago", 21),
      seedComment("prelaunch-checklist-missing-items-2", launchAuthors.delft, "누가 최종 발사 승인권을 갖는지도 명확히 정하세요. 모두 확인했다고 생각하지만 실제로는 아무도 전체를 확인하지 않은 경우가 생깁니다.", "4 hr ago", 18)
    ]
  },
  {
    slug: "launch-scrub-criteria-before-field",
    topic: "Safety notes",
    title: "발사 취소 기준을 미리 숫자로 정하는 게 좋을까요?",
    preview: "풍속, 시야, 지면 상태, 통신 상태, 회수 예상 범위의 취소 기준을 정하려 합니다. 정량 기준과 안전담당자 판단을 어떻게 섞나요?",
    body: [
      "발사 당일에는 이미 많은 시간과 비용을 썼기 때문에 '이 정도면 괜찮겠지'라는 분위기가 생기는 것 같습니다.",
      "그래서 풍속, 시야, 지면 상태, 통신 상태, 회수 예상 범위 등에 대해 사전에 취소 기준을 정하려고 합니다. 다만 현장은 변수가 많아서 지나치게 딱딱한 기준도 문제가 될 것 같습니다.",
      "다른 팀들은 정량 기준과 안전담당자 판단을 어떻게 조합하나요? 숫자로 판단할 수 있는 것은 미리 정하고, 그보다 보수적으로 취소할 권한은 안전담당자에게 주는 방식이 좋아 보입니다."
    ],
    author: launchAuthors.princeton,
    time: "6 hr ago",
    views: "2,040",
    likes: 70,
    comments: 2,
    evidenceLinks: ["Scrub criteria draft", "Safety officer authority"],
    linkedProject: "Launch/no-launch decision guide",
    recommended: true,
    createdAt: "2026-07-24T10:38:00.000Z",
    commentList: [
      seedComment("launch-scrub-criteria-before-field-1", launchAuthors.copenhagen, "숫자로 판단할 수 있는 것은 미리 정하고, 그보다 보수적으로 취소할 권한은 안전담당자에게 주는 방식이 좋다고 봅니다.", "5 hr ago", 17),
      seedComment("launch-scrub-criteria-before-field-2", launchAuthors.balloon, "'발사해야 하는 이유'가 아니라 '발사하지 않아도 되는 이유'를 자유롭게 말할 수 있는 분위기도 중요합니다.", "5 hr ago", 15)
    ]
  },
  {
    slug: "unused-altimeter-tracker-for-sale",
    topic: "Marketplace",
    title: "사용하지 않은 고도계와 추적기를 판매합니다",
    preview: "소형 고도계, GPS 추적기, 지상 수신기, 케이블과 인쇄 설명서를 판매합니다. 호환 주파수와 지역 규정은 구매 전 직접 확인해주세요.",
    body: [
      "프로젝트 방향이 바뀌면서 사용하지 않게 된 장비를 판매합니다. 구성은 소형 고도계 1개, GPS 추적기 1개, 전용 지상 수신기 1개, 연결 케이블 및 인쇄 설명서입니다.",
      "고도계는 전원 테스트만 했고 실제 비행에는 사용하지 않았습니다. 추적기는 지상에서 통신 테스트를 두 번 진행했습니다.",
      "구매 전 호환 주파수와 사용 지역 규정을 직접 확인해 주세요. 일괄 판매를 우선하지만 며칠 동안 구매자가 없으면 개별 판매도 고려하겠습니다. 오늘 저녁에 캘리퍼로 외형 크기를 측정해서 본문에 추가하겠습니다. 배터리는 포함하지 않습니다."
    ],
    author: launchAuthors.mira,
    time: "7 hr ago",
    views: "1,330",
    likes: 28,
    comments: 3,
    evidenceLinks: ["Bench power-on only", "Ground link tested twice", "Buyer must verify local RF rules"],
    linkedProject: "Marketplace avionics listing",
    recommended: true,
    createdAt: "2026-07-24T10:17:00.000Z",
    commentList: [
      seedComment("unused-altimeter-tracker-for-sale-1", launchAuthors.solder, "배터리 커넥터 규격과 외형 크기도 알려주실 수 있나요? 제 avionics bay에 들어가는지 확인하고 싶습니다.", "6 hr ago", 10),
      seedComment("unused-altimeter-tracker-for-sale-2", launchAuthors.mira, "오늘 저녁에 캘리퍼로 측정해서 본문에 추가하겠습니다. 배터리는 포함하지 않습니다.", "6 hr ago", 8),
      seedComment("unused-altimeter-tracker-for-sale-3", launchAuthors.bps, "펌웨어 버전과 마지막 정상 작동 날짜도 함께 적어주시면 구매 판단에 도움이 될 것 같습니다.", "5 hr ago", 9)
    ]
  }
];

export const communityComments: CommunityComment[] = [];

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}
