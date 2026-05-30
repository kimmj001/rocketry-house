"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CheckoutButton() {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-6">
      <Button onClick={() => setDone(true)} className="w-full"><CreditCard className="h-4 w-4" />Complete checkout</Button>
      {done && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" />Purchase recorded. Downloads and fork permissions are unlocked.</p>}
    </div>
  );
}
