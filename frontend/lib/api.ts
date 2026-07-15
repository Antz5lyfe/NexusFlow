/**
 * Typed API client for the NexusFlow FastAPI backend.
 *
 * All paths are prefixed with /api/backend which next.config.ts rewrites
 * to http://localhost:8000/api/v1 — zero CORS issues in dev.
 */

import type {
  AgentRecord,
  CostLogRecord,
  WorkflowApproveRequest,
  WorkflowApproveResponse,
  WorkflowExecuteRequest,
  WorkflowExecuteResponse,
  WorkflowRunRecord,
} from "./types";

const BASE = "/api/backend";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Workflow endpoints ────────────────────────────────────────────────

export async function executeWorkflow(
  payload: WorkflowExecuteRequest
): Promise<WorkflowExecuteResponse> {
  return request<WorkflowExecuteResponse>("/execute-workflow", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveWorkflow(
  threadId: string,
  payload: WorkflowApproveRequest
): Promise<WorkflowApproveResponse> {
  return request<WorkflowApproveResponse>(
    `/workflows/${threadId}/approve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ── Analytics endpoints ───────────────────────────────────────────────

export async function fetchAgents(): Promise<AgentRecord[]> {
  try {
    return await request<AgentRecord[]>("/agents");
  } catch {
    return [];
  }
}

export async function fetchCostLogs(): Promise<CostLogRecord[]> {
  try {
    return await request<CostLogRecord[]>("/cost-logs");
  } catch {
    return [];
  }
}

export async function fetchWorkflows(): Promise<WorkflowRunRecord[]> {
  try {
    return await request<WorkflowRunRecord[]>("/workflows");
  } catch {
    return [];
  }
}

