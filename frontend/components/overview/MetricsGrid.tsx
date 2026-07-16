"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCostLogs, fetchWorkflows } from "@/lib/api";
import { useAgents } from "@/hooks/useAgents";
import type { CostLogRecord, WorkflowRunRecord } from "@/lib/types";
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
  const { agents, loading: agentsLoading } = useAgents();
  const [costLogs, setCostLogs] = useState<CostLogRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRunRecord[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [c, w] = await Promise.all([fetchCostLogs(), fetchWorkflows()]);
      setCostLogs(c);
      setWorkflows(w);
      setStatsLoading(false);
    }

    loadData();
    const interval = setInterval(loadData, 3000);
    window.addEventListener("nexusflow:refresh-stats", loadData);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nexusflow:refresh-stats", loadData);
    };
  }, []);

  const loading = agentsLoading || statsLoading;
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
        <Card className="bg-white border-gray-200 relative overflow-hidden group hover:border-blue-400 transition-colors shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Active Agents
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? "—" : <CountUp target={activeAgents} />}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {loading ? "Fetching..." : `${agents.length} total registered`}
            </p>
          </CardContent>
        </Card>

        {/* Workflows */}
        <Card className="bg-white border-gray-200 relative overflow-hidden group hover:border-cyan-400 transition-colors shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Workflows Run
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center">
              <Workflow className="w-4 h-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              <CountUp target={totalWorkflows} />
            </div>
            <p className="text-xs text-gray-500 mt-1">total persisted</p>
          </CardContent>
        </Card>

        {/* Raw cost */}
        <Card className="bg-white border-gray-200 relative overflow-hidden group hover:border-emerald-400 transition-colors shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              Total API Spend
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? "—" : <CountUp target={totalCost} prefix="$" decimals={6} />}
            </div>
            <p className="text-xs text-gray-500 mt-1">vs. baseline rates</p>
          </CardContent>
        </Card>
      </div>

      {/* ROI Engine block */}
      <Card className="bg-gradient-to-br from-white via-white to-violet-50 border-violet-200 relative overflow-hidden shadow-sm">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-indigo-600/5 blur-2xl pointer-events-none" />

        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-600">
                ROI Engine
              </span>
              <Badge
                variant="outline"
                className="border-violet-300 text-violet-600 text-[10px] bg-violet-50"
              >
                Live
              </Badge>
            </div>
            <CardTitle className="text-sm text-gray-700 font-medium">
              Saved vs. GPT-4o
            </CardTitle>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </CardHeader>

        <CardContent>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-black tracking-tighter text-gray-900">
              {loading ? (
                <span className="text-gray-400">Fetching...</span>
              ) : (
                <CountUp target={totalSaved} prefix="$" decimals={6} />
              )}
            </div>
            <div className="pb-1.5 text-xs text-gray-500">
              USD
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Models Active", value: loading ? "—" : [...new Set(costLogs.map((c) => c.model_used))].length.toString(), icon: Cpu },
              { label: "LLM Calls", value: loading ? "—" : costLogs.length.toString(), icon: Bot },
              { label: "Strategy", value: "FREE-TIER", icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/70 rounded-lg p-3 border border-gray-200">
                <Icon className="w-3.5 h-3.5 text-gray-400 mb-1.5" />
                <p className="text-base font-bold text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
