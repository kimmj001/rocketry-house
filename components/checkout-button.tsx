"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RocketProject } from "@/lib/types";
import { savePersistentRecord } from "@/lib/cloud-persistence";

export type StoredPurchase = {
  id: string;
  projectSlug: string;
  title: string;
  priceCents: number;
  files: string[];
  purchasedAt: string;
};

export const PURCHASE_STORAGE_KEY = "rocketry-house.purchases";

export function CheckoutButton({ project }: { project: RocketProject }) {
  const [done, setDone] = useState(false);
  function completeCheckout() {
    const purchase: StoredPurchase = {
      id: `purchase-${Date.now()}`,
      projectSlug: project.slug,
      title: project.title,
      priceCents: project.priceCents,
      files: project.files,
      purchasedAt: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY) ?? "[]") as StoredPurchase[];
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify([purchase, ...existing.filter((item) => item.projectSlug !== project.slug)]));
    void savePersistentRecord("purchases", purchase.projectSlug, purchase);
    setDone(true);
  }
  return (
    <div className="mt-6">
      <Button onClick={completeCheckout} className="w-full"><CreditCard className="h-4 w-4" />Complete checkout</Button>
      {done && <p className="mt-4 flex items-center gap-2 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" />Purchase recorded. Downloads and fork permissions are unlocked.</p>}
    </div>
  );
}
