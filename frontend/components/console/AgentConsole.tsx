"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgents } from "@/hooks/useAgents";
import { runAgent } from "@/lib/api";
import type { AgentRunResponse } from "@/lib/types";
import { Bot, FileText, Loader2, Paperclip, Send, X } from "lucide-react";

export function AgentConsole() {
  const { agents, loading: agentsLoading } = useAgents();
  const [selectedId, setSelectedId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeId = selectedId || agents[0]?.id || "";
  const selectedAgent = agents.find((a) => a.id === activeId) ?? null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleRun() {
    if (!activeId || !prompt.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runAgent(activeId, prompt.trim(), file);
      setResult(res);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nexusflow:refresh-stats"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run agent.");
    } finally {
      setRunning(false);
    }
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-sm text-gray-900 font-semibold">
              Agent Console
            </CardTitle>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Ask any registered agent a question — attach a PDF for it to read
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {agentsLoading ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">Loading agents…</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500">No agents yet — deploy one to use the console.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Agent</label>
              <select
                value={activeId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full h-9 bg-white border border-gray-300 rounded-md text-xs text-gray-900 px-3 focus:outline-none focus:border-violet-500"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.is_active ? "" : "(Paused)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask this agent something…"
                rows={3}
                disabled={running}
                className="bg-white border-gray-300 text-xs text-gray-900 resize-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="agent-console-file"
              />
              <label
                htmlFor="agent-console-file"
                className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-md px-2.5 py-1.5 cursor-pointer transition-colors"
              >
                <Paperclip className="w-3 h-3" />
                Attach PDF
              </label>
              {file && (
                <span className="flex items-center gap-1.5 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-2 py-1">
                  <FileText className="w-3 h-3" />
                  {file.name}
                  <button type="button" onClick={clearFile} className="hover:text-violet-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleRun}
                disabled={!prompt.trim() || running}
                className="ml-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 h-8 px-3 text-xs shadow-lg shadow-violet-900/20"
              >
                {running ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Run
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-600">
                    {result.agent_name} replied
                  </span>
                  <Badge variant="outline" className="border-gray-300 text-gray-500 text-[9px] font-mono">
                    {result.model_used}
                  </Badge>
                </div>

                {result.document && (
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    Read {result.document.extracted_chars.toLocaleString()} characters from{" "}
                    {result.document.filename}
                    {result.document.extracted_chars === 0 && " (no text found — likely a scanned image)"}
                    {result.document.truncated && " (truncated)"}
                  </div>
                )}

                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {result.reply}
                </p>

                <div className="flex gap-4 text-[10px] text-gray-500 pt-2 border-t border-gray-200">
                  <span>
                    Tokens: <span className="text-gray-700">{result.prompt_tokens + result.completion_tokens}</span>
                  </span>
                  <span>
                    Cost: <span className="text-gray-700">${result.cost_usd.toFixed(6)}</span>
                  </span>
                  <span>
                    Saved: <span className="text-emerald-600">${result.saved_usd.toFixed(6)}</span>
                  </span>
                </div>
              </div>
            )}

            {selectedAgent && !selectedAgent.is_active && (
              <p className="text-[11px] text-amber-600">
                This agent is paused — activate it in the registry below before running it.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
