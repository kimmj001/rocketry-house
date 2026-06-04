"use client";

import { useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockProjects } from "@/lib/mock-data";

const categories = ["All", "Rockets", "Motors", "Telemetry", "Writeups"];
const filterGroups = [
  ["Access", ["Free", "Paid"]],
  ["Evidence", ["Verified", "Has CAD", "Telemetry", "Motor data"]],
  ["Class", ["High Power"]]
] as const;

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const projects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mockProjects.filter((project) => {
      const text = [
        project.title,
        project.creator,
        project.difficulty,
        project.motorClass,
        project.verificationStatus,
        project.publicReference?.name,
        ...project.tags,
        ...project.files
      ].join(" ").toLowerCase();
      const categoryMatch =
        category === "All" ||
        (category === "Rockets" && !project.tags.some((tag) => tag.includes("static-fire") || tag.includes("motor"))) ||
        (category === "Motors" && project.tags.some((tag) => tag.includes("motor") || tag.includes("static-fire") || tag.includes("thrust"))) ||
        (category === "Telemetry" && (project.tags.some((tag) => tag.includes("telemetry") || tag.includes("flight")) || Boolean(project.actualAltitudeM))) ||
        (category === "Writeups" && project.tags.some((tag) => tag.includes("analysis") || tag.includes("archive") || tag.includes("study")));

      const filterMatch = activeFilters.every((filter) => {
        if (filter === "Free") return project.priceCents === 0;
        if (filter === "Paid") return project.priceCents > 0;
        if (filter === "Verified") return project.verificationStatus.toLowerCase().includes("verified") || project.verificationStatus.toLowerCase().includes("proof");
        if (filter === "Has CAD") return project.files.some((file) => /cad|step|stl|json|ork/i.test(file));
        if (filter === "Telemetry") return project.files.some((file) => /telemetry|csv|flight/i.test(file));
        if (filter === "Motor data") return project.files.some((file) => /thrust|motor|eng|rse/i.test(file)) || project.motorClass.toLowerCase().includes("motor");
        if (filter === "High Power") return project.difficulty === "High Power";
        return true;
      });

      return categoryMatch && filterMatch && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [activeFilters, category, query]);

  function toggleFilter(filter: string) {
    setActiveFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-6 py-24 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Explore</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold">Find rockets, motors, and flight data</h1>
            <p className="mt-4 max-w-2xl text-slate-600">Browse project repositories with CAD, simulations, telemetry, files, and fork lineage.</p>
          </div>
          <Button href="/upload" asChild>Publish project</Button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400" placeholder="Search projects, teams, motor classes, telemetry..." />
            </label>
            <Button variant="outline" onClick={() => setAdvancedOpen((value) => !value)}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
            <Button variant="outline" onClick={() => { setQuery(""); setCategory("All"); setActiveFilters([]); }}>Reset</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`rounded-lg px-3 py-2 text-sm transition ${item === category ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                {item}
              </button>
            ))}
          </div>
          {advancedOpen ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
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

        <p className="mt-5 text-sm text-slate-600">{projects.length} projects match the current view.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
        {!projects.length ? <Card className="mt-8 border-slate-200 bg-white p-8 text-center text-slate-600">No projects match this search. Clear filters or publish a new project package.</Card> : null}
      </div>
    </main>
  );
}
