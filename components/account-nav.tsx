"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
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
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button asChild href="/auth/sign-in" size="sm" variant="outline">
          <span className="text-xs sm:text-sm">Sign in</span>
        </Button>
        <Button asChild href="/auth/sign-up" size="sm">
          <span className="text-xs sm:text-sm">Sign up</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      <Button asChild href="/profile" size="sm">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-orange-200 text-[10px] font-bold text-slate-950">{user.name[0] ?? "A"}</span>
        )}
        <span className="hidden sm:inline">Account</span>
      </Button>
      <button aria-label="Sign out" onClick={clearMockUser} className="rounded-md p-2 text-orange-50/70 hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
