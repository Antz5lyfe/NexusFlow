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
  idle:             { label: "Ready",            colour: "text-gray-400",    badgeClass: "border-gray-300 text-gray-500" },
  running:          { label: "Running",          colour: "text-violet-500",  badgeClass: "border-violet-300 text-violet-700 bg-violet-50" },
  pending_approval: { label: "Pending Approval", colour: "text-amber-500",   badgeClass: "border-amber-300 text-amber-700 bg-amber-50" },
  completed:        { label: "Completed",        colour: "text-emerald-500", badgeClass: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  rejected:         { label: "Rejected",         colour: "text-red-500",     badgeClass: "border-red-300 text-red-700 bg-red-50" },
  failed:           { label: "Failed",           colour: "text-red-500",     badgeClass: "border-red-300 text-red-700 bg-red-50" },
} as const;

function ResultPanel({ output, cost }: { output: FinalOutput | null; cost: CostSummary | null }) {
  if (!output) return null;
  const lead = output.lead_data;
  const invoice = output.invoice_data;

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      {lead && Object.keys(lead).length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-600 mb-2">Lead Qualified</p>
          {[
            ["Company", lead.company],
            ["Deal Value", lead.deal_value != null ? `$${Number(lead.deal_value).toLocaleString()}` : undefined],
            ["Score", lead.lead_score],
            ["Email", lead.contact_email],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-xs">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {invoice && Object.keys(invoice).length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-2">Invoice Generated</p>
          {[
            ["Invoice #", invoice.invoice_number],
            ["Client", invoice.client_company],
            ["Subtotal", invoice.subtotal_usd != null ? `$${Number(invoice.subtotal_usd).toLocaleString()}` : undefined],
            ["Total (inc. tax)", invoice.total_usd != null ? `$${Number(invoice.total_usd).toLocaleString()}` : undefined],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} className="flex justify-between text-xs">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {cost && (
        <div className="md:col-span-2 bg-violet-50 border border-violet-200 rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-2">Cost Summary</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-gray-500">Tokens: <span className="text-gray-900">{cost.total_tokens.toLocaleString()}</span></span>
            <span className="text-gray-500">API Cost: <span className="text-gray-900">${cost.total_raw_cost_usd.toFixed(6)}</span></span>
            <span className="text-gray-500">Saved: <span className="text-emerald-600 font-semibold">${cost.total_estimated_savings_usd.toFixed(6)}</span></span>
            <span className="text-gray-500">Models: <span className="text-gray-900">{cost.models_used.join(", ")}</span></span>
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
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <CardTitle className="text-sm text-gray-900 font-semibold">
                Workflow Terminal
              </CardTitle>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Sales → Finance pipeline
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
