"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApprovalRequest } from "@/lib/api";

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  HIGH: "bg-amber-50 text-amber-800 border-amber-200",
  CRITICAL: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function ApprovalsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadApprovals = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getApprovals(companyId);
      setApprovals(res.approvals || []);
    } catch (err) {
      console.warn("Approvals API error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [companyId]);

  const handleApprove = async (approvalId: string) => {
    if (!companyId) return;
    setActionLoadingId(approvalId);
    try {
      await api.approveAction(companyId, approvalId);
      await loadApprovals();
    } catch (err: any) {
      alert(`Approval failed: ${err?.message || "Error approving request"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (!companyId) return;
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setActionLoadingId(approvalId);
    try {
      await api.rejectAction(companyId, approvalId, reason);
      await loadApprovals();
    } catch (err: any) {
      alert(`Rejection failed: ${err?.message || "Error rejecting request"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Governance & Approval Center</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {approvals.length} action request{approvals.length !== 1 ? "s" : ""} pending review in {activeCompany?.name || "Your Workspace"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 p-12 text-center text-xs font-mono text-slate-400">
          Loading approval requests...
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 text-center space-y-2">
          <div className="text-2xl">✅</div>
          <div className="text-sm font-bold text-slate-900 font-mono uppercase">All Cleared</div>
          <p className="text-xs font-mono text-slate-500">No pending action approvals require your sign-off.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white border border-slate-200 overflow-hidden space-y-4 p-5">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{approval.actionName}</h3>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${RISK_STYLES[approval.riskLevel] || "bg-amber-50 text-amber-800 border-amber-200"}`}>
                      {approval.riskLevel} RISK
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Tool: <strong className="text-slate-800">{approval.toolName}</strong> • Employee: <strong className="text-slate-800">{approval.employee?.name || "AI Agent"}</strong>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${approval.status === "PENDING" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                  ● {approval.status}
                </span>
              </div>

              {/* Risk reason */}
              {approval.riskReason && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 text-xs font-mono text-amber-900 leading-relaxed">
                  ⚠️ <strong className="font-bold">Risk Reason:</strong> {approval.riskReason}
                </div>
              )}

              {/* Proposed parameters */}
              {approval.proposedParams && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Proposed Parameters
                  </span>
                  <pre className="text-xs font-mono bg-slate-50 p-3 border border-slate-200 text-slate-800 overflow-x-auto leading-relaxed">
                    {approval.proposedParams}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              {approval.status === "PENDING" && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={actionLoadingId === approval.id}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoadingId === approval.id ? "Approving..." : "✓ Approve Action"}
                  </button>
                  <button
                    onClick={() => handleReject(approval.id)}
                    disabled={actionLoadingId === approval.id}
                    className="px-5 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-mono text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    ✕ Reject Action
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
