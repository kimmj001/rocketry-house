import type { Metadata } from "next";
import { RocketryHouseLogoReveal } from "@/components/rocketry-house-logo-reveal";

export const metadata: Metadata = {
  title: "rocketry.house logo reveal | Rocketry House",
  description: "Minimal animated rocketry.house logo reveal."
};

export default function LogoRevealPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 py-12">
      <section className="w-full max-w-[971px]" aria-label="Source logo reveal">
        <RocketryHouseLogoReveal mode="loop" />
      </section>
    </main>
  );
}
