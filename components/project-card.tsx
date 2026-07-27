import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, GitFork, ShieldCheck, Star } from "lucide-react";
import { VerificationBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

export function ProjectCard({ project }: { project: RocketProject }) {
  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-slate-200 bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/[0.03] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg">
        <div className="relative m-3 aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
          <Image src={project.image} alt={project.title} fill className="object-contain p-3 transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-4 px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold leading-tight">{project.title}</h3>
              <p className="mt-1 text-sm text-slate-500">by {project.creator}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Open reference</span>
          </div>
          <VerificationBadge status={project.verificationStatus} />
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            {project.publicReference && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-orange-700"><BookOpen className="h-3 w-3" />public reference</span>}
            {project.hasThrustData && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-cyan-700"><Activity className="h-3 w-3" />thrust curve</span>}
            {project.hasTelemetry && <span className="rounded-full bg-slate-100 px-2 py-1">raw telemetry</span>}
            {project.hasFlightLog && <span className="rounded-full bg-slate-100 px-2 py-1">test log</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <span>{project.difficulty}</span><span>{project.motorClass}</span>
            <span>{project.predictedAltitudeM} m est.</span><span>{project.actualAltitudeM ? `${project.actualAltitudeM} m flown` : "No flown altitude"}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{project.forkCount}</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{project.verifiedFlight ? "verified" : "reference"}</span>
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{project.creatorRating}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
