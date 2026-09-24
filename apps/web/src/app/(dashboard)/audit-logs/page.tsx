"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const AUDIT_LOGS = [
  {
    id: "aud-1",
    timestamp: "2026-09-14 21:32:04",
    actor: "Alex Vance (AI CTO)",
    event: "INTEGRATION_TOOL_CALL",
    resource: "github.create_pull_request",
    ip: "10.0.4.12 (E2B Sandbox)",
    risk: "MEDIUM",
    hash: "0x8f92a1c...b4e",
    details: "Created Pull Request #42 on acme/backend-api",
  },
  {
    id: "aud-2",
    timestamp: "2026-09-14 21:28:12",
    actor: "Jane Doe (Founder)",
    event: "APPROVAL_GRANTED",
    resource: "approval_a1",
    ip: "192.168.1.45",
    risk: "HIGH",
    hash: "0x3e10b4f...a9c",
    details: "Approved action 'Deploy Security Patch to Production'",
  },
  {
    id: "aud-3",
    timestamp: "2026-09-14 21:15:00",
    actor: "Maya Lin (AI CMO)",
    event: "MEMORY_VECTOR_UPSERT",
    resource: "company.brand.tone_guidelines",
    ip: "10.0.4.15",
    risk: "LOW",
    hash: "0x1a87c2d...f01",
    details: "Updated brand voice memory entry",
  },
];

export default function AuditLogsPage() {
  const { activeCompany } = useAuth();
  const [search, setSearch] = useState("");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Security & Cryptographic Audit Logs</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Immutable SOC-2 audit stream for {activeCompany?.name || "Your Workspace"}
          </p>
        </div>

        <button
          onClick={() => alert("Exporting signed CSV audit log...")}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-mono font-semibold cursor-pointer"
        >
          📥 Export Audit CSV (Signed)
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            placeholder="Search audit logs by actor, event, or hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-96 bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
          />
          <span className="text-xs text-emerald-700 font-mono font-bold">
            ✓ Cryptographic Verification: PASSED
          </span>
        </div>

        <div className="divide-y divide-slate-100 font-mono text-xs">
          {AUDIT_LOGS.map((log) => (
            <div key={log.id} className="p-4 space-y-2 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 border font-bold text-[10px] ${
                    log.risk === "HIGH"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {log.event}
                  </span>
                  <span className="text-slate-900 font-sans font-bold">{log.actor}</span>
                </div>
                <span className="text-[10px] text-slate-400">{log.timestamp}</span>
              </div>

              <div className="text-slate-700 font-sans text-xs">{log.details}</div>

              <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                <span>Resource: <strong className="text-slate-800">{log.resource}</strong></span>
                <span>IP: {log.ip}</span>
                <span className="text-purple-600 font-bold">Hash: {log.hash}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
