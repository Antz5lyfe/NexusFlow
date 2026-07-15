"use client";

import { useState, useCallback, useRef } from "react";
import { approveWorkflow, executeWorkflow } from "@/lib/api";
import type {
  HitlContext,
  StepLogEntry,
  WorkflowApproveResponse,
  WorkflowExecuteResponse,
  FinalOutput,
  CostSummary,
} from "@/lib/types";

export type WorkflowPhase =
  | "idle"
  | "running"
  | "pending_approval"
  | "completed"
  | "rejected"
  | "failed";

export interface TerminalLine {
  id: string;
  text: string;
  type: "system" | "sales" | "finance" | "hitl" | "success" | "error";
  timestamp: string;
}

export interface WorkflowState {
  phase: WorkflowPhase;
  lines: TerminalLine[];
  hitlContext: HitlContext | null;
  threadId: string | null;
  finalOutput: FinalOutput | null;
  costSummary: CostSummary | null;
  error: string | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function now() {
  return new Date().toISOString();
}

function lineFromStep(entry: StepLogEntry): TerminalLine {
  const dept = entry.department?.toUpperCase() ?? "SYSTEM";
  const tag = dept === "SALES" ? "SALES_AGENT" : dept === "FINANCE" ? "FINANCE_AGENT" : dept;
  const type =
    dept === "SALES"
      ? "sales"
      : dept === "FINANCE"
      ? "finance"
      : entry.error
      ? "error"
      : "system";

  return {
    id: makeId(),
    text: `[${tag}] ${entry.output_summary}${entry.duration_ms ? ` (${entry.duration_ms.toFixed(0)} ms)` : ""}`,
    type,
    timestamp: entry.timestamp ?? now(),
  };
}

/** Replay an array of step-log entries with a delay to simulate streaming. */
async function replaySteps(
  steps: StepLogEntry[],
  push: (line: TerminalLine) => void,
  delayMs = 420
): Promise<void> {
  for (const step of steps) {
    await new Promise((r) => setTimeout(r, delayMs));
    push(lineFromStep(step));
  }
}

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>({
    phase: "idle",
    lines: [],
    hitlContext: null,
    threadId: null,
    finalOutput: null,
    costSummary: null,
    error: null,
  });

  const abortRef = useRef(false);

  const pushLine = useCallback((line: TerminalLine) => {
    setState((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
    setState({
      phase: "idle",
      lines: [],
      hitlContext: null,
      threadId: null,
      finalOutput: null,
      costSummary: null,
      error: null,
    });
  }, []);

  /** Fire POST /execute-workflow and stream steps into terminal. */
  const runWorkflow = useCallback(
    async (prompt: string) => {
      abortRef.current = false;
      setState({
        phase: "running",
        lines: [
          {
            id: makeId(),
            text: "[SYSTEM] Initialising NexusFlow orchestration graph...",
            type: "system",
            timestamp: now(),
          },
        ],
        hitlContext: null,
        threadId: null,
        finalOutput: null,
        costSummary: null,
        error: null,
      });

      let response: WorkflowExecuteResponse;
      try {
        response = await executeWorkflow({ input_prompt: prompt });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          phase: "failed",
          error: msg,
          lines: [
            ...prev.lines,
            {
              id: makeId(),
              text: `[SYSTEM] ✗ Connection error: ${msg}`,
              type: "error",
              timestamp: now(),
            },
          ],
        }));
        return;
      }

      // Replay the step log with animated delays.
      await replaySteps(response.step_log ?? [], pushLine);

      if (response.status === "PENDING_APPROVAL") {
        pushLine({
          id: makeId(),
          text: `[HITL_GATE] ⚠  High-value transaction detected — ${response.hitl_context?.company} / $${response.hitl_context?.amount_usd?.toLocaleString()} — awaiting corporate approval`,
          type: "hitl",
          timestamp: now(),
        });
        setState((prev) => ({
          ...prev,
          phase: "pending_approval",
          hitlContext: response.hitl_context ?? null,
          threadId: response.thread_id ?? null,
        }));
        return;
      }

      const finalPhase =
        response.status === "COMPLETED"
          ? "completed"
          : response.status === "REJECTED"
          ? "rejected"
          : "failed";

      const summaryLine =
        finalPhase === "completed"
          ? `[SYSTEM] ✓ Workflow COMPLETED — saved $${(response.cost_summary?.total_estimated_savings_usd ?? 0).toFixed(6)} USD vs baseline`
          : `[SYSTEM] ✗ Workflow ${response.status}${response.error ? ": " + response.error : ""}`;

      pushLine({
        id: makeId(),
        text: summaryLine,
        type: finalPhase === "completed" ? "success" : "error",
        timestamp: now(),
      });

      setState((prev) => ({
        ...prev,
        phase: finalPhase,
        finalOutput: response.final_output ?? null,
        costSummary: response.cost_summary ?? null,
        error: response.error ?? null,
      }));
    },
    [pushLine]
  );

  /** Fire POST /workflows/{threadId}/approve and resume terminal. */
  const resolveHitl = useCallback(
    async (approved: boolean, note?: string) => {
      const { threadId } = state;
      if (!threadId) return;

      pushLine({
        id: makeId(),
        text: approved
          ? "[HITL_GATE] ✓ Operator approved handoff — resuming orchestration graph..."
          : "[HITL_GATE] ✗ Operator terminated run — propagating rejection signal...",
        type: "hitl",
        timestamp: now(),
      });

      setState((prev) => ({ ...prev, phase: "running", hitlContext: null }));

      let response: WorkflowApproveResponse;
      try {
        response = await approveWorkflow(threadId, {
          approved,
          operator_note: note ?? "",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          phase: "failed",
          error: msg,
          lines: [
            ...prev.lines,
            {
              id: makeId(),
              text: `[SYSTEM] ✗ Resume error: ${msg}`,
              type: "error",
              timestamp: now(),
            },
          ],
        }));
        return;
      }

      // Replay only the NEW steps appended after resume.
      await replaySteps(response.step_log ?? [], pushLine);

      const finalPhase =
        response.status === "COMPLETED"
          ? "completed"
          : response.status === "REJECTED"
          ? "rejected"
          : "failed";

      pushLine({
        id: makeId(),
        text:
          finalPhase === "completed"
            ? `[SYSTEM] ✓ Workflow COMPLETED — Invoice ${(response.final_output?.invoice_data as Record<string,unknown>)?.invoice_number ?? ""} finalised`
            : `[SYSTEM] ✗ Workflow ${response.status}`,
        type: finalPhase === "completed" ? "success" : "error",
        timestamp: now(),
      });

      setState((prev) => ({
        ...prev,
        phase: finalPhase,
        finalOutput: response.final_output ?? null,
        costSummary: response.cost_summary ?? null,
        error: response.error ?? null,
      }));
    },
    [state, pushLine]
  );

  return { state, runWorkflow, resolveHitl, reset };
}
