import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

const reports = ["Project flagged for unsafe payload language", "File awaiting STEP malware scan", "Banned content tag review: targeting", "Telemetry claim missing media proof"];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <ShieldCheck className="h-9 w-9 text-orange-300" />
        <h1 className="mt-4 text-4xl font-semibold">Admin moderation queue</h1>
        <p className="mt-3 text-orange-50/68">Review reports, files, status, and banned content tags for educational and lawful rocketry use.</p>
        <div className="mt-8 space-y-3">{reports.map((report, index) => <Card key={report} className="p-4"><p className="font-medium">{report}</p><p className="mt-1 text-sm text-orange-50/58">Status: {index % 2 ? "queued" : "needs reviewer"}</p></Card>)}</div>
      </div>
    </main>
  );
}
