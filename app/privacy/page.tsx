import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Rocketry House",
  description: "How Rocketry House handles account, profile, community, and project data."
};

const policySections = [
  {
    title: "1. Information we collect",
    body: [
      "When you create an account or sign in, Rocketry House may collect your email address, display name, authentication metadata, and account type.",
      "When you edit your profile, you may provide a profile image, bio, affiliation, location, website, and engineering interests.",
      "When you use community, upload, project, motor, and simulation features, Rocketry House may store posts, comments, image attachments, filenames, uploaded metadata, CAD records, and simulation records."
    ]
  },
  {
    title: "2. How we use information",
    body: [
      "We use account and profile data to provide sign-in, identity, profile display, community authorship, cloud sync, and project archiving.",
      "We use project and simulation data to provide engineering collaboration, evidence review, safety moderation, and product improvement.",
      "We use usage counters to enforce exact Standard plan limits for projects, CFD runs, direct messages, organization teams, broadcasts, and event pages."
    ]
  },
  {
    title: "3. Storage and deletion",
    body: [
      "Signed-in data is intended to be stored in Rocketry House cloud infrastructure, with Supabase as the source of truth for persisted user records.",
      "Some data may be cached locally in the browser for temporary drafts or offline display. Local cache is not treated as the long-term source of truth.",
      "You may request deletion of account-related data by contacting the Rocketry House team."
    ]
  },
  {
    title: "4. Third-party infrastructure",
    body: [
      "Rocketry House uses cloud infrastructure such as Supabase and Vercel for authentication, database storage, file storage, hosting, and deployment.",
      "Rocketry House does not sell personal information.",
      "We do not share personal information with third parties except where required to operate the service, comply with law, protect safety, or honor explicit user direction."
    ]
  },
  {
    title: "5. Safety and moderation",
    body: [
      "Rocketry House is for educational, lawful rocketry collaboration and engineering documentation.",
      "Content that includes harmful payload workflows, targeting systems, weaponization instructions, or unsafe illegal activity may be restricted or removed.",
      "Users remain responsible for complying with applicable laws, launch rules, club rules, site rules, and certified safety codes."
    ]
  },
  {
    title: "6. Contact",
    body: [
      "For privacy, account, article coverage, or project data questions, contact Rocketry House at rocketryhouse@gmail.com.",
      "This policy may be updated as product features, data structures, and cloud services evolve."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 pb-16 pt-24 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Privacy Policy</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Rocketry House collects the minimum information needed to provide accounts, profiles, community posts,
          project uploads, cloud sync, and engineering collaboration features.
        </p>
        <p className="mt-3 text-sm text-slate-500">Effective date: June 8, 2026</p>

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
