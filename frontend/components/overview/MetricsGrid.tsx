"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchAgents, fetchCostLogs, fetchWorkflows } from "@/lib/api";
import type { AgentRecord, CostLogRecord, WorkflowRunRecord } from "@/lib/types";
import { Bot, TrendingUp, Workflow, DollarSign, Cpu, Sparkles } from "lucide-react";

function CountUp({ target, prefix = "", suffix = "", decimals = 0 }: { target: number | string; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const numTarget = Number(target);
    const validTarget = Number.isFinite(numTarget) ? numTarget : 0;
    const duration = 1200;
    const steps = 40;
    const increment = validTarget / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= validTarget) {
        current = validTarget;
        clearInterval(timer);
      }
      setDisplay(current);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  const safeDisplay = Number.isFinite(display) ? display : 0;

  return (
    <span>
      {prefix}
      {safeDisplay.toFixed(decimals)}
      {suffix}
    </span>
  );
}

interface MetricsGridProps {
  /** Number of workflow runs completed in this session (passed from parent). */
  workflowCount: number;
}

export function MetricsGrid({ workflowCount }: MetricsGridProps) {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [costLogs, setCostLogs] = useState<CostLogRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [a, c, w] = await Promise.all([
        fetchAgents(),
        fetchCostLogs(),
        fetchWorkflows(),
      ]);
      setAgents(a);
      setCostLogs(c);
      setWorkflows(w);
      setLoading(false);
    }

    loadData();
    const interval = setInterval(loadData, 3000);
    window.addEventListener("nexusflow:refresh-stats", loadData);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nexusflow:refresh-stats", loadData);
    };
  }, []);

  const activeAgents = agents.filter((a) => a.is_active).length;
  const totalWorkflows = Math.max(Number(workflowCount) || 0, workflows.length || 0);
  const totalSaved = costLogs.reduce(
    (sum, l) => sum + (Number(l.estimated_savings_usd) || 0),
    0
  );
  const totalCost = costLogs.reduce(
    (sum, l) => sum + (Number(l.raw_cost_usd) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Agents */}
        <Card className="bg-zinc-900 border-zinc-800 relative overflow-hidden group hover:border-violet-600/40 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Active Agents Deployed
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {loading ? "—" : <CountUp target={activeAgents} />}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {loading ? "Fetching..." : `${agents.length} total registered`}
            </p>
          </CardContent>
        </Card>

        {/* Workflows */}
        <Card className="bg-zinc-900 border-zinc-800 relative overflow-hidden group hover:border-indigo-600/40 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Workflows Orchestrated
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <Workflow className="w-4 h-4 text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              <CountUp target={totalWorkflows} />
            </div>
            <p className="text-xs text-zinc-500 mt-1">total persisted</p>
          </CardContent>
        </Card>

        {/* Raw cost */}
        <Card className="bg-zinc-900 border-zinc-800 relative overflow-hidden group hover:border-emerald-600/40 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total API Spend
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {loading ? "—" : <CountUp target={totalCost} prefix="$" decimals={6} />}
            </div>
            <p className="text-xs text-zinc-500 mt-1">vs. baseline rates</p>
          </CardContent>
        </Card>
      </div>

      {/* ROI Engine block */}
      <Card className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/30 border-violet-600/30 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-indigo-600/10 blur-2xl pointer-events-none" />

        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
                ROI Engine
              </span>
              <Badge
                variant="outline"
                className="border-violet-500/30 text-violet-300 text-[10px] bg-violet-500/10"
              >
                Live
              </Badge>
            </div>
            <CardTitle className="text-sm text-zinc-300 font-medium">
              Synthetic USD Saved vs. GPT-4o Baseline
            </CardTitle>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </CardHeader>

        <CardContent>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-black tracking-tighter text-white">
              {loading ? (
                <span className="text-zinc-600">Fetching...</span>
              ) : (
                <CountUp target={totalSaved} prefix="$" decimals={6} />
              )}
            </div>
            <div className="pb-1.5 text-xs text-zinc-500">
              USD
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Models Active", value: loading ? "—" : [...new Set(costLogs.map((c) => c.model_used))].length.toString(), icon: Cpu },
              { label: "LLM Calls", value: loading ? "—" : costLogs.length.toString(), icon: Bot },
              { label: "Strategy", value: "FREE-TIER", icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-700/50">
                <Icon className="w-3.5 h-3.5 text-zinc-500 mb-1.5" />
                <p className="text-base font-bold text-white">{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
