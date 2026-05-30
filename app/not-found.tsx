import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-space-radial px-6 pt-32 text-center">
      <p className="text-sm uppercase tracking-[0.24em] text-orange-200">Lost signal</p>
      <h1 className="mt-4 text-4xl font-semibold">That project path is beyond range.</h1>
      <Button asChild className="mt-8">
        <Link href="/marketplace">Return to marketplace</Link>
      </Button>
    </main>
  );
}
