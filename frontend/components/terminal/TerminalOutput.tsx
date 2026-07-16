"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TerminalLine } from "@/hooks/useWorkflow";

const LINE_STYLES: Record<TerminalLine["type"], string> = {
  system:  "text-gray-600",
  sales:   "text-blue-600",
  finance: "text-green-600",
  hitl:    "text-amber-600",
  success: "text-green-700 font-semibold",
  error:   "text-red-600",
};

const PROMPT_COLOUR: Record<TerminalLine["type"], string> = {
  system:  "text-gray-600",
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
    if (lines.length > 0) {
      const viewport = bottomRef.current?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    }
  }, [lines]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 font-mono text-xs overflow-hidden shadow-sm">
      {/* Terminal chrome bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 text-gray-500 text-[10px] tracking-wide">
          nexusflow terminal
        </span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <ScrollArea className="h-72 p-4 bg-white">
        {lines.length === 0 ? (
          <p className="text-gray-400 italic">
            Waiting to start…
          </p>
        ) : (
          <div className="space-y-1">
            {lines.map((line) => (
              <div key={line.id} className="flex gap-2">
                <span className={cn("shrink-0 select-none text-gray-600")}>
                  ›
                </span>
                <span className={cn("break-all leading-relaxed", LINE_STYLES[line.type])}>
                  {line.text}
                </span>
              </div>
            ))}
            {isRunning && (
              <div className="flex gap-2 items-center mt-1">
                <span className="text-gray-400">›</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
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
