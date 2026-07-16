"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadZone } from "./UploadZone";
import { useAssets } from "@/hooks/useAssets";
import { deleteAsset, reprocessAsset } from "@/lib/api";
import type { AssetStatus, DatabankAssetRecord, ExtractedInvoice } from "@/lib/types";
import {
  Database,
  FileText,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const STATUS_STYLES: Record<AssetStatus, string> = {
  UPLOADED: "border-gray-300 text-gray-500 bg-gray-50",
  PROCESSING: "border-amber-300 text-amber-700 bg-amber-50",
  PARSED: "border-emerald-300 text-emerald-700 bg-emerald-50",
  FAILED: "border-red-300 text-red-700 bg-red-50",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  UPLOADED: "Queued",
  PROCESSING: "Extracting",
  PARSED: "Parsed",
  FAILED: "Failed",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAmount(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  const num = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${num} ${currency}` : num;
}

/**
 * Build the terminal prompt injected into the workflow. Only fields the
 * extractor actually returned are included — a null means "not legible",
 * and inventing a value here would defeat the extractor's caution.
 */
function buildInjectionPrompt(data: ExtractedInvoice, filename: string): string {
  const parts: string[] = [];
  if (data.vendor_name) parts.push(`vendor ${data.vendor_name}`);
  if (data.invoice_id) parts.push(`invoice ${data.invoice_id}`);
  if (data.total_amount !== null) {
    parts.push(`total ${formatAmount(data.total_amount, data.currency)}`);
  }
  if (data.issue_date) parts.push(`issued ${data.issue_date}`);

  if (parts.length === 0) {
    return `Process the document ${filename} — no fields could be extracted.`;
  }
  return `Process invoice from ${parts.join(", ")}.`;
}

function ExtractedFields({ data }: { data: ExtractedInvoice }) {
  const rows: [string, string][] = [
    ["Invoice ID", data.invoice_id ?? "—"],
    ["Vendor", data.vendor_name ?? "—"],
    ["Total", formatAmount(data.total_amount, data.currency)],
    ["Currency", data.currency ?? "—"],
    ["Issue date", data.issue_date ?? "—"],
  ];

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
            <p className="text-[11px] font-semibold text-gray-900 mt-0.5 break-words">{value}</p>
          </div>
        ))}
      </div>

      {data.line_items.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">
            Line items ({data.line_items.length})
          </p>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-white text-gray-500">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5">Description</th>
                  <th className="text-right font-medium px-2 py-1.5">Qty</th>
                  <th className="text-right font-medium px-2 py-1.5">Unit</th>
                  <th className="text-right font-medium px-2 py-1.5">Amount</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {data.line_items.map((li, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-2 py-1.5">{li.description || "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{li.quantity ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{li.unit_price ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{li.amount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="group">
        <summary className="text-[10px] text-gray-500 hover:text-gray-700 cursor-pointer select-none">
          Raw JSON payload
        </summary>
        <pre className="mt-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200 text-[9px] text-violet-700/80 font-mono overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function AssetRow({
  asset,
  onChanged,
}: {
  asset: DatabankAssetRecord;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [injected, setInjected] = useState(false);
  const isBusy = asset.status === "UPLOADED" || asset.status === "PROCESSING";
  const data = asset.extracted_json;

  function handleInject() {
    if (!data) return;
    window.dispatchEvent(
      new CustomEvent("nexusflow:inject-prompt", {
        detail: { prompt: buildInjectionPrompt(data, asset.filename) },
      })
    );
    setInjected(true);
    setTimeout(() => setInjected(false), 2000);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${asset.filename}" and its stored file?`)) return;
    try {
      await deleteAsset(asset.id);
      onChanged();
    } catch (err) {
      console.error("Failed to delete asset:", err);
    }
  }

  async function handleReprocess() {
    try {
      await reprocessAsset(asset.id);
      onChanged();
    } catch (err) {
      console.error("Failed to reprocess asset:", err);
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 transition-colors hover:border-gray-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">{asset.filename}</p>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              {formatBytes(asset.size_bytes)} · {asset.content_type}
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={`text-[10px] px-2 py-0.5 shrink-0 ${STATUS_STYLES[asset.status]}`}
        >
          {STATUS_LABEL[asset.status]}
        </Badge>
      </div>

      {asset.status === "FAILED" && asset.error && (
        <div className="mt-2.5 p-2 rounded-lg bg-red-50 border border-red-200 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-red-700 leading-relaxed break-words">{asset.error}</p>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {asset.status === "PARSED" && data && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen((o) => !o)}
                className="h-7 px-2.5 text-[10px] border-gray-300 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              >
                {open ? (
                  <ChevronDown className="w-3 h-3 mr-1" />
                ) : (
                  <ChevronRight className="w-3 h-3 mr-1" />
                )}
                View Extracted Fields
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleInject}
                className={`h-7 px-2.5 text-[10px] border-0 text-white transition-colors ${
                  injected
                    ? "bg-emerald-600 hover:bg-emerald-600"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                }`}
              >
                {injected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Injected
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 mr-1" />
                    Inject Into Form / Workflow
                  </>
                )}
              </Button>
            </>
          )}
          {asset.status === "FAILED" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              className="h-7 px-2.5 text-[10px] border-gray-300 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry extraction
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
          title="Delete asset"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {open && data && <ExtractedFields data={data} />}
    </div>
  );
}

export function DatabankView() {
  const { assets, loading, reload } = useAssets();
  const parsedCount = assets.filter((a) => a.status === "PARSED").length;

  return (
    <div className="space-y-6">
      <UploadZone onUploaded={reload} />

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-violet-600" />
              <CardTitle className="text-sm font-semibold text-gray-900">
                Knowledge Databank
              </CardTitle>
              <Badge
                variant="outline"
                className="border-violet-300 text-violet-700 text-[10px] bg-violet-50 font-mono"
              >
                {assets.length} Asset{assets.length === 1 ? "" : "s"}
              </Badge>
              {parsedCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 text-[10px] bg-emerald-50 font-mono"
                >
                  {parsedCount} Parsed
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Documents stored in the database with Gemini vision extraction
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              Loading databank…
            </p>
          ) : assets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-500">No documents uploaded yet.</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Drop an invoice above to extract its fields automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} onChanged={reload} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
