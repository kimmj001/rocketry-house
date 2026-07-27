import { notFound, redirect } from "next/navigation";
import { CADEditor } from "@/components/cad-editor";
import { ProjectTabs } from "@/components/project-tabs";
import { mockProjects } from "@/lib/mock-data";
import { loadPublicProjectBySlug } from "@/lib/public-projects";
import { bySlug, canonicalSlug } from "@/lib/utils";

export default async function CadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/cad/${canonicalSlug(slug)}`);
  const project = bySlug(mockProjects, slug) ?? await loadPublicProjectBySlug(slug);
  if (!project) notFound();
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <ProjectTabs slug={project.slug} active="cad" />
        <div className="mb-6 mt-8"><p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">Web CAD</p><h1 className="mt-2 text-4xl font-semibold">{project.title}</h1></div>
        <CADEditor project={project} />
      </div>
    </main>
  );
}
