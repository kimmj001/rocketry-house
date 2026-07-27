import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/70 bg-[#f5f4f0] px-4 py-8 text-slate-600 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">Rocketry House</p>
          <p className="mt-1">For educational and lawful rocketry collaboration.</p>
          <p className="mt-1">Contact: rocketryhouse@gmail.com</p>
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy" className="font-medium hover:text-orange-600">
            Privacy Policy
          </Link>
          <Link href="/community" className="font-medium hover:text-orange-600">
            Community
          </Link>
          <Link href="/messages" className="font-medium hover:text-orange-600">
            Messages
          </Link>
          <Link href="/upload" className="font-medium hover:text-orange-600">
            Upload
          </Link>
          <Link href="/pricing" className="font-medium hover:text-orange-600">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
