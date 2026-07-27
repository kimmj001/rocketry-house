import { GitFork } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

export function ForkTree({ project, forks }: { project: RocketProject; forks: RocketProject[] }) {
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <GitFork className="h-5 w-5 text-cyan-200" />
        Fork lineage
      </h2>
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-orange-300/35 bg-orange-300/10 p-4">
          <p className="font-semibold">{project.title}</p>
          <p className="text-sm text-orange-50/62">
            Original repository with attribution preserved for every public fork.
          </p>
        </div>
        <div className="ml-6 border-l border-white/15 pl-6">
          {forks.length ? (
            forks.map((fork) => (
              <div key={fork.id} className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="font-medium">{fork.title}</p>
                <p className="text-sm text-orange-50/60">
                  Based on {project.title}. Lineage and original creator credit remain attached.
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-orange-50/65">
              No forks yet. Public projects can be forked with attribution when the usage rights allow it.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
