"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, RotateCcw, Loader2 } from "lucide-react";
import type { WorkflowPhase } from "@/hooks/useWorkflow";

const EXAMPLE_PROMPTS = [
  "New enterprise lead from an Indonesian client at Bukalapak — deal value $1,500 USD",
  "Inbound opportunity from Grab Singapore, licensing deal worth $50,000",
  "Small consulting retainer for a Hanoi startup — $750 per month",
];

interface PromptInputProps {
  phase: WorkflowPhase;
  onSubmit: (prompt: string) => void;
  onReset: () => void;
}

export function PromptInput({ phase, onSubmit, onReset }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = phase === "running";
  const isDone =
    phase === "completed" || phase === "rejected" || phase === "failed";
  const isPending = phase === "pending_approval";

  function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning || isPending) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  return (
    <div className="space-y-3">
      {/* Example prompts */}
      {phase === "idle" && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setPrompt(ex);
                textareaRef.current?.focus({ preventScroll: true });
              }}
              className="text-[11px] text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-md px-2.5 py-1 transition-all hover:bg-gray-50 truncate max-w-xs"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a lead to qualify or invoice to generate…"
          rows={3}
          disabled={isRunning || isPending}
          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 resize-none pr-24 focus:border-blue-500 focus:ring-blue-500/20 transition-colors text-sm"
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <span className="text-[10px] text-gray-500 hidden sm:block">⌘↵</span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isRunning || isPending}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 shadow-lg shadow-blue-900/30 h-8 px-3 transition-all"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {isDone && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPrompt("");
            onReset();
          }}
          className="border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all"
        >
          <RotateCcw className="w-3 h-3 mr-1.5" />
          New workflow
        </Button>
      )}

      {isPending && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
          Waiting for your approval above
        </p>
      )}
    </div>
  );
}
