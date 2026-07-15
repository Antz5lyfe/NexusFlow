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
    fetchCostLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const totalSaved = logs.reduce((s, l) => s + (l.estimated_savings_usd ?? 0), 0);
  const totalCost = logs.reduce((s, l) => s + (l.raw_cost_usd ?? 0), 0);
  const totalTokens = logs.reduce(
    (s, l) => s + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      {/* Aggregate header */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Tokens Used", value: loading ? "—" : totalTokens.toLocaleString(), icon: Zap, colour: "text-violet-400", bg: "bg-violet-600/20" },
          { label: "Total API Spend", value: loading ? "—" : `$${totalCost.toFixed(6)}`, icon: BarChart3, colour: "text-sky-400", bg: "bg-sky-600/20" },
          { label: "Total USD Saved", value: loading ? "—" : `$${totalSaved.toFixed(6)}`, icon: TrendingDown, colour: "text-emerald-400", bg: "bg-emerald-600/20" },
        ].map(({ label, value, icon: Icon, colour, bg }) => (
          <Card key={label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4 pb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-3.5 h-3.5 ${colour}`} />
              </div>
              <p className="text-[11px] text-zinc-500">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${colour}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost log table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            Cost Log Entries
            {!loading && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] ml-auto">
                {logs.length} records
              </Badge>
            )}
          </CardTitle>
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
                      <td className="py-2 pr-4 text-zinc-400">{log.prompt_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-zinc-400">{log.completion_tokens.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-sky-400 font-mono">${log.raw_cost_usd.toFixed(6)}</td>
                      <td className="py-2 pr-4 text-emerald-400 font-mono">${log.estimated_savings_usd.toFixed(6)}</td>
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
