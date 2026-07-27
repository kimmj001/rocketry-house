import { ExploreProjectBrowser } from "@/components/explore-project-browser";
import { loadPublicProjectArchive } from "@/lib/public-projects";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const { projects, error } = await loadPublicProjectArchive();

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-6 py-24 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <ExploreProjectBrowser initialProjects={projects} initialLoadError={error} />
      </div>
    </main>
  );
}
