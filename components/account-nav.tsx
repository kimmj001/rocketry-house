"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearMockUser, readMockUser, type AuthUser } from "@/lib/auth";

export function AccountNav() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(readMockUser());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rocketry-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rocketry-auth-change", sync);
    };
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild href="/auth/sign-in" size="sm" variant="outline">Sign in</Button>
        <Button asChild href="/auth/sign-up" size="sm">Sign up</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild href="/profile" size="sm"><UserRound className="h-4 w-4" />Account</Button>
      <button aria-label="Sign out" onClick={clearMockUser} className="rounded-md p-2 text-orange-50/70 hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
