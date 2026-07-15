"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HitlContext } from "@/lib/types";
import { AlertTriangle, CheckCircle2, XCircle, Shield } from "lucide-react";
import { useState } from "react";

interface HitlModalProps {
  open: boolean;
  context: HitlContext | null;
  onApprove: (note: string) => void;
  onTerminate: (note: string) => void;
}

export function HitlModal({
  open,
  context,
  onApprove,
  onTerminate,
}: HitlModalProps) {
  const [loading, setLoading] = useState<"approve" | "terminate" | null>(null);

  async function handleApprove() {
    setLoading("approve");
    await onApprove("Approved via NexusFlow dashboard.");
    setLoading(null);
  }

  async function handleTerminate() {
    setLoading("terminate");
    await onTerminate("Rejected by operator — risk threshold exceeded.");
    setLoading(null);
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="bg-zinc-900 border-amber-500/30 max-w-md shadow-2xl shadow-amber-900/20"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-lg border border-amber-500/20 pointer-events-none" />

        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {/* Animated pulse ring */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <span className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-ping" />
            </div>
            <div>
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-400 bg-amber-500/10 text-[10px] mb-1"
              >
                HITL GATE · SUSPENDED
              </Badge>
              <DialogTitle className="text-white text-base leading-none">
                High-Value Transaction Detected
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-zinc-400 text-sm leading-relaxed">
            The Finance Engine has generated an invoice exceeding the{" "}
            <span className="text-amber-400 font-semibold">
              ${context?.threshold_usd?.toLocaleString() ?? "1,000"}
            </span>{" "}
            corporate sign-off threshold. LangGraph execution is suspended
            pending your authorisation.
          </DialogDescription>
        </DialogHeader>

        {/* Invoice details */}
        {context && (
          <div className="bg-zinc-800/60 rounded-lg border border-zinc-700/50 p-4 space-y-2.5 my-1">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
                Transaction Summary
              </span>
            </div>
            {[
              { label: "Client", value: context.company },
              { label: "Invoice #", value: context.invoice_number },
              {
                label: "Total Amount",
                value: `$${context.amount_usd?.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`,
                highlight: true,
              },
              { label: "Trigger", value: context.reason?.replace(/_/g, " ") },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">{label}</span>
                <span
                  className={`text-xs font-semibold ${
                    highlight ? "text-amber-400" : "text-zinc-200"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex gap-3 sm:flex-row">
          {/* Terminate */}
          <Button
            variant="outline"
            className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-300 transition-all"
            onClick={handleTerminate}
            disabled={!!loading}
          >
            {loading === "terminate" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-red-400/50 border-t-red-400 rounded-full animate-spin" />
                Terminating...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Terminate Run
              </span>
            )}
          </Button>

          {/* Approve */}
          <Button
            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-900/30 transition-all"
            onClick={handleApprove}
            disabled={!!loading}
          >
            {loading === "approve" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Resuming graph...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve Handoff
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
