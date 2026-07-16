"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAssets } from "@/lib/api";
import type { DatabankAssetRecord } from "@/lib/types";

const IDLE_POLL_MS = 5000;
/** Poll harder while extraction is in flight so status feels live. */
const ACTIVE_POLL_MS = 2000;

function isInFlight(assets: DatabankAssetRecord[]): boolean {
  return assets.some((a) => a.status === "UPLOADED" || a.status === "PROCESSING");
}

/**
 * Live view of the databank. Reloads on mount, on a poll, and on the shared
 * "nexusflow:refresh-stats" event.
 *
 * The poll interval adapts: extraction takes ~15s server-side, so while any
 * asset is still working we check every 2s, then back off to 5s once
 * everything has settled.
 */
export function useAssets() {
  const [assets, setAssets] = useState<DatabankAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    const data = await fetchAssets();
    setAssets(data);
    inFlightRef.current = isInFlight(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;
      await reload();
      if (cancelled) return;
      timer = setTimeout(tick, inFlightRef.current ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    }

    tick();
    window.addEventListener("nexusflow:refresh-stats", reload);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("nexusflow:refresh-stats", reload);
    };
  }, [reload]);

  return { assets, loading, reload };
}
