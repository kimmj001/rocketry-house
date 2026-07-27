import { notFound, redirect } from "next/navigation";
import { ForkTree } from "@/components/fork-tree";
import { ProjectTabs } from "@/components/project-tabs";
import { mockProjects } from "@/lib/mock-data";
import { loadPublicProjectArchive } from "@/lib/public-projects";
import { bySlug, canonicalSlug } from "@/lib/utils";

export default async function ForkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/forks/${canonicalSlug(slug)}`);
  const publicArchive = await loadPublicProjectArchive();
  const publicProjects = publicArchive.projects;
  const project = bySlug(mockProjects, slug) ?? bySlug(publicProjects, slug);
  if (!project) notFound();
  const forks = [
    ...mockProjects,
    ...publicProjects.filter((item) => !mockProjects.some((projectItem) => projectItem.slug === item.slug))
  ].filter((item) => item.originalProjectId === project.id);
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <ProjectTabs slug={project.slug} active="forks" />
        <div className="mt-8"><ForkTree project={project} forks={forks} /></div>
      </div>
    </main>
  );
}
