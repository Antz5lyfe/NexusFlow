"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentByName } from "@/hooks/useAgents";
import { Bot, ArrowRight, CheckCircle2 } from "lucide-react";

/** Name of the seeded core node this workspace documents. */
const SALES_AGENT_NAME = "Sales Lead Qualifier Agent";

const PIPELINE_STEPS = [
  { label: "Prompt ingestion", status: "done", desc: "User input parsed and tokenised" },
  { label: "Lead qualification", status: "done", desc: "GitHub Models gpt-4o-mini extracts structured lead data" },
  { label: "Score assignment", status: "done", desc: "A/B/C tier based on deal value threshold" },
  { label: "Handoff to Finance", status: "done", desc: "Lead data passed via LangGraph state" },
];

export function SalesWorkspace() {
  const { agent, loading } = useAgentByName(SALES_AGENT_NAME);
  const isActive = agent?.is_active ?? false;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <CardTitle className="text-sm text-zinc-200">{agent?.name ?? SALES_AGENT_NAME}</CardTitle>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Model: {agent?.default_model ?? "openai/gpt-4o-mini"} via GitHub Models
              </p>
            </div>
            {loading ? (
              <Badge variant="outline" className="ml-auto border-zinc-700 text-zinc-500 bg-zinc-800/40 text-[11px]">…</Badge>
            ) : (
              <Badge
                variant="outline"
                className={`ml-auto text-[11px] ${
                  isActive
                    ? "border-sky-500/30 text-sky-400 bg-sky-500/10"
                    : "border-zinc-700 text-zinc-500 bg-zinc-800/40"
                }`}
              >
                {agent === null ? "Not registered" : isActive ? "Active" : "Paused"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Lead Score A (≥$10k)", value: "High Value" },
              { label: "Lead Score B (≥$5k)", value: "Mid Tier" },
              { label: "Lead Score C (<$5k)", value: "Standard" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
                <p className="text-[10px] text-zinc-500">{label}</p>
                <p className="text-sm font-semibold text-zinc-200 mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">Pipeline stages</p>
            <div className="space-y-2">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-sky-600/20 border border-sky-600/40 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-sky-400" />
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className="w-px h-6 bg-zinc-800 mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-medium text-zinc-200">{step.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
            <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
            On success, lead_data is passed to the Finance workspace via LangGraph state
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
