"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TerminalOutput } from "./TerminalOutput";
import { PromptInput } from "./PromptInput";
import { HitlModal } from "@/components/hitl/HitlModal";
import { useWorkflow } from "@/hooks/useWorkflow";
import { Terminal, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import type { FinalOutput, CostSummary } from "@/lib/types";

const STATUS_CONFIG = {
  idle:             { label: "Ready",            colour: "text-zinc-400",   bg: "bg-zinc-400",   badgeClass: "border-zinc-600 text-zinc-400" },
  running:          { label: "Running",          colour: "text-violet-400", bg: "bg-violet-400", badgeClass: "border-violet-500/50 text-violet-300 bg-violet-500/10" },
  pending_approval: { label: "Pending Approval", colour: "text-amber-400",  bg: "bg-amber-400",  badgeClass: "border-amber-500/50 text-amber-300 bg-amber-500/10" },
  completed:        { label: "Completed",        colour: "text-emerald-400",bg: "bg-emerald-400",badgeClass: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10" },
  rejected:         { label: "Rejected",         colour: "text-red-400",    bg: "bg-red-400",    badgeClass: "border-red-500/50 text-red-300 bg-red-500/10" },
  failed:           { label: "Failed",           colour: "text-red-400",    bg: "bg-red-400",    badgeClass: "border-red-500/50 text-red-300 bg-red-500/10" },
} as const;

function ResultPanel({ output, cost }: { output: FinalOutput | null; cost: CostSummary | null }) {
  if (!output) return null;
  const lead = output.lead_data;
  const invoice = output.invoice_data;

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {lead && Object.keys(lead).length > 0 && (
        <div className="bg-sky-950/30 border border-sky-800/30 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-500 mb-2">Lead Qualified</p>
          {[
            ["Company", lead.company],
            ["Deal Value", lead.deal_value != null ? `$${Number(lead.deal_value).toLocaleString()}` : undefined],
            ["Score", lead.lead_score],
            ["Email", lead.contact_email],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-xs">
              <span className="text-zinc-500">{k}</span>
              <span className="text-zinc-200 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {invoice && Object.keys(invoice).length > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 mb-2">Invoice Generated</p>
          {[
            ["Invoice #", invoice.invoice_number],
            ["Client", invoice.client_company],
            ["Subtotal", invoice.subtotal_usd != null ? `$${Number(invoice.subtotal_usd).toLocaleString()}` : undefined],
            ["Total (inc. tax)", invoice.total_usd != null ? `$${Number(invoice.total_usd).toLocaleString()}` : undefined],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-xs">
              <span className="text-zinc-500">{k}</span>
              <span className="text-zinc-200 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {cost && (
        <div className="md:col-span-2 bg-violet-950/20 border border-violet-800/20 rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400 mb-2">Cost Summary</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-zinc-400">Tokens: <span className="text-zinc-200">{cost.total_tokens.toLocaleString()}</span></span>
            <span className="text-zinc-400">API Cost: <span className="text-zinc-200">${cost.total_raw_cost_usd.toFixed(6)}</span></span>
            <span className="text-zinc-400">Saved: <span className="text-emerald-400 font-semibold">${cost.total_estimated_savings_usd.toFixed(6)}</span></span>
            <span className="text-zinc-400">Models: <span className="text-zinc-200">{cost.models_used.join(", ")}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkflowTerminal() {
  const { state, runWorkflow, resolveHitl, reset } = useWorkflow();
  const cfg = STATUS_CONFIG[state.phase];

  const StatusIcon =
    state.phase === "completed" ? CheckCircle2 :
    state.phase === "rejected" || state.phase === "failed" ? XCircle :
    state.phase === "pending_approval" ? AlertCircle :
    state.phase === "running" ? Clock :
    Terminal;

  return (
    <>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <CardTitle className="text-sm text-zinc-200 font-semibold">
                Live Orchestration Terminal
              </CardTitle>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Sales → Finance agent pipeline · LangGraph HITL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${cfg.colour} ${state.phase === "running" ? "animate-spin" : ""}`} />
            <Badge variant="outline" className={`text-[11px] ${cfg.badgeClass}`}>
              {cfg.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <PromptInput
            phase={state.phase}
            onSubmit={runWorkflow}
            onReset={reset}
          />

          <TerminalOutput
            lines={state.lines}
            isRunning={state.phase === "running"}
          />

          <ResultPanel output={state.finalOutput} cost={state.costSummary} />
        </CardContent>
      </Card>

      <HitlModal
        open={state.phase === "pending_approval"}
        context={state.hitlContext}
        onApprove={(note) => resolveHitl(true, note)}
        onTerminate={(note) => resolveHitl(false, note)}
      />
    </>
  );
}
