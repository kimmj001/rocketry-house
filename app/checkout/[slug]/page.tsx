import { notFound, redirect } from "next/navigation";
import { CheckoutButton } from "@/components/checkout-button";
import { Card } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock-data";
import { bySlug, canonicalSlug, formatPrice } from "@/lib/utils";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (canonicalSlug(slug) !== slug) redirect(`/checkout/${canonicalSlug(slug)}`);
  const project = bySlug(mockProjects, slug);
  if (!project) notFound();
  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <Card className="mx-auto max-w-xl p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-orange-100/60">Secure checkout</p>
        <h1 className="mt-3 text-3xl font-semibold">{project.title}</h1>
        <p className="mt-3 text-orange-50/68">A completed purchase unlocks paid downloads, evidence packages, and forking permissions.</p>
        <div className="mt-6 rounded-lg bg-white/[0.05] p-4"><p className="text-sm text-orange-50/58">Total</p><p className="text-3xl font-semibold">{formatPrice(project.priceCents)}</p></div>
        <CheckoutButton project={project} />
      </Card>
    </main>
  );
}
