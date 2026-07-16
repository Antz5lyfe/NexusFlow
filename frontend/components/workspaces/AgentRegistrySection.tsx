"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateAgent, deleteAgent } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";
import { useAgents } from "@/hooks/useAgents";
import { Bot, Trash2, Power, Cpu } from "lucide-react";
import { DeployAgentModal } from "./DeployAgentModal";

export function AgentRegistrySection() {
  const { agents, loading, reload: loadAgents } = useAgents();

  async function handleToggleActive(agent: AgentRecord) {
    try {
      await updateAgent(agent.id, { is_active: !agent.is_active });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nexusflow:refresh-stats"));
      }
      loadAgents();
    } catch (err) {
      console.error("Failed to toggle agent active state:", err);
    }
  }

  async function handleDelete(agent: AgentRecord) {
    if (!window.confirm(`Are you sure you want to permanently delete "${agent.name}"?`)) return;
    try {
      await deleteAgent(agent.id);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nexusflow:refresh-stats"));
      }
      loadAgents();
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <CardTitle className="text-sm font-semibold text-zinc-200">
              Active Agent Registry &amp; Deployment Studio
            </CardTitle>
            <Badge variant="outline" className="border-violet-500/30 text-violet-300 text-[10px] bg-violet-500/10 font-mono">
              {agents.length} Registered
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Autonomous LangGraph orchestration nodes active in PostgreSQL
          </p>
        </div>
        <DeployAgentModal onDeployed={loadAgents} />
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {loading ? (
          <p className="text-xs text-zinc-600 italic py-4 text-center">Loading agent registry from database…</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-zinc-500">No agents currently registered.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => {
              const isCore = agent.name.includes("Sales Lead") || agent.name.includes("Finance Invoice");
              return (
                <div
                  key={agent.id}
                  className="bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg ${agent.is_active ? "bg-violet-600/20 text-violet-400" : "bg-zinc-800 text-zinc-500"} flex items-center justify-center shrink-0`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white tracking-tight">{agent.name}</span>
                          {isCore && (
                            <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded font-medium">
                              Core Node
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Cpu className="w-3 h-3 text-zinc-600" />
                          {agent.default_model || "openai/gpt-4o-mini"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 shrink-0 ${
                        agent.is_active
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : "border-zinc-700 text-zinc-500 bg-zinc-800/40"
                      }`}
                    >
                      {agent.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                    {agent.role_description || agent.system_prompt || "No instructions provided."}
                  </p>

                  <div className="pt-2.5 border-t border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[9px] text-zinc-600 font-mono">ID: {agent.id.slice(0, 8)}…</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(agent)}
                        className="h-7 px-2.5 text-[10px] border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                      >
                        <Power className="w-3 h-3 mr-1" />
                        {agent.is_active ? "Pause" : "Activate"}
                      </Button>
                      {!isCore && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(agent)}
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-950/20"
                          title="Delete Custom Agent"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
