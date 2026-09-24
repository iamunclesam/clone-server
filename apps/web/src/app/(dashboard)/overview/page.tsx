"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import InteractiveWorkflowCanvas from "@/components/InteractiveWorkflowCanvas";
import { useAuth } from "@/lib/auth-context";
import {
  api,
  AIEmployee,
  Task,
  ApprovalRequest,
  ActivityLog,
  ConnectedAccount,
} from "@/lib/api";

export default function OverviewPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [employees, setEmployees] = useState<AIEmployee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [integrations, setIntegrations] = useState<ConnectedAccount[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowOpen, setWorkflowOpen] = useState<boolean>(false);
  const [timeStr, setTimeStr] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real backend data
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [empRes, taskRes, appRes, actRes, intRes] = await Promise.allSettled([
        api.getEmployees(companyId),
        api.getTasks(companyId),
        api.getApprovals(companyId),
        api.getActivity(companyId, 20),
        api.getIntegrations(companyId),
      ]);

      if (empRes.status === "fulfilled") setEmployees(empRes.value.employees || []);
      if (taskRes.status === "fulfilled") setTasks(taskRes.value.tasks || []);
      if (appRes.status === "fulfilled") setApprovals(appRes.value.approvals || []);
      if (actRes.status === "fulfilled") setActivities(actRes.value.activities || []);
      if (intRes.status === "fulfilled") setIntegrations(intRes.value.connections || []);

      if (
        empRes.status === "rejected" &&
        taskRes.status === "rejected" &&
        appRes.status === "rejected"
      ) {
        console.warn("Backend API unavailable or initializing...");
      }
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setError("Unable to sync with live API. Retrying connection...");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  // Initial load & 10s auto-polling loop
  useEffect(() => {
    loadDashboardData(false);
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Pause / Resume Employee Action
  const handleToggleEmployeeStatus = async (employee: AIEmployee) => {
    if (!companyId) return;
    setActionLoadingId(employee.id);
    try {
      if (employee.status === "PAUSED") {
        await api.resumeEmployee(companyId, employee.id);
      } else {
        await api.pauseEmployee(companyId, employee.id);
      }
      await loadDashboardData(true);
    } catch (err: any) {
      alert(`Action failed: ${err?.message || "Error updating employee"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Approve Request Action
  const handleApprove = async (approvalId: string) => {
    if (!companyId) return;
    setActionLoadingId(approvalId);
    try {
      await api.approveAction(companyId, approvalId);
      await loadDashboardData(true);
    } catch (err: any) {
      alert(`Approval failed: ${err?.message || "Error approving request"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Request Action
  const handleReject = async (approvalId: string) => {
    if (!companyId) return;
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setActionLoadingId(approvalId);
    try {
      await api.rejectAction(companyId, approvalId, reason);
      await loadDashboardData(true);
    } catch (err: any) {
      alert(`Rejection failed: ${err?.message || "Error rejecting request"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Dynamically computed metrics
  const activeEmployeesCount = employees.filter((e) => e.status !== "PAUSED").length;
  const runningTasksCount = tasks.filter((t) => ["IN_PROGRESS", "PENDING"].includes(t.status)).length;
  const pendingApprovalsCount = approvals.filter((a) => a.status === "PENDING").length;
  const activeIntegrationsCount = integrations.filter((i) => i.status === "CONNECTED").length;

  const isEmptyState = !loading && employees.length === 0;

  const STAT_TILES = [
    {
      id: "agents",
      label: "AI Employees",
      value: String(employees.length || 0),
      note: `${activeEmployeesCount} currently active`,
      accent: "#2563eb",
      tag: "WORKFORCE",
    },
    {
      id: "tasks",
      label: "Tasks Executing",
      value: String(runningTasksCount || 0),
      note: `${tasks.length} total assigned`,
      accent: "#7c3aed",
      tag: "EXECUTION",
    },
    {
      id: "approvals",
      label: "Pending Actions",
      value: String(pendingApprovalsCount || 0),
      note: pendingApprovalsCount > 0 ? "Requires sign-off" : "All cleared",
      accent: pendingApprovalsCount > 0 ? "#d97706" : "#059669",
      tag: "GOVERNANCE",
      href: "/approvals",
      urgent: pendingApprovalsCount > 0,
    },
    {
      id: "integrations",
      label: "Tool Connections",
      value: String(integrations.length || 0),
      note: `${activeIntegrationsCount} active tokens`,
      accent: "#059669",
      tag: "INTEGRATIONS",
    },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* ─── TOP BAR ───────────────────────────────────────────────────────── */}
     
      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={() => loadDashboardData(false)}
            className="px-2 py-1 bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* ─── STAT TILES GRID ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_TILES.map((tile) => {
          const content = (
            <div
              key={tile.id}
              className={`bg-white border p-4 transition-all relative ${
                tile.urgent
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  {tile.tag}
                </span>
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: tile.accent }}
                />
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                {loading ? <span className="opacity-30">...</span> : tile.value}
              </div>
              <div className="text-[12px] font-medium text-slate-600 mt-0.5">
                {tile.label}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>{tile.note}</span>
                {tile.urgent && <span className="text-amber-600 font-bold">ACTION</span>}
              </div>
            </div>
          );

          return tile.href ? (
            <Link key={tile.id} href={tile.href}>
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>

      {/* ─── ZERO DATA ONBOARDING BANNER (SHOWS ONLY WHEN NO EMPLOYEES/DATA EXIST) ────── */}
      {isEmptyState ? (
        <div className="bg-white border border-slate-200 p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
            
              <h2 className="text-xl font-bold text-slate-900">
                Set Up {activeCompany?.name || "Your Workspace"} AI Workforce
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Get started by deploying your first specialized AI employee or linking your organization's tools to automate technical tasks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Hire Employee */}
            <div className="p-6 border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-5 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">1. Hire & Deploy AI Employee</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Deploy roles like AI CTO, Support Agent, SDR, or CMO with system prompts, permissions, and spend caps.
                  </p>
                </div>
              </div>
              <Link
                href="/employees/new"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold text-center transition-colors block"
              >
                + Deploy Employee →
              </Link>
            </div>

            {/* Card 2: Connect Tools */}
            <div className="p-6 border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-5 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">2. Connect Application Tools</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Grant secure OAuth permissions to GitHub repositories, Slack, Linear, Notion, or Gmail for task execution.
                  </p>
                </div>
              </div>
              <Link
                href="/integrations"
                className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold text-center transition-colors block"
              >
                Connect App Tools →
              </Link>
            </div>

            {/* Card 3: Dispatch Task */}
            <div className="p-6 border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-5 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">3. Dispatch First Directive</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Assign a natural prompt directive with safety thresholds and approval sign-off requirements.
                  </p>
                </div>
              </div>
              <Link
                href="/tasks/new"
                className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold text-center transition-colors block"
              >
                Dispatch Task →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* ─── DATA SECTIONS (RENDERED ONLY WHEN DATA EXISTS) ───────────────── */
        <>
          {/* ─── MAIN TWO-COLUMN SECTION ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT (2 Cols): AI Employees Workforce */}
            <div className="lg:col-span-2 bg-white border border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                    Active AI Employees ({employees.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live status and active tasks in {activeCompany?.name || "Your Workspace"}
                  </p>
                </div>
                <Link
                  href="/employees"
                  className="text-xs font-mono text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Manage All →
                </Link>
              </div>

              <div className="divide-y divide-slate-100 flex-1">
                {employees.map((emp) => {
                  const isPaused = emp.status === "PAUSED";
                  const assignedTasks = tasks.filter((t) => t.assignedEmployee?.id === emp.id);
                  const currentTask = assignedTasks[0]?.title || emp.shortDescription || "Available for tasks";

                  return (
                    <div
                      key={emp.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-slate-900 text-white flex items-center justify-center text-xs font-mono font-bold shrink-0">
                          {emp.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {emp.name}
                            </h3>
                            <span className="text-[11px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200">
                              {emp.role}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 truncate mt-1">
                            <span className="font-mono text-[11px] text-slate-400 mr-1">
                              TASK:
                            </span>
                            {currentTask}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                            isPaused
                              ? "bg-slate-100 text-slate-500 border-slate-200"
                              : emp.status === "WORKING"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          ● {emp.status}
                        </span>

                        <button
                          onClick={() => handleToggleEmployeeStatus(emp)}
                          disabled={actionLoadingId === emp.id}
                          className="text-[11px] font-mono px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === emp.id
                            ? "..."
                            : isPaused
                            ? "Resume"
                            : "Pause"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT (1 Col): Activity Stream & Pending Approvals */}
            <div className="space-y-6">
              {/* Pending Approvals Card */}
              {pendingApprovalsCount > 0 && (
                <div className="bg-amber-50/50 border border-amber-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-900 uppercase">
                      ⚠️ Action Approvals ({pendingApprovalsCount})
                    </span>
                    <span className="text-[10px] font-mono text-amber-700">HIGH RISK</span>
                  </div>

                  <div className="space-y-2">
                    {approvals
                      .filter((a) => a.status === "PENDING")
                      .map((app) => (
                        <div key={app.id} className="p-3 bg-white border border-amber-200 text-xs space-y-2">
                          <div className="font-semibold text-slate-900">
                            {app.actionName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Tool: <span className="text-slate-800 font-bold">{app.toolName}</span>
                          </div>
                          {app.riskReason && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 border border-amber-100">
                              {app.riskReason}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleApprove(app.id)}
                              disabled={actionLoadingId === app.id}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[11px] font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(app.id)}
                              disabled={actionLoadingId === app.id}
                              className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-mono text-[11px] font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Activity Stream */}
              <div className="bg-white border border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                    Live Audit Stream
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400">
                    REAL-TIME
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {activities.map((act) => (
                    <div key={act.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{act.actorName}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {act.createdAt ? new Date(act.createdAt).toLocaleTimeString() : "Just now"}
                        </span>
                      </div>
                      <p className="text-slate-600 font-mono text-[11px]">
                        <span className="text-blue-600 font-bold">{act.action}</span>{" "}
                        {act.resource}
                      </p>
                      {act.details && (
                        <p className="text-[10px] text-slate-400 truncate">{act.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── TOOL CONNECTIONS & CANVAS STRIP ──────────────────────────────── */}
          <div className="bg-white border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Connected Tool Integrations ({integrations.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Active OAuth connections used by AI Employees
                </p>
              </div>
              <Link
                href="/integrations"
                className="text-xs font-mono text-blue-600 hover:text-blue-700 font-semibold"
              >
                + Connect Tool →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {integrations.map((conn) => (
                <div
                  key={conn.id}
                  className="p-3 border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-900 font-mono">
                      {conn.provider}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate mt-2">
                    {conn.accountName || conn.accountEmail || "Active"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── WORKFLOW CANVAS COLLAPSIBLE STRIP ───────────────────────────── */}
          <div className="bg-white border border-slate-200">
            <button
              onClick={() => setWorkflowOpen(!workflowOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-blue-600" />
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                    Interactive Multi-Agent Execution Canvas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Visual node orchestration trace & system output terminal
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1">
                {workflowOpen ? "▲ Collapse Canvas" : "▼ Expand Canvas"}
              </span>
            </button>

            {workflowOpen && (
              <div className="border-t border-slate-200 p-4 bg-slate-50/50">
                <InteractiveWorkflowCanvas />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
