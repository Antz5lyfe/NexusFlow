"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCostLogs } from "@/lib/api";
import type { CostLogRecord } from "@/lib/types";
import { BarChart3, TrendingDown, Zap } from "lucide-react";

export function SystemAnalytics() {
  const [logs, setLogs] = useState<CostLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      const data = await fetchCostLogs();
      setLogs(data);
      setLoading(false);
    }

    loadLogs();
    const interval = setInterval(loadLogs, 3000);
    window.addEventListener("nexusflow:refresh-stats", loadLogs);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nexusflow:refresh-stats", loadLogs);
    };
  }, []);

  const totalSaved = logs.reduce((s, l) => s + (Number(l.estimated_savings_usd) || 0), 0);
  const totalCost = logs.reduce((s, l) => s + (Number(l.raw_cost_usd) || 0), 0);
  const totalTokens = logs.reduce(
    (s, l) => s + (Number(l.prompt_tokens) || 0) + (Number(l.completion_tokens) || 0),
    0
  );

  return (
    <div className="space-y-5">
      {/* Aggregate header */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Tokens Used", value: loading ? "—" : totalTokens.toLocaleString(), icon: Zap, colour: "text-violet-400", bg: "bg-violet-600/20" },
          { label: "Total API Spend", value: loading ? "—" : `$${(Number(totalCost) || 0).toFixed(6)}`, icon: BarChart3, colour: "text-sky-400", bg: "bg-sky-600/20" },
          { label: "Total USD Saved", value: loading ? "—" : `$${(Number(totalSaved) || 0).toFixed(6)}`, icon: TrendingDown, colour: "text-emerald-400", bg: "bg-emerald-600/20" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-4 pb-4 flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${k.colour}`} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-xl font-bold text-white mt-0.5">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full cost ledger table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-200">
              Token & Routing Cost Ledger
            </CardTitle>
            <p className="text-xs text-zinc-500 mt-0.5">
              Immutable per-call telemetry from LangGraph execution nodes
            </p>
          </div>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs font-mono">
            {logs.length} records
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-zinc-600 italic">Fetching cost logs from backend…</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600">No cost log records found.</p>
              <p className="text-[11px] text-zinc-700 mt-1">
                Run a workflow to generate telemetry data.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    {["Model", "Prompt Tokens", "Completion Tokens", "Cost (USD)", "Saved (USD)", "Strategy", "Timestamp"].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {logs.slice(-20).reverse().map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 pr-4 text-zinc-300 whitespace-nowrap font-mono">{log.model_used}</td>
                      <td className="py-2 pr-4 text-zinc-400">{(Number(log.prompt_tokens) || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-zinc-400">{(Number(log.completion_tokens) || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-sky-400 font-mono">${(Number(log.raw_cost_usd) || 0).toFixed(6)}</td>
                      <td className="py-2 pr-4 text-emerald-400 font-mono">${(Number(log.estimated_savings_usd) || 0).toFixed(6)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[9px]">
                          {log.routing_strategy}
                        </Badge>
                      </td>
                      <td className="py-2 text-zinc-600 text-[10px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
