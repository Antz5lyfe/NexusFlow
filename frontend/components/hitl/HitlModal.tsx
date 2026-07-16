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
        className="bg-white border-amber-300 max-w-md shadow-2xl"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-lg border border-amber-200 pointer-events-none" />

        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {/* Animated pulse ring */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping" />
            </div>
            <div>
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 bg-amber-50 text-[10px] mb-1"
              >
                NEEDS APPROVAL
              </Badge>
              <DialogTitle className="text-gray-900 text-base leading-none">
                Large Invoice
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-gray-600 text-sm leading-relaxed">
            This invoice is over{" "}
            <span className="text-amber-700 font-semibold">
              ${context?.threshold_usd?.toLocaleString() ?? "1,000"}
            </span>
            . Review it before it goes out.
          </DialogDescription>
        </DialogHeader>

        {/* Invoice details */}
        {context && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2.5 my-1">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">
                Summary
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
                <span className="text-xs text-gray-500">{label}</span>
                <span
                  className={`text-xs font-semibold ${
                    highlight ? "text-amber-700" : "text-gray-900"
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
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-all"
            onClick={handleTerminate}
            disabled={!!loading}
          >
            {loading === "terminate" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                Rejecting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </span>
            )}
          </Button>

          {/* Approve */}
          <Button
            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-900/20 transition-all"
            onClick={handleApprove}
            disabled={!!loading}
          >
            {loading === "approve" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Approving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
