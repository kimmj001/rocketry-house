import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { BookOpen, ExternalLink, MessageSquare, ShoppingCart, Upload } from "lucide-react";
import { ProjectTabs } from "@/components/project-tabs";
import { VerificationBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TelemetryChart } from "@/components/charts";
import { RawDataPreview } from "@/components/raw-data-preview";
import { discussions, mockProjects } from "@/lib/mock-data";
import { bySlug, canonicalSlug, formatPrice } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/projects/${canonicalSlug(slug)}`);
  const project = bySlug(mockProjects, slug);
  if (!project) notFound();
  const originalProject = project.originalProjectId ? mockProjects.find((candidate) => candidate.id === project.originalProjectId) : undefined;
  const projectDiscussions = discussions.filter((discussion) => discussion.projectId === project.id);
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <ProjectTabs slug={project.slug} active="overview" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <VerificationBadge status={project.verificationStatus} />
            <h1 className="mt-4 text-4xl font-semibold">{project.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-orange-50/70">{project.description}</p>
            {project.publicReference && (
              <a href={project.publicReference.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-orange-300/10 px-3 py-2 text-sm text-orange-100 hover:bg-orange-300/15">
                <BookOpen className="h-4 w-4" />
                Public source: {project.publicReference.name}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {originalProject && <p className="mt-3 text-sm text-cyan-100">Based on {originalProject.title}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <Stat label="Price" value={formatPrice(project.priceCents)} />
              <Stat label="Difficulty" value={project.difficulty} />
              <Stat label="Motor" value={project.motorClass} />
              <Stat label="Forks" value={String(project.forkCount)} />
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <Card className="p-5"><h2 className="font-semibold">Files</h2><div className="mt-3 space-y-2">{project.files.map((file) => <p key={file} className="rounded-md bg-white/[0.04] px-3 py-2 text-sm text-orange-50/70">{file}</p>)}</div></Card>
              <Card className="p-5"><h2 className="font-semibold">Verification</h2><p className="mt-3 text-sm text-orange-50/68">Flight claimed requires image or video proof. Optional evidence includes altimeter data, thrust stand data, and telemetry logs.</p><div className="mt-4"><VerificationBadge status={project.verificationStatus} /></div></Card>
            </div>
            <div className="mt-8"><TelemetryChart data={project.telemetry.points} /></div>
            <div className="mt-5"><RawDataPreview /></div>
          </div>
          <aside className="space-y-5">
            <div className="relative aspect-[16/11] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"><Image src={project.image} alt={project.title} fill className="object-contain p-4" /></div>
            <Card className="p-5">
              <h2 className="font-semibold">Project marketplace</h2>
              <p className="mt-2 text-sm text-orange-50/65">Purchase unlocks project files, evidence packages, and fork permissions. Platform commission is 5%.</p>
              <div className="mt-4 flex gap-2"><Button asChild href={`/checkout/${project.slug}`}><ShoppingCart className="h-4 w-4" />Checkout</Button><Button asChild href={`/forks/${project.slug}`} variant="outline">Fork tree</Button></div>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5 text-cyan-200" />Project discussions</h2>
              <div className="mt-4 space-y-3">{projectDiscussions.length ? projectDiscussions.map((discussion) => <p key={discussion.id} className="rounded-md bg-white/[0.04] p-3 text-sm"><span className="text-orange-200">{discussion.type}</span><br />{discussion.title}</p>) : <p className="text-sm text-orange-50/62">No discussions yet.</p>}</div>
            </Card>
            <Card className="p-5"><h2 className="flex items-center gap-2 font-semibold"><Upload className="h-5 w-5 text-orange-200" />Report and moderation</h2><p className="mt-3 text-sm text-orange-50/64">Report projects or files for admin review, policy checks, and restricted-content handling.</p></Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-orange-50/55">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
