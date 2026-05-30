"use client";

import { create } from "zustand";
import type { RocketComponent } from "@/lib/types";

type CadState = {
  components: RocketComponent[];
  selectedId?: string;
  versionName: string;
  setComponents: (components: RocketComponent[]) => void;
  select: (id: string) => void;
  updateComponent: (id: string, patch: Partial<RocketComponent>) => void;
  reorder: (id: string, direction: -1 | 1) => void;
  saveVersion: (name: string) => void;
};

export const useCadStore = create<CadState>((set) => ({
  components: [],
  versionName: "working draft",
  setComponents: (components) => set({ components, selectedId: components[0]?.id }),
  select: (id) => set({ selectedId: id }),
  updateComponent: (id, patch) =>
    set((state) => ({
      components: state.components.map((component) => (component.id === id ? { ...component, ...patch } : component))
    })),
  reorder: (id, direction) =>
    set((state) => {
      const components = [...state.components];
      const index = components.findIndex((component) => component.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= components.length) return state;
      [components[index], components[target]] = [components[target], components[index]];
      return { components };
    }),
  saveVersion: (name) => set({ versionName: name || "saved design version" })
}));
