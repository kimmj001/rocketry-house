"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Gauge, Search, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadPersistentRecords, PUBLIC_PROJECTS_OWNER_KEY, type CloudRecord } from "@/lib/cloud-persistence";
import { archivedProjectToRocketProject } from "@/lib/project-archive";
import type { RocketProject } from "@/lib/types";

const categories = ["All", "Performance", "Evidence", "CAD", "Safety", "Writeups"];
const filterGroups = [
  ["Evidence", ["Verified", "Flight verified", "Static fire", "Has CAD", "Telemetry", "Motor data"]],
  ["Use case", ["Open source", "Privacy scoped"]],
  ["Class", ["High Power"]]
] as const;
const sortOptions = ["Most detailed", "Highest altitude", "Strongest evidence", "Newest"] as const;

export function ExploreProjectBrowser({ initialProjects, initialLoadError }: { initialProjects: RocketProject[]; initialLoadError: string | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]>("Most detailed");
  const [publicProjects, setPublicProjects] = useState<RocketProject[]>(initialProjects);
  const [loading, setLoading] = useState(!initialProjects.length && !initialLoadError);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);

  useEffect(() => {
    let mounted = true;

    async function refreshPublicProjects() {
      if (!initialProjects.length) setLoading(true);
      setLoadError(null);
      try {
        const records = await loadPersistentRecords("projects", { ownerKey: PUBLIC_PROJECTS_OWNER_KEY });
        if (!mounted) return;
        setPublicProjects(
          (records as CloudRecord<Parameters<typeof archivedProjectToRocketProject>[0]["payload"]>[])
            .map((record, index) => archivedProjectToRocketProject(record, index))
        );
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Could not load public projects.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void refreshPublicProjects();
    return () => {
      mounted = false;
    };
  }, [initialProjects.length]);

  const projects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = publicProjects.filter((project) => {
      const searchable = [
        project.title,
        project.creator,
        project.description,
        project.motorClass,
        project.difficulty,
        project.verificationStatus,
        project.source,
        project.visibility,
        project.scaffoldNotice,
        project.summary?.propellantFamily,
        project.accessPolicy?.usageRights,
        project.accessPolicy?.forkPolicy,
        JSON.stringify(project.evidence ?? {}),
        JSON.stringify(project.moderation ?? {}),
        project.files.join(" "),
        (project.uploadedFiles ?? []).map((file) => `${file.name} ${file.contentType ?? ""}`).join(" "),
        ...project.tags
      ].join(" ").toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (category === "Performance" && !project.predictedAltitudeM && !project.actualAltitudeM && !project.hasThrustData) return false;
      if (category === "Evidence" && !evidenceCount(project) && !project.publicReference && !project.files.length) return false;
      if (category === "CAD" && !project.hasWebCad && !project.components.length) return false;
      if (category === "Safety" && !hasSafetyDisclosure(project)) return false;
      if (category === "Writeups" && !project.publicReference && !project.source && !project.files.length) return false;

      return activeFilters.every((filter) => {
        if (filter === "Verified") return project.verificationStatus !== "Unverified" && project.verificationStatus !== "Design uploaded";
        if (filter === "Flight verified") return project.verificationStatus === "Flight verified" || project.verifiedFlight;
        if (filter === "Static fire") return project.verificationStatus === "Static fire data";
        if (filter === "Has CAD") return project.hasWebCad;
        if (filter === "Telemetry") return project.hasTelemetry || project.hasFlightLog;
        if (filter === "Motor data") return project.hasThrustData;
        if (filter === "Open source") return Boolean(project.publicReference);
        if (filter === "Privacy scoped") return hasSafetyDisclosure(project);
        if (filter === "High Power") return project.difficulty === "High Power";
        return true;
      });
    });

    return filtered.sort((a, b) => {
      if (sortBy === "Highest altitude") return altitudeFor(b) - altitudeFor(a);
      if (sortBy === "Strongest evidence") return evidenceScore(b) - evidenceScore(a);
      if (sortBy === "Newest") return dateScore(b) - dateScore(a);
      return detailScore(b) - detailScore(a);
    });
  }, [activeFilters, category, publicProjects, query, sortBy]);

  function toggleFilter(filter: string) {
    setActiveFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Explore</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold">Inspect reusable rocket evidence, not just listings</h1>
            <p className="mt-4 max-w-3xl text-slate-600">Compare performance claims, inspect source evidence, audit CAD assumptions, and find projects worth forking or reviewing.</p>
          </div>
          <Button href="/upload" asChild>Publish project</Button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400" placeholder="Search evidence, files, teams, motor classes, safety notes..." />
            </label>
            <Button variant="outline" onClick={() => setAdvancedOpen((value) => !value)}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
            <Button variant="outline" onClick={() => { setQuery(""); setCategory("All"); setActiveFilters([]); setSortBy("Most detailed"); }}>Reset</Button>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`rounded-lg px-3 py-2 text-sm transition ${item === category ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((item) => (
                <button key={item} onClick={() => setSortBy(item)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${item === sortBy ? "bg-orange-100 text-orange-800" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                  <Gauge className="h-3.5 w-3.5" />
                  {item}
                </button>
              ))}
            </div>
          </div>
          {advancedOpen ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
              {filterGroups.map(([group, filters]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{group}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {filters.map((filter) => (
                      <button key={filter} onClick={() => toggleFilter(filter)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${activeFilters.includes(filter) ? "border-orange-300 bg-orange-100 text-orange-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                        <Filter className="h-3.5 w-3.5" />
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-600">
        {loading ? "Loading public project archive..." : `${projects.length} public projects match the current view.`}
      </p>
      {loadError ? <Card className="mt-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{loadError}</Card> : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <Card key={index} className="h-80 animate-pulse border-slate-200 bg-white p-4">
                <div className="h-40 rounded-lg bg-slate-100" />
                <div className="mt-5 h-5 w-3/4 rounded bg-slate-100" />
                <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
                <div className="mt-8 h-20 rounded bg-slate-100" />
              </Card>
            ))
          : projects.map((project) => <ProjectCard key={project.slug} project={project} />)}
      </div>
      {!loading && !projects.length ? <Card className="mt-8 border-slate-200 bg-white p-8 text-center text-slate-600">No public projects match this view. Try clearing filters or publish a project package.</Card> : null}
    </>
  );
}

function evidenceCount(project: RocketProject) {
  return Object.keys(project.evidence ?? {}).length;
}

function evidenceScore(project: RocketProject) {
  return evidenceCount(project) * 8 +
    (project.publicReference ? 18 : 0) +
    (project.hasTelemetry ? 14 : 0) +
    (project.hasThrustData ? 14 : 0) +
    (project.hasFlightLog ? 10 : 0) +
    (project.uploadedFiles?.length ?? project.files.length) * 3;
}

function detailScore(project: RocketProject) {
  return evidenceScore(project) +
    project.components.length * 2 +
    project.telemetry.points.length +
    (project.summary ? 12 : 0) +
    (project.moderation ? 8 : 0);
}

function altitudeFor(project: RocketProject) {
  return project.actualAltitudeM ?? project.predictedAltitudeM ?? 0;
}

function dateScore(project: RocketProject) {
  const timestamp = Date.parse(project.publishedAt ?? project.uploadedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasSafetyDisclosure(project: RocketProject) {
  const disclosureText = JSON.stringify({
    moderation: project.moderation,
    evidence: project.evidence,
    tags: project.tags,
    scaffoldNotice: project.scaffoldNotice
  });
  return /safety|privacy|restricted|redact|omit|moderation|scope/i.test(disclosureText);
}
