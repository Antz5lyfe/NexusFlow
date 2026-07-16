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
import { AgentConsole } from "@/components/console/AgentConsole";
import { DatabankView } from "@/components/databank/DatabankView";

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [workflowCount, setWorkflowCount] = useState(0);
  const [hasPendingApproval, setHasPendingApproval] = useState(false);

  function handleSectionChange(s: NavSection) {
    setActiveSection(s);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Sidebar active={activeSection} onChange={handleSectionChange} />

      {/* Main content — offset by sidebar width */}
      <div className="ml-60 flex flex-col min-h-screen">
        <TopBar section={activeSection} pendingApproval={hasPendingApproval} />

        <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
          {activeSection === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Overview</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Live metrics for your agents
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <MetricsGrid workflowCount={workflowCount} />
              <AgentRegistrySection />
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Workflow Terminal
                </h2>
                <WorkflowTerminal />
              </div>
            </div>
          )}

          {activeSection === "sales" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Sales Agent</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Qualifies incoming leads
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
                  <h1 className="text-xl font-bold text-gray-900">Finance Agent</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Generates invoices and flags large ones for approval
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <FinanceWorkspace />
              <AgentRegistrySection />
              <WorkflowTerminal />
            </div>
          )}

          {activeSection === "console" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Agent Console</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Run any agent directly — optionally attach a PDF
                  </p>
                </div>
                <DeployAgentModal />
              </div>
              <AgentConsole />
              <AgentRegistrySection />
            </div>
          )}

          {activeSection === "databank" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Asset Databank &amp; Document OCR</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Upload invoices to extract structured fields and inject them into a workflow
                </p>
              </div>
              <DatabankView />
              {/* The terminal is rendered here so "Inject Into Form / Workflow"
                  has a mounted PromptInput to populate, and the operator sees
                  the result land without changing section. */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Workflow Orchestration Terminal
                </h2>
                <WorkflowTerminal />
              </div>
            </div>
          )}

          {activeSection === "analytics" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Usage and cost breakdown
                </p>
              </div>
              <SystemAnalytics />
            </div>
          )}        </main>
      </div>
    </div>
  );
}
