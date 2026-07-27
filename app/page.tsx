import { HomePreviewSections } from "@/components/home-preview-sections";
import { QuoteHero } from "@/components/quote-hero";
import { loadPublicProjectArchive } from "@/lib/public-projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { projects } = await loadPublicProjectArchive(3);

  return (
    <main>
      <QuoteHero />
      <HomePreviewSections initialProjects={projects} />
    </main>
  );
}
