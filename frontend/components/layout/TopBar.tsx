"use client";

import { Badge } from "@/components/ui/badge";
import { Bell, ChevronRight, Menu } from "lucide-react";

interface TopBarProps {
  section: string;
  pendingApproval?: boolean;
  /** Opens the mobile navigation drawer. */
  onMenuClick?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  sales: "Sales Agent",
  finance: "Finance Agent",
  console: "Agent Console",
  analytics: "Analytics",
};

export function TopBar({ section, pendingApproval, onMenuClick }: TopBarProps) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 shadow-sm">
      {/* Breadcrumb + mobile menu toggle */}
      <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="hidden sm:inline">NexusFlow</span>
        <ChevronRight className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
        <span className="text-gray-900 font-medium truncate">
          {SECTION_LABELS[section] ?? section}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {pendingApproval && (
          <Badge
            variant="outline"
            className="border-amber-400 text-amber-700 bg-amber-50 animate-pulse text-[11px]"
          >
            ⚠ Awaiting Approval
          </Badge>
        )}
        <div className="relative">
          <Bell className="w-4.5 h-4.5 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
          {pendingApproval && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </div>
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-[11px] font-bold text-white">
          OP
        </div>
      </div>
    </header>
  );
}
