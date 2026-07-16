"use client";

import { useState } from "react";
import { Sidebar, type NavSection } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MetricsGrid } from "@/components/overview/MetricsGrid";
import { WorkflowTerminal } from "@/components/terminal/WorkflowTerminal";
import { SalesWorkspace } from "@/components/workspaces/SalesWorkspace";
import { FinanceWorkspace } from "@/components/workspaces/FinanceWorkspace";
import { SystemAnalytics } from "@/components/analytics/SystemAnalytics";
import { AgentRegistrySection } from "@/components/workspaces/AgentRegistrySection";
import { DeployAgentModal } from "@/components/workspaces/DeployAgentModal";
import { DatabankView } from "@/components/databank/DatabankView";

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [workflowCount, setWorkflowCount] = useState(0);
  const [hasPendingApproval, setHasPendingApproval] = useState(false);

  function handleSectionChange(s: NavSection) {
    setActiveSection(s);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar active={activeSection} onChange={handleSectionChange} />

      {/* Main content — offset by sidebar width */}
      <div className="ml-60 flex flex-col min-h-screen">
        <TopBar section={activeSection} pendingApproval={hasPendingApproval} />

        <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
          {activeSection === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Executive Overview</h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    Real-time orchestration metrics and ROI telemetry
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <MetricsGrid workflowCount={workflowCount} />
              <AgentRegistrySection />
              <div>
                <h2 className="text-base font-semibold text-zinc-200 mb-4">
                  Workflow Orchestration Terminal
                </h2>
                <WorkflowTerminal />
              </div>
            </div>
          )}

          {activeSection === "sales" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Sales Agent Workspace</h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    Lead qualification pipeline configuration and status
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <SalesWorkspace />
              <AgentRegistrySection />
              <WorkflowTerminal />
            </div>
          )}

          {activeSection === "finance" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Finance Agent Workspace</h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    Invoice generation, HITL gate, and approval workflow
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <FinanceWorkspace />
              <AgentRegistrySection />
              <WorkflowTerminal />
            </div>
          )}

          {activeSection === "databank" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">Asset Databank &amp; Document OCR</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Upload invoices to extract structured fields and inject them into a workflow
                </p>
              </div>
              <DatabankView />
              {/* The terminal is rendered here so "Inject Into Form / Workflow"
                  has a mounted PromptInput to populate, and the operator sees
                  the result land without changing section. */}
              <div>
                <h2 className="text-base font-semibold text-zinc-200 mb-4">
                  Workflow Orchestration Terminal
                </h2>
                <WorkflowTerminal />
              </div>
            </div>
          )}

          {activeSection === "analytics" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">System Analytics</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Token usage, cost breakdown, and routing efficiency
                </p>
              </div>
              <SystemAnalytics />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
