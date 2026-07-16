"use client";

import { useRef, useState } from "react";
import { uploadAsset } from "@/lib/api";
import { UploadCloud, Loader2, FileText } from "lucide-react";

/** Mirrors SUPPORTED_VISION_MIME_TYPES in app/engine/llm_clients.py. */
const ACCEPTED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
];

interface UploadZoneProps {
  onUploaded: () => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dragging over a child element fires dragleave on the parent; counting
  // enter/leave pairs keeps the highlight stable instead of flickering.
  const dragDepth = useRef(0);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);

    const rejected = list.filter((f) => !ACCEPTED.includes(f.type));
    if (rejected.length > 0) {
      setError(
        `${rejected.map((f) => f.name).join(", ")} — unsupported type. Upload a PDF or image.`
      );
    } else {
      setError(null);
    }

    const accepted = list.filter((f) => ACCEPTED.includes(f.type));
    if (accepted.length === 0) return;

    setBusy(true);
    setQueue(accepted.map((f) => f.name));
    try {
      for (const file of accepted) {
        await uploadAsset(file);
        setQueue((q) => q.slice(1));
        // Refresh per file so rows appear as they land, not in one lump.
        onUploaded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      setQueue([]);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
          busy ? "cursor-wait" : "cursor-pointer"
        } ${
          dragging
            ? "border-violet-400 bg-violet-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
            <p className="text-xs font-medium text-gray-800">
              Uploading{queue.length > 1 ? ` — ${queue.length} remaining` : "…"}
            </p>
            {queue[0] && (
              <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
                {queue[0]}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                dragging ? "bg-violet-100 text-violet-700" : "bg-gray-200 text-gray-500"
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {dragging ? "Drop to upload" : "Drag documents here"}
            </p>
            <p className="text-xs text-gray-500">
              or <span className="text-violet-600 font-medium">browse</span> — PDF, PNG, JPEG, WebP
            </p>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" />
              Extraction starts automatically on upload
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
