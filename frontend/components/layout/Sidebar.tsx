"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Bot,
  Database,
  DollarSign,
  LayoutDashboard,
  Terminal,
  X,
  Zap,
} from "lucide-react";

export type NavSection =
  | "overview"
  | "sales"
  | "finance"
  | "console"
  | "databank"
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
    sublabel: "Summary",
  },
  {
    id: "sales",
    label: "Sales Agent",
    icon: Bot,
    sublabel: "Lead qualification",
  },
  {
    id: "finance",
    label: "Finance Agent",
    icon: DollarSign,
    sublabel: "Invoicing",
  },
  {
    id: "console",
    label: "Agent Console",
    icon: Terminal,
    sublabel: "Ask any agent",
  },
  {
    id: "databank",
    label: "Knowledge Databank",
    icon: Database,
    sublabel: "Document OCR scan",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    sublabel: "Cost & savings",
  },
];

interface SidebarProps {
  active: NavSection;
  onChange: (s: NavSection) => void;
  /** Whether the mobile drawer is open. Ignored at ≥md (always visible). */
  open?: boolean;
  /** Close the mobile drawer (backdrop tap, close button, nav select). */
  onClose?: () => void;
}

export function Sidebar({ active, onChange, open = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Backdrop — mobile only, shown while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-40 shadow-sm",
          "transition-transform duration-200 ease-out",
          // Off-canvas on mobile until opened; always on-canvas at ≥md.
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.svg"
            alt="NexusFlow Logo"
            className="w-8 h-8 object-contain"
          />
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none tracking-tight">
              NexusFlow
            </p>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">
              Orchestrator v1.0
            </p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1 -mr-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status pill */}
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] text-gray-600">Engine online</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-widest px-2 mb-2">
          Workspaces
        </p>
        {NAV_ITEMS.map(({ id, label, icon: Icon, sublabel }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
              active === id
                ? "bg-blue-50 border border-blue-200 text-blue-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent"
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                active === id ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
              )}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-none truncate">
                {label}
              </p>
              <p
                className={cn(
                  "text-[10px] mt-0.5 leading-none truncate",
                  active === id ? "text-blue-600/70" : "text-gray-500"
                )}
              >
                {sublabel}
              </p>
            </div>
            {active === id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] text-gray-500">
            Powered by LangGraph
          </span>
        </div>
      </div>
      </aside>
    </>
  );
}
