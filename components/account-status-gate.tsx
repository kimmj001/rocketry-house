"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AccountStatusGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/account-status/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Password did not match.");
      return;
    }

    setPassword("");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-space-radial px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-md">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-orange-200 text-slate-950">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-100/62">Restricted</p>
              <h1 className="text-2xl font-semibold">Account status</h1>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submitPassword}>
            <label className="block text-sm font-medium text-orange-50/72">
              Management password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className="mt-2 h-11 w-full rounded-md border border-white/12 bg-white/5 px-3 text-orange-50 outline-none placeholder:text-orange-50/30 focus:border-orange-300"
                placeholder="Enter password"
              />
            </label>

            {error ? <p className="text-sm text-red-200">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !password.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Unlock
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
