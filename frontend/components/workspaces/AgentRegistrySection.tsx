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
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-600" />
            <CardTitle className="text-sm font-semibold text-gray-900">
              Agents
            </CardTitle>
            <Badge variant="outline" className="border-violet-300 text-violet-700 text-[10px] bg-violet-50 font-mono">
              {agents.length} Registered
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            All agents deployed to your workspace
          </p>
        </div>
        <DeployAgentModal onDeployed={loadAgents} />
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {loading ? (
          <p className="text-xs text-gray-500 italic py-4 text-center">Loading agents…</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500">No agents yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => {
              const isCore = agent.name.includes("Sales Lead") || agent.name.includes("Finance Invoice");
              return (
                <div
                  key={agent.id}
                  className="bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg ${agent.is_active ? "bg-violet-100 text-violet-600" : "bg-gray-200 text-gray-500"} flex items-center justify-center shrink-0`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 tracking-tight">{agent.name}</span>
                          {isCore && (
                            <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.2 rounded font-medium">
                              Core Node
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Cpu className="w-3 h-3 text-gray-400" />
                          {agent.default_model || "openai/gpt-4o-mini"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 shrink-0 ${
                        agent.is_active
                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                          : "border-gray-300 text-gray-500 bg-gray-100"
                      }`}
                    >
                      {agent.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                    {agent.role_description || agent.system_prompt || "No instructions provided."}
                  </p>

                  <div className="pt-2.5 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-[9px] text-gray-400 font-mono">ID: {agent.id.slice(0, 8)}…</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(agent)}
                        className="h-7 px-2.5 text-[10px] border-gray-300 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900"
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
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
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
