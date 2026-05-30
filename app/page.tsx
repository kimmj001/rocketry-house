import { ArrowRight, BookOpen, Building2, ChartSpline, FlaskConical, GitFork, RadioTower, Rocket, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectCard } from "@/components/project-card";
import { SafetyNotice } from "@/components/safety-notice";
import { QuoteHero } from "@/components/quote-hero";
import { mockProjects } from "@/lib/mock-data";
import { mockSavedMotors } from "@/lib/motor-library";
import { researchSections } from "@/lib/platform-content";

const platformSignals = [
  ["Motor design", "Internal ballistics estimates, thrust curves, pressure trends, and motor libraries.", FlaskConical],
  ["Rocket CAD", "Component-based web CAD with fins, recovery, avionics, airframes, and motor mounts.", Rocket],
  ["Flight simulation", "Point-mass ascent, drag, mass depletion, apogee, descent, and telemetry comparison.", ChartSpline],
  ["Project repositories", "Versioned projects with files, reviews, discussions, forks, releases, and marketplace logic.", GitFork]
] as const;

const launchSignals = [
  ["Nexo-style peroxide reference", "7.1 km archive", "flight dossier"],
  ["Scout-class TVC test", "telemetry attached", "control log"],
  ["University altitude attempt", "12.4 km simulated", "team project"]
] as const;

export default function Home() {
  return (
    <main>
      <QuoteHero />

      <section className="px-6 py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-cyan-100/62">The global operating system for amateur aerospace engineering</p>
            <h2 className="mt-3 max-w-4xl text-4xl font-semibold">Design. Simulate. Launch. Share.</h2>
            <p className="mt-4 max-w-3xl text-orange-50/70">
              Rocketry House combines motor analysis, rocket CAD, flight simulation, telemetry uploads, rankings, and project-first collaboration for serious experimental rocketry teams.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/build" asChild size="lg"><Rocket className="h-4 w-4" />Start Building</Button>
            <Button href="/motors" asChild size="lg" variant="outline"><FlaskConical className="h-4 w-4" />Explore Motors</Button>
            <Button href="/build/rocket" asChild size="lg" variant="outline"><ChartSpline className="h-4 w-4" />Open Rocket Builder</Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {platformSignals.map(([title, copy, Icon]) => (
              <Card key={title} className="p-5">
                <Icon className="h-6 w-6 text-cyan-200" />
                <h2 className="mt-5 font-semibold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-orange-50/62">{copy}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-100/60">Trending projects</p>
                <h2 className="mt-2 text-3xl font-semibold">Engineering repositories with evidence</h2>
              </div>
              <Button href="/marketplace" asChild variant="outline">Explore <ArrowRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {mockProjects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5 text-orange-200" />Community rankings</h2>
              <div className="mt-4 space-y-3 text-sm text-orange-50/70">
                {["Highest altitude", "Best simulation accuracy", "Most downloaded motor", "Top team / organization"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-md bg-white/[0.04] p-3">
                    <span>{item}</span>
                    <span className="text-orange-100">#{index + 1}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><FlaskConical className="h-5 w-5 text-cyan-200" />Top propulsion systems</h2>
              <div className="mt-4 space-y-3 text-sm text-orange-50/70">
                {mockSavedMotors.slice(0, 3).map((motor) => (
                  <div key={motor.id} className="rounded-md bg-white/[0.04] p-3">
                    <p className="font-medium">{motor.name}</p>
                    <p className="mt-1 text-orange-50/50">{motor.totalImpulseNs} N-s, {motor.burnTimeS}s burn, {motor.verificationStatus}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen className="h-6 w-6 text-cyan-200" />Publishable engineering evidence</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {researchSections.slice(0, 6).map(([title, copy]) => (
                <div key={title} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-orange-50/58">{copy}</p>
                </div>
              ))}
            </div>
            <Button href="/upload" asChild variant="outline" className="mt-5">Upload project evidence <ArrowRight className="h-4 w-4" /></Button>
          </Card>
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Building2 className="h-6 w-6 text-orange-200" />Top teams</h2>
            <div className="mt-5 space-y-3">
              {["Copenhagen Suborbitals Archive", "PSAS Open Aerospace", "TU Delft DARE", "MIT Rocket Team"].map((name) => (
                <div key={name} className="rounded-md bg-white/[0.04] p-3 text-sm">{name}</div>
              ))}
            </div>
            <Button href="/team" asChild variant="outline" className="mt-5 w-full">View teams</Button>
          </Card>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          {launchSignals.map(([title, metric, tag]) => (
            <Card key={title} className="p-5">
              <RadioTower className="h-6 w-6 text-cyan-200" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-orange-50/58">{metric}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-orange-100/45">{tag}</p>
            </Card>
          ))}
        </div>
      </section>

      <SafetyNotice />
      <section className="px-6 py-20 text-center">
        <h2 className="text-4xl font-semibold">Design. Simulate. Launch. Share.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-orange-50/68">A serious engineering platform for teams building lawful, educational, experimental aerospace projects.</p>
        <Button href="/build" asChild size="lg" className="mt-8">Enter Rocketry House</Button>
      </section>
    </main>
  );
}
