"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExecStatus =
  | "QUEUED" | "PLANNING" | "WAITING_FOR_AUTHORITY" | "WAITING_FOR_APPROVAL"
  | "EXECUTING" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELLED";

type Execution = {
  id: string;
  status: ExecStatus;
  triggerSource: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  stepLog?: ExecutionStep[];
  result?: unknown;
};

type ExecutionStep = {
  step: number;
  state: string;
  timestamp: string;
  details: string;
  toolCall?: {
    toolName: string;
    args?: Record<string, unknown>;
    result?: unknown;
    approvalId?: string;
  };
};

type Schedule = {
  id: string;
  name: string;
  triggerType: string;
  cronExpression?: string;
  intervalMs?: number;
  taskType: string;
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
};

type Commitment = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  completedAt?: string;
  source: string;
};

type RuntimeTrigger = {
  id: string;
  name: string;
  triggerType: string;
  source?: string;
  eventType?: string;
  enabled: boolean;
  priority: number;
};

type RuntimeAction = {
  id: string;
  name: string;
  toolName: string;
  riskLevel: string;
  requiresApproval: boolean;
  enabled: boolean;
};

type CompiledState = {
  relevantEvents: string[];
  availableActions: string[];
  approvalRequirements: string[];
  compiledAt: string;
  connectedProviders: string[];
};

type CloneStatus = {
  cloneId: string;
  name: string;
  role: string;
  status: string;
  activeExecution?: { id: string; status: string; triggerSource: string; startedAt: string } | null;
  openCommitments: number;
  openEscalations: number;
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
    OPEN: "bg-slate-100 text-slate-600 border-slate-200",
    IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
    BLOCKED: "bg-orange-100 text-orange-700 border-orange-200",
    OVERDUE: "bg-red-100 text-red-700 border-red-200",
  };
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function priorityColor(p: string): string {
  const map: Record<string, string> = {
    URGENT: "text-red-600 bg-red-50 border-red-200",
    HIGH: "text-orange-600 bg-orange-50 border-orange-200",
    MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
    LOW: "text-slate-500 bg-slate-50 border-slate-200",
  };
  return map[p] || "text-slate-500 bg-slate-50 border-slate-200";
}

function relativeTime(ts?: string): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

function absoluteTime(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function riskColor(r: string): string {
  const map: Record<string, string> = {
    CRITICAL: "text-red-600 bg-red-50",
    HIGH: "text-orange-600 bg-orange-50",
    MEDIUM: "text-amber-600 bg-amber-50",
    LOW: "text-emerald-600 bg-emerald-50",
  };
  return map[r] || "text-slate-500 bg-slate-50";
}

// ─── Step Log ─────────────────────────────────────────────────────────────────

function StepLog({ steps }: { steps: ExecutionStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step) => (
        <div key={step.step} className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-6 h-6 flex items-center justify-center text-[10px] font-mono font-bold border ${statusColor(step.state)}`}>
              {step.step}
            </div>
            <div className="w-px flex-1 bg-slate-100 mt-1" />
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusColor(step.state)}`}>
                {step.state.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{relativeTime(step.timestamp)}</span>
            </div>
            <p className="text-[12px] text-slate-700 leading-relaxed">{step.details}</p>
            {step.toolCall && (
              <div className="mt-2 bg-slate-50 border border-slate-200 p-2 text-[11px] font-mono">
                <div className="text-slate-500 mb-1">
                  <span className="font-bold text-slate-700">{step.toolCall.toolName}</span>
                  {step.toolCall.args && (
                    <span className="text-slate-400 ml-2">{JSON.stringify(step.toolCall.args).slice(0, 80)}</span>
                  )}
                </div>
                {(step.toolCall as any).result != null && (
                  <div className="text-emerald-700 truncate">
                    {"->"} {String(typeof (step.toolCall as any).result === "string"
                      ? ((step.toolCall as any).result as string).slice(0, 120)
                      : JSON.stringify((step.toolCall as any).result).slice(0, 120))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = "executions" | "schedules" | "commitments" | "runtime";

export default function CloneRuntimePage() {
  const params = useParams();
  const cloneId = params.cloneId as string;
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [tab, setTab] = useState<TabId>("executions");
  const [cloneStatus, setCloneStatus] = useState<CloneStatus | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [compiledState, setCompiledState] = useState<CompiledState | null>(null);
  const [triggers, setTriggers] = useState<RuntimeTrigger[]>([]);
  const [actions, setActions] = useState<RuntimeAction[]>([]);
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [waking, setWaking] = useState(false);
  const [wakeReason, setWakeReason] = useState("");

  const base = companyId ? `${API_BASE}/companies/${companyId}/runtime` : "";

  const fetchAll = useCallback(async () => {
    if (!companyId || !cloneId) return;
    try {
      const [statusRes, execRes, schedRes, commitRes, runtimeRes] = await Promise.all([
        fetch(`${base}/clones/${cloneId}/status`, { credentials: "include" }),
        fetch(`${base}/clones/${cloneId}/executions?limit=20`, { credentials: "include" }),
        fetch(`${base}/clones/${cloneId}/schedules`, { credentials: "include" }),
        fetch(`${base}/clones/${cloneId}/commitments`, { credentials: "include" }),
        fetch(`${base}/clones/${cloneId}/runtime`, { credentials: "include" }),
      ]);

      const [s, e, sc, c, r] = await Promise.all([
        statusRes.json(), execRes.json(), schedRes.json(), commitRes.json(), runtimeRes.json(),
      ]);

      if (s.success) setCloneStatus(s.data);
      if (e.success) setExecutions(e.data.executions || []);
      if (sc.success) setSchedules(sc.data.schedules || []);
      if (c.success) setCommitments(c.data.commitments || []);
      if (r.success) {
        setCompiledState(r.data.state);
        setTriggers(r.data.triggers || []);
        setActions(r.data.actions || []);
      }
    } catch {/* silent */} finally {
      setLoading(false);
    }
  }, [companyId, cloneId, base]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function loadExecution(execId: string) {
    const res = await fetch(`${base}/executions/${execId}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setSelectedExec(data.data.execution);
  }

  async function compile() {
    if (!companyId) return;
    setCompiling(true);
    try {
      const res = await fetch(`${base}/clones/${cloneId}/compile`, {
        method: "POST", credentials: "include",
      });
      await res.json();
      fetchAll();
    } finally {
      setCompiling(false);
    }
  }

  async function triggerSchedule(scheduleId: string) {
    await fetch(`${base}/schedules/${scheduleId}/trigger`, {
      method: "POST", credentials: "include",
    });
    fetchAll();
  }

  async function wakeClone() {
    if (!wakeReason.trim()) return;
    setWaking(true);
    try {
      await fetch(`${base}/clones/${cloneId}/wake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: wakeReason, trigger: { kind: "MANUAL" } }),
      });
      setWakeReason("");
      fetchAll();
    } finally {
      setWaking(false);
    }
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "executions", label: "Executions", count: executions.length },
    { id: "schedules", label: "Schedules", count: schedules.length },
    { id: "commitments", label: "Commitments", count: commitments.filter((c) => ["OPEN","IN_PROGRESS","BLOCKED","OVERDUE"].includes(c.status)).length },
    { id: "runtime", label: "Compiled Runtime" },
  ];

  if (!companyId) return <div className="p-8 text-slate-400 text-sm">No workspace selected.</div>;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">

      {/* ── Back + Header ──────────────────────────────────────────────────── */}
      <div>
        <Link href="/runtime" className="text-[11px] text-slate-400 hover:text-slate-600 font-mono flex items-center gap-1 mb-3">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Runtime Dashboard
        </Link>

        {cloneStatus ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 text-white text-[15px] font-bold font-mono flex items-center justify-center">
                {cloneStatus.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{cloneStatus.name}</h1>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${statusColor(cloneStatus.status)}`}>
                    {cloneStatus.status}
                  </span>
                </div>
                <div className="text-[12px] text-slate-500 font-medium mt-0.5">{cloneStatus.role}</div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                  {cloneStatus.openCommitments > 0 && (
                    <span className="text-amber-600">{cloneStatus.openCommitments} open commitments</span>
                  )}
                  {cloneStatus.openEscalations > 0 && (
                    <span className="text-red-600">{cloneStatus.openEscalations} escalations</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={compile}
                disabled={compiling}
                className="h-8 px-3 border border-slate-200 text-slate-700 text-[12px] font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {compiling ? "Compiling…" : "Re-compile Runtime"}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="h-12 bg-slate-100 animate-pulse w-64" />
        ) : (
          <p className="text-slate-400 text-sm">Clone not found.</p>
        )}
      </div>

      {/* ── Active Execution Banner ───────────────────────────────────────── */}
      {cloneStatus?.activeExecution && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-blue-800">Currently executing: </span>
            <span className="text-[12px] text-blue-700 font-mono">{cloneStatus.activeExecution.triggerSource}</span>
          </div>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusColor(cloneStatus.activeExecution.status)}`}>
            {cloneStatus.activeExecution.status.replace(/_/g, " ")}
          </span>
          <button
            onClick={() => loadExecution(cloneStatus.activeExecution!.id).then(() => setTab("executions"))}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium shrink-0"
          >
            View →
          </button>
        </div>
      )}

      {/* ── Manual Wake ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 p-4 flex items-center gap-3">
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <input
          type="text"
          placeholder={`Wake ${cloneStatus?.name || "Clone"} with a reason…`}
          value={wakeReason}
          onChange={(e) => setWakeReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && wakeClone()}
          className="flex-1 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none font-mono"
        />
        <button
          onClick={wakeClone}
          disabled={waking || !wakeReason.trim()}
          className="h-7 px-3 bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {waking ? "Waking…" : "Wake"}
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex gap-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[12px] font-semibold flex items-center gap-1.5 border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="text-[10px] bg-slate-200 text-slate-600 font-mono px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Executions Tab ───────────────────────────────────────────────── */}
      {tab === "executions" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 divide-y divide-slate-100">
              {executions.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-slate-400">No executions yet.</div>
              ) : (
                executions.map((exec) => (
                  <button
                    key={exec.id}
                    onClick={() => { setSelectedExec(exec); loadExecution(exec.id); }}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedExec?.id === exec.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusColor(exec.status)}`}>
                        {exec.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{relativeTime(exec.startedAt)}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 truncate">{exec.triggerSource}</div>
                    {exec.error && (
                      <div className="text-[10px] text-red-500 mt-1 truncate">{exec.error}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedExec ? (
              <div className="bg-white border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 border ${statusColor(selectedExec.status)}`}>
                        {selectedExec.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{selectedExec.id.slice(-8)}</span>
                    </div>
                    <div className="text-[12px] font-mono text-slate-600 mt-1">{selectedExec.triggerSource}</div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-mono">
                    <div>Start: {absoluteTime(selectedExec.startedAt)}</div>
                    {selectedExec.completedAt && <div>End: {absoluteTime(selectedExec.completedAt)}</div>}
                  </div>
                </div>

                {selectedExec.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 mb-3">
                    Error: {selectedExec.error}
                  </div>
                )}

                {selectedExec.stepLog && selectedExec.stepLog.length > 0 ? (
                  <StepLog steps={selectedExec.stepLog} />
                ) : (
                  <p className="text-[12px] text-slate-400">No step log available.</p>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-8 flex items-center justify-center h-full">
                <p className="text-[12px] text-slate-400">Select an execution to view its step log.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Schedules Tab ────────────────────────────────────────────────── */}
      {tab === "schedules" && (
        <div className="bg-white border border-slate-200 divide-y divide-slate-100">
          {schedules.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-slate-400">
              No schedules. Compile this Clone's runtime first.
            </div>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-800">{s.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                    <span className="bg-slate-100 px-1.5 py-0.5 text-slate-500">{s.triggerType}</span>
                    {s.cronExpression && <span>{s.cronExpression}</span>}
                    {s.intervalMs && <span>every {s.intervalMs / 60000}m</span>}
                    <span className="text-slate-500">task: {s.taskType}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 font-mono">Next: {relativeTime(s.nextRunAt)}</div>
                  {s.lastRunAt && (
                    <div className={`text-[10px] font-mono mt-0.5 ${s.lastRunStatus === "FAILED" ? "text-red-500" : "text-slate-400"}`}>
                      Last: {relativeTime(s.lastRunAt)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${s.enabled ? "bg-emerald-400" : "bg-slate-300"}`} />
                  <button
                    onClick={() => triggerSchedule(s.id)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Trigger
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Commitments Tab ──────────────────────────────────────────────── */}
      {tab === "commitments" && (
        <div className="bg-white border border-slate-200 divide-y divide-slate-100">
          {commitments.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-slate-400">No commitments.</div>
          ) : (
            commitments.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-800">{c.title}</div>
                  {c.description && (
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{c.description}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                    <span>Source: {c.source}</span>
                    {c.dueAt && <span>Due: {absoluteTime(c.dueAt)}</span>}
                    {c.completedAt && <span className="text-emerald-600">Completed: {relativeTime(c.completedAt)}</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${priorityColor(c.priority)}`}>
                  {c.priority}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Compiled Runtime Tab ──────────────────────────────────────────── */}
      {tab === "runtime" && (
        <div className="space-y-4">
          {!compiledState ? (
            <div className="bg-white border border-slate-200 px-4 py-8 text-center">
              <p className="text-[12px] text-slate-400 mb-3">No compiled runtime found.</p>
              <button
                onClick={compile}
                disabled={compiling}
                className="px-4 py-2 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 disabled:opacity-60"
              >
                {compiling ? "Compiling…" : "Compile Runtime Now"}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 p-4 text-[11px] text-slate-500 font-mono flex items-center justify-between">
                <span>Compiled: {absoluteTime(compiledState.compiledAt)}</span>
                <span>Connected: [{compiledState.connectedProviders.join(", ") || "none"}]</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Relevant Events */}
                <div className="bg-white border border-slate-200 p-4">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Relevant Events ({compiledState.relevantEvents.length})
                  </h3>
                  <div className="space-y-1">
                    {compiledState.relevantEvents.length === 0 ? (
                      <p className="text-[11px] text-slate-400">None — connect integrations and assign permissions.</p>
                    ) : (
                      compiledState.relevantEvents.map((e) => (
                        <div key={e} className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-1 border border-slate-100">
                          {e}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Actions */}
                <div className="bg-white border border-slate-200 p-4">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Available Actions ({actions.length})
                  </h3>
                  <div className="space-y-1">
                    {actions.length === 0 ? (
                      <p className="text-[11px] text-slate-400">None — assign tool permissions to this Clone.</p>
                    ) : (
                      actions.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 border border-slate-100">
                          <span className="font-mono text-slate-700 truncate">{a.toolName}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[9px] font-bold px-1 py-0.5 ${riskColor(a.riskLevel)}`}>{a.riskLevel}</span>
                            {a.requiresApproval && (
                              <span className="text-[9px] font-bold px-1 py-0.5 bg-amber-50 text-amber-600">APPROVAL</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Active Triggers */}
                <div className="bg-white border border-slate-200 p-4">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Event Triggers ({triggers.length})
                  </h3>
                  <div className="space-y-1">
                    {triggers.length === 0 ? (
                      <p className="text-[11px] text-slate-400">None.</p>
                    ) : (
                      triggers.slice(0, 20).map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-[11px] bg-slate-50 px-2 py-1 border border-slate-100">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.enabled ? "bg-emerald-400" : "bg-slate-300"}`} />
                          <span className="font-mono text-slate-600 truncate">
                            {t.source}.{t.eventType}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
