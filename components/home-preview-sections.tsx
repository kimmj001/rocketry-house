"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageSquareText, Rocket, Search, UsersRound } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadCommunityPostsArchive } from "@/lib/community-archive";
import type { CommunityPost } from "@/lib/community-data";
import { loadPersistentRecords, PUBLIC_PROJECTS_OWNER_KEY, type CloudRecord } from "@/lib/cloud-persistence";
import { archivedProjectToRocketProject } from "@/lib/project-archive";
import type { RocketProject } from "@/lib/types";

function EmptyPreview({
  icon,
  title,
  copy,
  href,
  action
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="flex min-h-[280px] flex-col items-center justify-center border-slate-200 bg-white p-8 text-center text-slate-950 shadow-sm">
      <div className="rounded-full bg-orange-50 p-4 text-orange-500">{icon}</div>
      <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{copy}</p>
      <Button href={href} asChild className="mt-6">
        {action}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function SectionHeader({
  eyebrow,
  title,
  copy,
  href
}: {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">{title}</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{copy}</p>
      </div>
      <Button href={href} asChild variant="outline" className="border-slate-300 bg-white text-slate-950 hover:bg-slate-100">
        More
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PostPreviewCard({ post }: { post: CommunityPost }) {
  const timeLabel = post.createdAt
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.createdAt))
    : post.time;

  return (
    <Link href={`/community/${post.slug}`} className="group block">
      <Card className="h-full border-slate-200 bg-white p-6 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{post.topic}</span>
          <span className="text-xs text-slate-400">{timeLabel}</span>
        </div>
        <h3 className="mt-4 line-clamp-2 text-xl font-semibold leading-tight">{post.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.preview}</p>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{post.author.name}</span>
          <span className="flex items-center gap-4">
            <span>{post.likes} likes</span>
            <span>{post.comments} replies</span>
          </span>
        </div>
      </Card>
    </Link>
  );
}

export function HomePreviewSections({ initialProjects = [] }: { initialProjects?: RocketProject[] }) {
  const [projects, setProjects] = useState<RocketProject[]>(initialProjects.slice(0, 3));
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(!initialProjects.length);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProjects() {
      if (!initialProjects.length) setLoadingProjects(true);
      try {
        const records = await loadPersistentRecords("projects", { ownerKey: PUBLIC_PROJECTS_OWNER_KEY });
        if (!mounted) return;
        setProjects(
          (records as CloudRecord<Parameters<typeof archivedProjectToRocketProject>[0]["payload"]>[])
            .map((record, index) => archivedProjectToRocketProject(record, index))
            .slice(0, 3)
        );
      } catch {
        if (mounted) setProjects([]);
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    }

    async function loadPosts() {
      setLoadingPosts(true);
      try {
        const archivedPosts = await loadCommunityPostsArchive();
        if (!mounted) return;
        setPosts(archivedPosts.slice(0, 4));
      } catch {
        if (mounted) setPosts([]);
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    }

    void loadProjects();
    void loadPosts();

    return () => {
      mounted = false;
    };
  }, [initialProjects.length]);

  const projectSkeletons = useMemo(() => Array.from({ length: 3 }, (_, index) => index), []);
  const postSkeletons = useMemo(() => Array.from({ length: 4 }, (_, index) => index), []);

  return (
    <>
      <section className="min-h-screen bg-[#f4f1ea] px-6 py-20 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col justify-center">
          <SectionHeader
            eyebrow="Explore"
            title="Public rocket projects, motor records, and flight evidence"
            copy="Browse public repositories with CAD metadata, motor context, telemetry, proof files, forks, and marketplace-ready project pages."
            href="/marketplace"
          />

          <div className="mt-10">
            {loadingProjects ? (
              <div className="grid gap-6 md:grid-cols-3">
                {projectSkeletons.map((item) => (
                  <Card key={item} className="h-[420px] animate-pulse border-slate-200 bg-white shadow-sm" />
                ))}
              </div>
            ) : projects.length ? (
              <div className="grid gap-6 md:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.slug} project={project} />
                ))}
              </div>
            ) : (
              <EmptyPreview
                icon={<Rocket className="h-7 w-7" />}
                title="No public projects yet"
                copy="The Explore preview will fill with real published projects only. Uploads, evidence, and rankings are not faked on the homepage."
                href="/upload"
                action="Publish the first project"
              />
            )}
          </div>
        </div>
      </section>

      <section className="min-h-screen bg-white px-6 py-20 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col justify-center">
          <SectionHeader
            eyebrow="Community"
            title="Real-name engineering discussion for builders and teams"
            copy="See current questions, build notes, flight results, CAD reviews, and safety discussions from the Rocketry House community."
            href="/community"
          />

          <div className="mt-10">
            {loadingPosts ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {postSkeletons.map((item) => (
                  <Card key={item} className="h-48 animate-pulse border-slate-200 bg-slate-50 shadow-sm" />
                ))}
              </div>
            ) : posts.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {posts.map((post) => (
                  <PostPreviewCard key={post.slug} post={post} />
                ))}
              </div>
            ) : (
              <EmptyPreview
                icon={<MessageSquareText className="h-7 w-7" />}
                title="No community posts yet"
                copy="Signed-in builders and teams can start public engineering discussions. The homepage will show the latest real posts here."
                href="/community"
                action="Open community"
              />
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Builder identity", "Profiles and posts use real names, roles, and team or organization context."],
              ["Project-first culture", "Discussion can reference projects, motor records, flight data, and design decisions."],
              ["Searchable archive", "Community posts become a long-term engineering archive for future builders."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <UsersRound className="h-5 w-5 text-orange-500" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
