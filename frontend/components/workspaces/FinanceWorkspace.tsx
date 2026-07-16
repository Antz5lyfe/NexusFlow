"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentByName } from "@/hooks/useAgents";
import { DollarSign, Shield, AlertTriangle } from "lucide-react";

/** Name of the seeded core node this workspace documents. */
const FINANCE_AGENT_NAME = "Finance Invoice Generator Agent";

export function FinanceWorkspace() {
  const { agent, loading } = useAgentByName(FINANCE_AGENT_NAME);
  const isActive = agent?.is_active ?? false;

  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-sm text-gray-900">{agent?.name ?? FINANCE_AGENT_NAME}</CardTitle>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Model: {agent?.default_model ?? "openai/gpt-4o-mini"}
              </p>
            </div>
            {loading ? (
              <Badge variant="outline" className="ml-auto border-gray-300 text-gray-500 bg-gray-50 text-[11px]">…</Badge>
            ) : (
              <Badge
                variant="outline"
                className={`ml-auto text-[11px] ${
                  isActive
                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                    : "border-gray-300 text-gray-500 bg-gray-50"
                }`}
              >
                {agent === null ? "Not registered" : isActive ? "Active" : "Paused"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Tax Rate", value: "8.0%" },
              { label: "Invoice Format", value: "INV-XXXXXXXX" },
              { label: "Terms", value: "NET-30" },
              { label: "Currency", value: "USD" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* HITL Gate info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-700">
                Approval Required Over $1,000
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Invoices over <span className="text-amber-700 font-semibold">$1,000</span> pause the
              workflow until you approve or reject them.
            </p>
          </div>

          {/* Auth chain */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Authorisation chain</p>
            <div className="space-y-2">
              {[
                { icon: Shield, label: "Invoice generated", note: "8% tax applied automatically" },
                { icon: AlertTriangle, label: "Over $1,000 → needs approval", note: "Progress is saved" },
                { icon: DollarSign, label: "You approve or reject", note: "Workflow resumes" },
              ].map(({ icon: Icon, label, note }, i) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <Icon className="w-3 h-3 text-gray-500" />
                    </div>
                    {i < 2 && <div className="w-px h-5 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-xs font-medium text-gray-900">{label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
