"use client";

import { useEffect, useState } from "react";
import { Download, PackageOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PURCHASE_STORAGE_KEY, type StoredPurchase } from "@/components/checkout-button";
import { loadPersistentRecords } from "@/lib/cloud-persistence";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<StoredPurchase[]>([]);

  useEffect(() => {
    async function syncPurchases() {
      try {
        const cloudRecords = await loadPersistentRecords<StoredPurchase>("purchases");
        const cloudPurchases = cloudRecords.map((record) => record.payload);
      const stored = JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY) ?? "[]") as StoredPurchase[];
        const merged = [
          ...cloudPurchases,
          ...stored.filter((purchase) => !cloudPurchases.some((cloudPurchase) => cloudPurchase.projectSlug === purchase.projectSlug))
        ];
      if (merged.length) {
          localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(merged));
          setPurchases(merged);
        return;
      }
      } catch {
      setPurchases([]);
    }
    }
    void syncPurchases();
  }, []);

  return (
    <main className="min-h-screen bg-space-radial px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-semibold">Purchases and downloads</h1>
        <p className="mt-3 text-orange-50/62">Completed checkout records appear here for the signed-in browser session.</p>
        {purchases.length ? (
          <div className="mt-8 space-y-3">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{purchase.title}</p>
                  <p className="text-sm text-orange-50/58">{purchase.files.length} files available / forking unlocked / {new Date(purchase.purchasedAt).toLocaleDateString()}</p>
                </div>
                <Download className="h-5 w-5 shrink-0 text-orange-200" />
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-8 p-8 text-center">
            <PackageOpen className="mx-auto h-8 w-8 text-orange-200" />
            <p className="mt-3 font-semibold">No purchases yet</p>
            <p className="mt-2 text-sm text-orange-50/58">Buy a marketplace project to unlock downloads and fork permissions.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
