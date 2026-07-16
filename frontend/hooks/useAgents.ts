"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAgents } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;

/**
 * Live view of the agent registry in PostgreSQL.
 *
 * Reloads on mount, on a poll, and whenever "nexusflow:refresh-stats" fires —
 * DeployAgentModal dispatches that event after a successful create, so every
 * screen built on this hook picks up a new agent without a browser refresh.
 */
export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await fetchAgents();
    setAgents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, POLL_INTERVAL_MS);
    window.addEventListener("nexusflow:refresh-stats", reload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nexusflow:refresh-stats", reload);
    };
  }, [reload]);

  return { agents, loading, reload };
}

/** Look up a single registered agent by exact name — used by the core-node cards. */
export function useAgentByName(name: string) {
  const { agents, loading, reload } = useAgents();
  return { agent: agents.find((a) => a.name === name) ?? null, loading, reload };
}
