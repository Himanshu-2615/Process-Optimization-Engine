"use client";

import { useState, useRef } from "react";
import { api, type Process } from "@/lib/api";
import { Upload, Download, AlertCircle, CheckCircle } from "lucide-react";

interface CsvUploadProps {
  onSuccess: (process: Process) => void;
}

const CSV_TEMPLATE = `name,duration_minutes,cost_per_execution,resource_count,sla_limit_minutes,executions_per_day
Request Submission,10,5,2,15,50
Manager Approval,120,50,3,90,50
Finance Approval,90,30,2,120,50
Vendor Allocation,60,20,2,90,50`;

export function CsvUpload({ onSuccess }: CsvUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("Imported Process");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const p = await api.uploadCsv(file, name);
      onSuccess(p);
      setFile(null);
      setSuccess(true);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "process_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".csv")) setFile(dropped);
    else setError("Please drop a .csv file");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 font-semibold text-slate-900">Import CSV Process</h3>
      <p className="mb-4 text-xs text-slate-500">
        Upload a CSV with columns: name, duration_minutes, cost_per_execution, resource_count, sla_limit_minutes, executions_per_day.
        Steps are automatically linked sequentially unless a <code>next_step</code> column is provided.
      </p>

      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">Process Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="e.g. Procurement Approval Process"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`mb-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragging ? "border-indigo-400 bg-indigo-50" : file ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
        <Upload size={20} className={`mb-2 ${file ? "text-emerald-500" : "text-slate-400"}`} />
        {file ? (
          <p className="text-sm font-medium text-emerald-700">{file.name}</p>
        ) : (
          <p className="text-sm text-slate-500">Drop CSV here or <span className="text-indigo-600 underline">browse</span></p>
        )}
        <p className="text-xs text-slate-400 mt-1">.csv files only</p>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle size={14} /> Process imported successfully!
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Upload size={14} />}
          {loading ? "Importing..." : "Import Process"}
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Download size={14} /> Template
        </button>
      </div>
    </div>
  );
}
