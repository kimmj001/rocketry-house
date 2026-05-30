import { notFound, redirect } from "next/navigation";
import { ProjectTabs } from "@/components/project-tabs";
import { SimulationPanel } from "@/components/simulation-panel";
import { mockProjects } from "@/lib/mock-data";
import { bySlug, canonicalSlug } from "@/lib/utils";

export default async function SimulationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/simulation/${canonicalSlug(slug)}`);
  const project = bySlug(mockProjects, slug);
  if (!project) notFound();
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <ProjectTabs slug={project.slug} active="simulation" />
        <div className="mt-8"><SimulationPanel project={project} /></div>
      </div>
    </main>
  );
}
