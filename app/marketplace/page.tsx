import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { mockProjects } from "@/lib/mock-data";

const categories = ["All", "Rockets", "Motors", "Telemetry", "Writeups"];
const filters = ["Free", "Paid", "Verified", "Has CAD", "Telemetry", "Motor data", "High Power"];

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/60">Explore</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold">Find rockets, motors, and flight data</h1>
            <p className="mt-4 max-w-2xl text-orange-50/62">Browse public engineering projects with CAD, simulations, telemetry, files, and fork lineage.</p>
          </div>
          <Button href="/upload" asChild variant="outline">Publish project</Button>
        </div>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-md border border-white/10 bg-[#090d17] px-4">
              <Search className="h-4 w-4 shrink-0 text-cyan-100/60" />
              <input className="w-full bg-transparent text-sm text-orange-50 outline-none placeholder:text-orange-50/35" placeholder="Search projects, teams, motor classes, telemetry..." />
            </label>
            <Button variant="outline"><SlidersHorizontal className="h-4 w-4" />Filters</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <button key={category} className={`rounded-md px-3 py-2 text-sm transition ${index === 0 ? "bg-orange-300 text-[#130d08]" : "bg-white/[0.05] text-orange-50/70 hover:bg-white/10"}`}>
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button key={filter} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-orange-50/70 hover:bg-white/10">
              <Filter className="h-3.5 w-3.5" />
              {filter}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {mockProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      </div>
    </main>
  );
}
