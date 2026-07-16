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
          { label: "Total Tokens Used", value: loading ? "—" : totalTokens.toLocaleString(), icon: Zap, colour: "text-violet-600", bg: "bg-violet-50" },
          { label: "Total API Spend", value: loading ? "—" : `$${(Number(totalCost) || 0).toFixed(6)}`, icon: BarChart3, colour: "text-sky-600", bg: "bg-sky-50" },
          { label: "Total USD Saved", value: loading ? "—" : `$${(Number(totalSaved) || 0).toFixed(6)}`, icon: TrendingDown, colour: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="bg-white border-gray-200 shadow-sm">
              <CardContent className="pt-4 pb-4 flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${k.colour}`} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full cost ledger table */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">
              Cost Ledger
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Cost per call
            </p>
          </div>
          <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs font-mono">
            {logs.length} records
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-gray-400 italic">Loading…</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No records yet.</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Run a workflow to see data here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    {["Model", "Prompt Tokens", "Completion Tokens", "Cost (USD)", "Saved (USD)", "Strategy", "Timestamp"].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-[10px] uppercase tracking-wider text-gray-400 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.slice(-20).reverse().map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 pr-4 text-gray-700 whitespace-nowrap font-mono">{log.model_used}</td>
                      <td className="py-2 pr-4 text-gray-600">{(Number(log.prompt_tokens) || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-600">{(Number(log.completion_tokens) || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-sky-600 font-mono">${(Number(log.raw_cost_usd) || 0).toFixed(6)}</td>
                      <td className="py-2 pr-4 text-emerald-600 font-mono">${(Number(log.estimated_savings_usd) || 0).toFixed(6)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="border-gray-300 text-gray-500 text-[9px]">
                          {log.routing_strategy}
                        </Badge>
                      </td>
                      <td className="py-2 text-gray-400 text-[10px] whitespace-nowrap">
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
