import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock-data";

export default function PurchasesPage() {
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-semibold">Purchases and downloads</h1>
        <div className="mt-8 space-y-3">{mockProjects.slice(1, 5).map((project) => <Card key={project.id} className="flex items-center justify-between p-4"><div><p className="font-medium">{project.title}</p><p className="text-sm text-orange-50/58">{project.files.length} files available · forking unlocked</p></div><Download className="h-5 w-5 text-orange-200" /></Card>)}</div>
      </div>
    </main>
  );
}
