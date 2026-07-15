"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Bot,
  DollarSign,
  LayoutDashboard,
  Zap,
} from "lucide-react";

export type NavSection =
  | "overview"
  | "sales"
  | "finance"
  | "analytics";

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  sublabel: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    sublabel: "Executive summary",
  },
  {
    id: "sales",
    label: "Sales Workspace",
    icon: Bot,
    sublabel: "Lead qualification",
  },
  {
    id: "finance",
    label: "Finance Workspace",
    icon: DollarSign,
    sublabel: "Invoice generation",
  },
  {
    id: "analytics",
    label: "System Analytics",
    icon: BarChart3,
    sublabel: "Cost & ROI metrics",
  },
];

interface SidebarProps {
  active: NavSection;
  onChange: (s: NavSection) => void;
}

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-zinc-950 border-r border-zinc-800 flex flex-col z-30">
      {/* Wordmark */}
      <div className="px-5 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none tracking-tight">
              NexusFlow
            </p>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">
              Orchestrator v1.0
            </p>
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div className="px-5 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] text-zinc-400">Engine online</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase text-zinc-600 tracking-widest px-2 mb-2">
          Workspaces
        </p>
        {NAV_ITEMS.map(({ id, label, icon: Icon, sublabel }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
              active === id
                ? "bg-violet-600/20 border border-violet-600/30 text-violet-300"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                active === id ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"
              )}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-none truncate">
                {label}
              </p>
              <p
                className={cn(
                  "text-[10px] mt-0.5 leading-none truncate",
                  active === id ? "text-violet-400/70" : "text-zinc-600"
                )}
              >
                {sublabel}
              </p>
            </div>
            {active === id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-zinc-600" />
          <span className="text-[10px] text-zinc-600">
            LangGraph · MemorySaver
          </span>
        </div>
      </div>
    </aside>
  );
}
