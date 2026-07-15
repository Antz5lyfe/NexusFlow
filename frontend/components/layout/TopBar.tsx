"use client";

import { Badge } from "@/components/ui/badge";
import { Bell, ChevronRight } from "lucide-react";

interface TopBarProps {
  section: string;
  pendingApproval?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  overview: "Executive Overview",
  sales: "Sales Agent Workspace",
  finance: "Finance Agent Workspace",
  analytics: "System Analytics",
};

export function TopBar({ section, pendingApproval }: TopBarProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-zinc-500">
        <span>NexusFlow</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-zinc-200 font-medium">
          {SECTION_LABELS[section] ?? section}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {pendingApproval && (
          <Badge
            variant="outline"
            className="border-amber-500/50 text-amber-400 bg-amber-500/10 animate-pulse text-[11px]"
          >
            ⚠ Awaiting Approval
          </Badge>
        )}
        <div className="relative">
          <Bell className="w-4.5 h-4.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
          {pendingApproval && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </div>
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">
          OP
        </div>
      </div>
    </header>
  );
}
