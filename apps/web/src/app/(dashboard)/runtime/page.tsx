"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExecStatus =
  | "QUEUED"
  | "PLANNING"
  | "WAITING_FOR_AUTHORITY"
  | "WAITING_FOR_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type CloneStatus = {
  cloneId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  status: string;
  currentTask?: string;
  triggeredBy?: string;
  delegatedTo?: string;
  lastActiveAt?: string;
  activeExecutionId?: string;
};

type RecentEvent = {
  id: string;
  source: string;
  eventType: string;
  createdAt: string;
  processedAt?: string;
};

type RecentExecution = {
  id: string;
  cloneId: string;
  cloneName: string;
  cloneRole: string;
  status: ExecStatus;
  triggerSource: string;
  startedAt?: string;
  completedAt?: string;
};

type DashboardState = {
  activeClones: number;
  runningExecutions: number;
  waitingApprovals: number;
  blockedCommitments: number;
  failedExecutions: number;
  overdueCommitments: number;
  openEscalations: number;
  recentEvents: RecentEvent[];
  recentExecutions: RecentExecution[];
  cloneStatuses: CloneStatus[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    EXECUTING: "bg-blue-100 text-blue-700 border-blue-200",
    PLANNING: "bg-violet-100 text-violet-700 border-violet-200",
    QUEUED: "bg-slate-100 text-slate-600 border-slate-200",
    WAITING_FOR_APPROVAL: "bg-amber-100 text-amber-700 border-amber-200",
    WAITING_FOR_AUTHORITY: "bg-orange-100 text-orange-700 border-orange-200",
    VERIFYING: "bg-cyan-100 text-cyan-700 border-cyan-200",
    CANCELLED: "bg-slate-100 text-slate-400 border-slate-200",
  };
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function cloneStatusDot(status: string): string {
  if (status === "WORKING") return "bg-blue-500 animate-pulse";
  if (status === "ACTIVE") return "bg-emerald-500";
  if (status === "PAUSED") return "bg-slate-300";
  return "bg-slate-300";
}

function relativeTime(ts?: string): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getCloneId(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val.id || val._id?.toString() || val._id || String(val);
  return String(val);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-9 h-9 flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold font-mono text-slate-900 leading-none">{value}</div>
        <div className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

// ─── Ingest Event Modal ───────────────────────────────────────────────────────

function IngestEventModal({
  companyId,
  onClose,
  onSuccess,
}: {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [source, setSource] = useState("sentry");
  const [eventType, setEventType] = useState("incident_created");
  const [payload, setPayload] = useState('{\n  "incidentId": "INC-001",\n  "severity": "critical",\n  "title": "High error rate on checkout API"\n}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PRESETS = [
    { label: "Sentry incident", source: "sentry", eventType: "incident_created", payload: '{\n  "incidentId": "INC-001",\n  "severity": "critical",\n  "title": "High error rate on checkout API"\n}' },
    { label: "GitHub PR opened", source: "github", eventType: "pr_opened", payload: '{\n  "pr": 42,\n  "title": "Fix payment timeout",\n  "repo": "api-core"\n}' },
    { label: "Linear issue overdue", source: "linear", eventType: "issue_overdue", payload: '{\n  "issueId": "ENG-123",\n  "title": "Migrate auth service"\n}' },
    { label: "Vercel deploy failed", source: "vercel", eventType: "deployment_failed", payload: '{\n  "deploymentId": "dpl_xyz",\n  "url": "https://app.vercel.app"\n}' },
    { label: "Gmail email received", source: "gmail", eventType: "message_received", payload: '{\n  "from": "customer@example.com",\n  "subject": "Urgent: payment issue"\n}' },
  ];

  async function submit() {
    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError("Payload must be valid JSON");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/runtime/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source, eventType, payload: parsedPayload }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-slate-200 shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Ingest Runtime Event</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Send an event into the engine — relevant Clones will be woken automatically.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Presets */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">Quick Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setSource(p.source); setEventType(p.eventType); setPayload(p.payload); }}
                  className="text-[11px] px-2.5 py-1 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-medium transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Source (provider)</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border border-slate-200 px-2.5 py-1.5 text-[12px] font-mono text-slate-800 focus:outline-none focus:border-blue-400"
                placeholder="sentry"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Event type</label>
              <input
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full border border-slate-200 px-2.5 py-1.5 text-[12px] font-mono text-slate-800 focus:outline-none focus:border-blue-400"
                placeholder="incident_created"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Payload (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={5}
              className="w-full border border-slate-200 px-2.5 py-1.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-1.5 text-[12px] bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Routing…" : "Route Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RuntimeDashboardPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<string | null>(null);
  const [wakingAll, setWakingAll] = useState(false);
  const [wakeAllResult, setWakeAllResult] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/runtime/dashboard`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setDashboard(data.data);
      else setError(data.error?.message || "Failed to load dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  async function compileAll() {
    if (!companyId) return;
    setCompiling(true);
    setCompileResult(null);
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/runtime/compile-all`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setCompileResult(`Compiled ${data.data.compiled} Clones. ${data.data.failed > 0 ? `${data.data.failed} failed.` : ""}`);
        fetchDashboard();
      }
    } catch {
      setCompileResult("Compile failed");
    } finally {
      setCompiling(false);
    }
  }

  async function wakeAllClones() {
    if (!companyId) return;
    setWakingAll(true);
    setWakeAllResult(null);
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/runtime/wake-all`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setWakeAllResult(`Woken ${data.data.woken} Clones. ${data.data.failed > 0 ? `${data.data.failed} failed.` : ""}`);
        fetchDashboard();
      }
    } catch {
      setWakeAllResult("Wake all failed");
    } finally {
      setWakingAll(false);
    }
  }

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest">Runtime Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Runtime Dashboard</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Live view of Clone execution, events, schedules, commitments, and escalations.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={wakeAllClones}
            disabled={wakingAll}
            className="flex items-center gap-1.5 h-8 px-3 border border-amber-300 bg-amber-50 text-amber-800 text-[12px] font-semibold hover:bg-amber-100 disabled:opacity-60 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {wakingAll ? "Waking All…" : "⚡ Wake All Clones"}
          </button>
          <button
            onClick={compileAll}
            disabled={compiling}
            className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {compiling ? "Compiling…" : "Compile All"}
          </button>
          <button
            onClick={() => setIngestOpen(true)}
            className="flex items-center gap-1.5 h-8 px-4 bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ingest Event
          </button>
        </div>
      </div>

      {wakeAllResult && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-medium px-4 py-2">
          ⚡ {wakeAllResult}
        </div>
      )}

      {compileResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium px-4 py-2">
          ✓ {compileResult}
        </div>
      )}

      {/* ── Loading / Error ───────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 p-5 h-20 animate-pulse rounded-none" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error} — <button onClick={fetchDashboard} className="underline">retry</button>
        </div>
      )}

      {dashboard && (
        <>
          {/* ── Stats Grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Active Clones" value={dashboard.activeClones}
              accent="bg-blue-50 text-blue-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>}
            />
            <StatCard label="Running Executions" value={dashboard.runningExecutions}
              accent="bg-violet-50 text-violet-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <StatCard label="Pending Approvals" value={dashboard.waitingApprovals}
              accent="bg-amber-50 text-amber-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            />
            <StatCard label="Failed Executions" value={dashboard.failedExecutions}
              accent="bg-red-50 text-red-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Overdue Commitments" value={dashboard.overdueCommitments}
              accent="bg-orange-50 text-orange-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" /></svg>}
            />
            <StatCard label="Blocked Commitments" value={dashboard.blockedCommitments}
              accent="bg-slate-100 text-slate-500"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
            />
            <StatCard label="Open Escalations" value={dashboard.openEscalations}
              accent="bg-red-50 text-red-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
            />
            <Link href={`/runtime/executions`} className="bg-white border border-slate-200 p-5 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
              <div className="w-9 h-9 flex items-center justify-center bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-700">All Executions</div>
                <div className="text-[10px] text-slate-400 mt-0.5">View full log →</div>
              </div>
            </Link>
          </div>

          {/* ── Clone Status Grid ────────────────────────────────────────────── */}
          {dashboard.cloneStatuses.length > 0 && (
            <div>
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Clone Status</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboard.cloneStatuses.map((clone) => (
                  <Link
                    key={getCloneId(clone.cloneId)}
                    href={`/runtime/${getCloneId(clone.cloneId)}`}
                    className="bg-white border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {clone.avatarUrl ? (
                          <img src={clone.avatarUrl} alt={clone.name} className="w-9 h-9 object-cover" />
                        ) : (
                          <div className="w-9 h-9 bg-slate-800 text-white text-[12px] font-bold font-mono flex items-center justify-center">
                            {initials(clone.name)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${cloneStatusDot(clone.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-slate-900 truncate">{clone.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{relativeTime(clone.lastActiveAt)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate">{clone.role}</div>
                        {clone.currentTask && (
                          <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 border-l-2 border-blue-400 truncate">
                            {clone.currentTask}
                          </div>
                        )}
                        {clone.status === "WORKING" && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] text-blue-600 font-medium">Working</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Two-column: Recent Events + Executions ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Recent Events */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent Events</h2>
                <button
                  onClick={() => setIngestOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Ingest
                </button>
              </div>
              <div className="bg-white border border-slate-200 divide-y divide-slate-100">
                {dashboard.recentEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-slate-400">
                    No events yet. Ingest an event to activate Clones.
                  </div>
                ) : (
                  dashboard.recentEvents.slice(0, 10).map((event) => (
                    <div key={event.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="w-6 h-6 bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">{event.source.slice(0, 3)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-mono text-slate-700 truncate">
                          {event.source}.{event.eventType}
                        </div>
                        <div className="text-[10px] text-slate-400">{relativeTime(event.createdAt)}</div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${event.processedAt ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} title={event.processedAt ? "Processed" : "Pending"} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Executions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent Executions</h2>
                <Link href={`/runtime/executions`} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                  View all →
                </Link>
              </div>
              <div className="bg-white border border-slate-200 divide-y divide-slate-100">
                {dashboard.recentExecutions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-slate-400">
                    No executions yet.
                  </div>
                ) : (
                  dashboard.recentExecutions.slice(0, 10).map((exec) => (
                    <Link
                      key={exec.id}
                      href={`/runtime/${getCloneId(exec.cloneId)}`}
                      className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-6 h-6 bg-slate-800 text-white text-[9px] font-bold font-mono flex items-center justify-center shrink-0">
                        {initials(exec.cloneName || "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-800 truncate">{exec.cloneName}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{exec.triggerSource}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusColor(exec.status)}`}>
                          {exec.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">{relativeTime(exec.startedAt)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ingest modal */}
      {ingestOpen && (
        <IngestEventModal
          companyId={companyId}
          onClose={() => setIngestOpen(false)}
          onSuccess={fetchDashboard}
        />
      )}
    </div>
  );
}
