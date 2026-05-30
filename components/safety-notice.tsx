import { ShieldAlert } from "lucide-react";
import { safetyPolicies } from "@/lib/mock-data";

export function SafetyNotice() {
  return (
    <section className="border-y border-white/10 bg-[#14131d] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 text-orange-100"><ShieldAlert className="h-5 w-5 text-orange-300" /><h2 className="font-semibold">Safety and lawful use</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {safetyPolicies.map((policy) => <p key={policy} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-orange-50/78">{policy}</p>)}
        </div>
      </div>
    </section>
  );
}
