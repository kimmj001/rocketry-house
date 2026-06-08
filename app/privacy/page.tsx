import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Rocketry House",
  description: "Rocketry House 개인정보 수집 및 이용 안내"
};

const policySections = [
  {
    title: "1. 수집하는 개인정보",
    body: [
      "회원가입 및 로그인 과정에서 이메일 주소, 표시 이름, 비밀번호 인증 정보, 계정 유형(개인, 팀, 조직)을 수집합니다.",
      "프로필을 수정하는 경우 프로필 사진, 소개, 소속, 위치, 웹사이트, 전문 분야 정보를 사용자가 직접 입력할 수 있습니다.",
      "커뮤니티, 업로드, 프로젝트 저장 기능을 이용하는 경우 게시글, 댓글, 첨부 이미지, 파일명, 업로드 메타데이터, 저장 시각이 함께 보관될 수 있습니다."
    ]
  },
  {
    title: "2. 개인정보 이용 목적",
    body: [
      "계정 생성, 로그인 유지, 사용자 식별, 프로필 표시, 커뮤니티 작성자 표시, 프로젝트 및 파일 저장 기능 제공을 위해 사용합니다.",
      "서비스 품질 개선, 안전한 커뮤니티 운영, 법령 및 안전 정책 위반 신고 확인을 위해 필요한 범위에서 이용할 수 있습니다."
    ]
  },
  {
    title: "3. 보관 및 삭제",
    body: [
      "사용자가 작성한 프로필, 커뮤니티 글, 프로젝트 데이터는 서비스 제공을 위해 계정 또는 공용 커뮤니티 아카이브에 보관됩니다.",
      "사용자가 삭제를 요청하거나 서비스 운영상 보관이 필요하지 않은 경우 합리적인 기간 내 삭제합니다.",
      "로컬 개발 또는 mock mode에서는 일부 데이터가 브라우저 저장소에 저장될 수 있으며, 브라우저 데이터 삭제 시 함께 제거될 수 있습니다."
    ]
  },
  {
    title: "4. 제3자 제공 및 외부 서비스",
    body: [
      "Rocketry House는 사용자의 개인정보를 판매하지 않습니다.",
      "서비스 운영을 위해 Supabase, Vercel 등 클라우드 인프라가 사용될 수 있으며, 해당 인프라는 데이터 저장, 인증, 배포, 파일 보관을 위해 이용됩니다.",
      "법령상 요구가 있거나 이용자의 명시적 동의가 있는 경우를 제외하고 개인정보를 임의로 제3자에게 제공하지 않습니다."
    ]
  },
  {
    title: "5. 이용자 권리",
    body: [
      "이용자는 본인의 프로필 정보를 직접 수정할 수 있습니다.",
      "계정, 게시글, 첨부 파일 삭제 또는 개인정보 관련 문의가 필요한 경우 운영자에게 요청할 수 있습니다.",
      "서비스는 교육 및 합법적 로켓 공학 협업을 위한 플랫폼이며, 안전 정책 위반 콘텐츠는 제한되거나 삭제될 수 있습니다."
    ]
  },
  {
    title: "6. 문의",
    body: [
      "개인정보 처리 관련 문의는 Rocketry House 운영자에게 전달할 수 있습니다.",
      "본 방침은 서비스 기능과 데이터 구조 변경에 따라 업데이트될 수 있으며, 중요한 변경 사항은 서비스 내에서 안내합니다."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 pb-16 pt-24 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Privacy Policy</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">개인정보처리방침</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Rocketry House는 이메일 기반 계정, 프로필, 커뮤니티, 프로젝트 업로드 기능을 제공하기 위해 필요한 최소한의 개인정보를 처리합니다.
          본 방침은 MVP 서비스 운영 기준의 간단한 안내입니다.
        </p>
        <p className="mt-3 text-sm text-slate-500">시행일: 2026년 6월 8일</p>

        <section className="mt-8 space-y-4">
          {policySections.map((section) => (
            <article key={section.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600 sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
