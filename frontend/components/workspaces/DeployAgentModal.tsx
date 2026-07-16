"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { createAgent, fetchDepartments } from "@/lib/api";
import type { DepartmentRecord } from "@/lib/types";
import { Bot, Plus, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

interface DeployAgentModalProps {
  onDeployed?: () => void;
  triggerButton?: React.ReactNode;
}

const MODEL_OPTIONS = [
  { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o-Mini (Fast / Cost-Optimized)" },
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o (High Reasoning Baseline)" },
  { id: "anthropic/claude-3-5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
  { id: "meta-llama/llama-3-70b-instruct", label: "Meta Llama 3 70B Instruct" },
];

/**
 * Baseline enterprise tool catalogue. The `key` is what persists to Postgres
 * and what the LangGraph router binds to the LLM — the emoji and label are
 * presentation only.
 */
const AVAILABLE_TOOLS = [
  { key: "web_search", emoji: "🌐", label: "Web Search", hint: "Live public web lookup" },
  { key: "db_query", emoji: "📊", label: "Database Query", hint: "Read internal records" },
  { key: "invoice_gen", emoji: "🧾", label: "Invoice Generation", hint: "Draft formatted invoices" },
  { key: "email_send", emoji: "📧", label: "Email Dispatcher", hint: "Send outbound mail" },
  { key: "stripe_charge", emoji: "💳", label: "Stripe Payment Gateway", hint: "Charge a customer card" },
];

export function DeployAgentModal({ onDeployed, triggerButton }: DeployAgentModalProps) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [name, setName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [modelName, setModelName] = useState("openai/gpt-4o-mini");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
      fetchDepartments().then((depts) => {
        setDepartments(depts);
        if (depts.length > 0 && !selectedDeptId) {
          setSelectedDeptId(depts[0].id);
        }
      });
    }
  }, [open, selectedDeptId]);

  function toggleTool(key: string) {
    setSelectedTools((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roleDesc.trim() || !systemPrompt.trim() || !selectedDeptId) {
      setError("Please fill in all required agent configuration fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAgent(selectedDeptId, {
        name: name.trim(),
        role_description: roleDesc.trim(),
        system_prompt: systemPrompt.trim(),
        default_model: modelName,
        is_active: true,
        tools: selectedTools,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nexusflow:refresh-stats"));
      }

      setSuccess(true);
      onDeployed?.();

      setTimeout(() => {
        setName("");
        setRoleDesc("");
        setSystemPrompt("");
        setSelectedTools([]);
        setSuccess(false);
        setOpen(false);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy agent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-block cursor-pointer">
        {triggerButton || (
          <Button
            type="button"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs h-9 px-3.5 rounded-lg shadow-lg shadow-violet-900/30 flex items-center gap-2 border-0 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy New Agent</span>
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-lg p-6 rounded-xl shadow-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Deploy & Register Autonomous Agent
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Provision a new LangGraph-ready LLM agent permanently into PostgreSQL.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white">Agent Deployed Successfully!</h3>
            <p className="text-xs text-zinc-400 max-w-xs">
              <span className="text-violet-300 font-semibold">{name}</span> is now active in PostgreSQL and ready for orchestration workflows.
            </p>
          </div>
        ) : (
          <form onSubmit={handleDeploy} className="space-y-4 mt-3">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Agent Name *</span>
                <span className="text-[10px] text-zinc-500 font-normal">e.g. Legal Contract Reviewer</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Support Triage Agent"
                className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200 h-9 focus:border-violet-500/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Department / Domain *</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 px-3 focus:outline-none focus:border-violet-500/60"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (${d.monthly_budget_usd}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Model Provider *</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 px-3 focus:outline-none focus:border-violet-500/60"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Role Description *</label>
              <Input
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="e.g. Inspects inbound legal terms and extracts key liabilities."
                className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200 h-9 focus:border-violet-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Capabilities / Available Tools</span>
                <span className="text-[10px] text-zinc-500 font-normal">
                  {selectedTools.length === 0
                    ? "None selected"
                    : `${selectedTools.length} selected`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const checked = selectedTools.includes(tool.key);
                  return (
                    <div
                      key={tool.key}
                      onClick={() => toggleTool(tool.key)}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                        checked
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                      }`}
                    >
                      {/* Two toggle paths, exactly one of which can fire per
                          interaction. Mouse: pointer-events-none means the box
                          never receives the click, so it lands on the tile's
                          onClick. Keyboard: Space/Enter on the focused box fires
                          a native click that Base UI stops from propagating, so
                          only onCheckedChange runs. */}
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleTool(tool.key)}
                        aria-label={tool.label}
                        className="mt-0.5 pointer-events-none border-zinc-700"
                      />
                      <div className="min-w-0 leading-tight">
                        <p className="text-[11px] font-medium text-zinc-200">
                          <span aria-hidden="true">{tool.emoji}</span> {tool.label}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{tool.hint}</p>
                        <code className="text-[9px] text-violet-400/70 font-mono">{tool.key}</code>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>System Prompt / Instructions *</span>
                <span className="text-[10px] text-violet-400 font-mono">LangGraph Role Definition</span>
              </label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a senior enterprise agent. When given an input prompt, analyze..."
                rows={4}
                className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200 resize-none focus:border-violet-500/60 font-mono"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold h-9 px-4 rounded-lg shadow-lg shadow-violet-900/30 flex items-center gap-1.5 border-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying to DB...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Deploy Agent to Database</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
