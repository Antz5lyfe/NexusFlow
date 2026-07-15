"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TerminalLine } from "@/hooks/useWorkflow";

const LINE_STYLES: Record<TerminalLine["type"], string> = {
  system:  "text-zinc-400",
  sales:   "text-sky-400",
  finance: "text-emerald-400",
  hitl:    "text-amber-400",
  success: "text-emerald-300 font-semibold",
  error:   "text-red-400",
};

const PROMPT_COLOUR: Record<TerminalLine["type"], string> = {
  system:  "text-zinc-600",
  sales:   "text-sky-700",
  finance: "text-emerald-700",
  hitl:    "text-amber-700",
  success: "text-emerald-600",
  error:   "text-red-700",
};

interface TerminalOutputProps {
  lines: TerminalLine[];
  isRunning: boolean;
}

export function TerminalOutput({ lines, isRunning }: TerminalOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs overflow-hidden">
      {/* Terminal chrome bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-zinc-600 text-[10px] tracking-wide">
          nexusflow — orchestration terminal
        </span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <ScrollArea className="h-72 p-4">
        {lines.length === 0 ? (
          <p className="text-zinc-700 italic">
            Awaiting workflow initialisation...
          </p>
        ) : (
          <div className="space-y-1">
            {lines.map((line) => (
              <div key={line.id} className="flex gap-2">
                <span className={cn("shrink-0 select-none", PROMPT_COLOUR[line.type])}>
                  ›
                </span>
                <span className={cn("break-all leading-relaxed", LINE_STYLES[line.type])}>
                  {line.text}
                </span>
              </div>
            ))}
            {isRunning && (
              <div className="flex gap-2 items-center mt-1">
                <span className="text-zinc-600">›</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
