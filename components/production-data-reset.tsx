"use client";

import { useEffect } from "react";

const PUBLIC_LAUNCH_RESET_KEY = "rocketry-house.public-launch-reset.2026-06-08";

function isRocketryHouseTestKey(key: string) {
  return (
    key.startsWith("rocketry-house.") ||
    key.startsWith("rocketry-house-") ||
    key.startsWith("rocketry-house:")
  );
}

export function ProductionDataReset() {
  useEffect(() => {
    if (localStorage.getItem(PUBLIC_LAUNCH_RESET_KEY) === "done") return;

    for (const key of Object.keys(localStorage)) {
      if (key !== PUBLIC_LAUNCH_RESET_KEY && isRocketryHouseTestKey(key)) {
        localStorage.removeItem(key);
      }
    }

    sessionStorage.clear();
    localStorage.setItem(PUBLIC_LAUNCH_RESET_KEY, "done");
    window.dispatchEvent(new Event("rocketry-auth-change"));
  }, []);

  return null;
}
