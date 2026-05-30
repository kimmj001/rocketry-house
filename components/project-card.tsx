import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, Download, GitFork, Star } from "lucide-react";
import { PriceTag, VerificationBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
import type { RocketProject } from "@/lib/types";

export function ProjectCard({ project }: { project: RocketProject }) {
  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-white/24 bg-[#344052]/95 shadow-2xl shadow-black/18 ring-1 ring-white/[0.06] transition hover:-translate-y-1 hover:border-orange-200/55 hover:bg-[#3a4659] hover:shadow-orange-950/10">
        <div className="relative m-3 aspect-[16/10] overflow-hidden rounded-md border border-white/16 bg-[#202b3a] shadow-inner shadow-black/20">
          <Image src={project.image} alt={project.title} fill className="object-contain p-3 transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-4 px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold leading-tight">{project.title}</h3>
              <p className="mt-1 text-sm text-orange-50/62">by {project.creator}</p>
            </div>
            <PriceTag cents={project.priceCents} />
          </div>
          <VerificationBadge status={project.verificationStatus} />
          <div className="flex flex-wrap gap-2 text-[11px] text-orange-50/68">
            {project.publicReference && <span className="inline-flex items-center gap-1 rounded-full bg-orange-300/10 px-2 py-1 text-orange-100"><BookOpen className="h-3 w-3" />public reference</span>}
            {project.hasThrustData && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300/10 px-2 py-1"><Activity className="h-3 w-3" />thrust curve</span>}
            {project.hasTelemetry && <span className="rounded-full bg-white/[0.06] px-2 py-1">raw telemetry</span>}
            {project.hasFlightLog && <span className="rounded-full bg-white/[0.06] px-2 py-1">test log</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-orange-50/70">
            <span>{project.difficulty}</span><span>{project.motorClass}</span>
            <span>{project.predictedAltitudeM} m est.</span><span>{project.actualAltitudeM ? `${project.actualAltitudeM} m flown` : "No flown altitude"}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-orange-50/62">
            <span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{project.forkCount}</span>
            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{project.downloadCount}</span>
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{project.creatorRating}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
