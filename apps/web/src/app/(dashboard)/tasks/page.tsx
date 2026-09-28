"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, Task } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING:
    "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS:
    "bg-blue-50 text-blue-700 border-blue-200",
  WAITING_FOR_APPROVAL:
    "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED:
    "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED:
    "bg-slate-100 text-slate-400 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_APPROVAL: "Waiting Approval",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const FILTERS = [
  "All",
  "In Progress",
  "Waiting Approval",
  "Completed",
];

function formatDate(date?: string) {
  if (!date) return "Today";

  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return "Today";
  }
}

function getInitials(name?: string) {
  if (!name) return "?";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getStatusStyle(status?: string) {
  return (
    STATUS_STYLES[status || ""] ||
    "bg-slate-100 text-slate-600 border-slate-200"
  );
}

function getStatusLabel(status?: string) {
  return (
    STATUS_LABELS[status || ""] ||
    status ||
    "Unknown"
  );
}

export default function TasksPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!companyId) {
        if (mounted) {
          setTasks([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await api.getTasks(companyId);

        if (!mounted) return;

        setTasks(
          Array.isArray(res?.tasks)
            ? res.tasks
            : []
        );
      } catch (err: any) {
        console.warn(
          "Tasks API error:",
          err
        );

        if (!mounted) return;

        setTasks([]);
        setError(
          err?.message ||
            "Unable to load tasks right now."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [companyId]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "All") return true;

    if (filter === "In Progress") {
      return t.status === "IN_PROGRESS";
    }

    if (filter === "Waiting Approval") {
      return (
        t.status === "WAITING_FOR_APPROVAL"
      );
    }

    if (filter === "Completed") {
      return t.status === "COMPLETED";
    }

    return (
      t.status === filter.toUpperCase()
    );
  });

  const pendingCount = tasks.filter(
    (t) =>
      t.status === "PENDING" ||
      t.status === "WAITING_FOR_APPROVAL"
  ).length;

  const runningCount = tasks.filter(
    (t) => t.status === "IN_PROGRESS"
  ).length;

  const completedCount = tasks.filter(
    (t) => t.status === "COMPLETED"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 sm:bg-transparent">
      <div className="px-2 py-2 sm:p-6 max-w-[1600px] mx-auto space-y-3 sm:space-y-6 font-sans">

        {/* ─────────────────────────────────────────────────────────────
            HEADER
        ───────────────────────────────────────────────────────────── */}

        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-none p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {/* Mobile icon */}
              

                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                    Task Queue
                  </h1>

                  <p className="text-[11px] sm:text-xs font-mono text-slate-500 mt-0.5">
                    {tasks.length} total task
                    {tasks.length !== 1
                      ? "s"
                      : ""}{" "}
                    across AI Employees
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/tasks/new"
              id="create-task-btn"
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                w-full
                sm:w-auto
                h-10
                px-4
                bg-blue-600
                hover:bg-blue-700
                text-white
                text-xs
                font-semibold
                transition-colors
                cursor-pointer
                rounded-lg
                sm:rounded-none
              "
            >
              <span className="text-base leading-none">
                +
              </span>

              Assign New Task
            </Link>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            MOBILE SUMMARY
        ───────────────────────────────────────────────────────────── */}

        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xl font-bold font-mono text-slate-900">
              {tasks.length}
            </div>

            <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-1">
              Total
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xl font-bold font-mono text-blue-600">
              {runningCount}
            </div>

            <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-1">
              Running
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xl font-bold font-mono text-emerald-600">
              {completedCount}
            </div>

            <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-1">
              Done
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            FILTERS
        ───────────────────────────────────────────────────────────── */}

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center shrink-0 bg-white border border-slate-200 rounded-lg sm:rounded-none overflow-hidden">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-3
                  py-2
                  sm:py-1.5
                  text-[11px]
                  sm:text-xs
                  font-mono
                  font-medium
                  transition-colors
                  cursor-pointer
                  whitespace-nowrap
                  ${
                    filter === f
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }
                `}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="hidden sm:block ml-auto text-[11px] font-mono text-slate-400 whitespace-nowrap">
            {filteredTasks.length} result
            {filteredTasks.length !== 1
              ? "s"
              : ""}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ERROR
        ───────────────────────────────────────────────────────────── */}

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl sm:rounded-none px-4 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              !
            </div>

            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-rose-800">
                Couldn't load tasks
              </p>

              <p className="text-[11px] text-rose-600 mt-0.5">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            DESKTOP TABLE
        ───────────────────────────────────────────────────────────── */}

        <div className="hidden sm:block bg-white border border-slate-200 overflow-hidden">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">
                  Task Title
                </th>

                <th className="px-4 py-3">
                  Assigned Employee
                </th>

                <th className="px-4 py-3">
                  Priority
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Created
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td
                        colSpan={5}
                        className="px-4 py-4"
                      >
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-slate-400"
                  >
                    No tasks found for "{filter}".
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3 font-sans font-semibold text-slate-900">
                      {t.title}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {t.assignedEmployee
                        ?.name ? (
                        <span className="font-bold text-slate-900">
                          {
                            t
                              .assignedEmployee
                              .name
                          }{" "}
                          (
                          {
                            t
                              .assignedEmployee
                              .role
                          }
                          )
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-700">
                      {t.priority}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 border font-bold text-[10px] ${getStatusStyle(
                          t.status
                        )}`}
                      >
                        <span>●</span>

                        {getStatusLabel(
                          t.status
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(
                        t.createdAt
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            MOBILE TASK LIST
        ───────────────────────────────────────────────────────────── */}

        <div className="sm:hidden space-y-2">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse"
                >
                  <div className="h-4 bg-slate-100 rounded w-3/4" />

                  <div className="h-3 bg-slate-100 rounded w-1/2 mt-3" />

                  <div className="flex gap-2 mt-4">
                    <div className="h-6 bg-slate-100 rounded w-20" />
                    <div className="h-6 bg-slate-100 rounded w-16" />
                  </div>
                </div>
              ))}
            </>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-xl">
                ✓
              </div>

              <p className="text-[13px] font-semibold text-slate-700 mt-3">
                No tasks found
              </p>

              <p className="text-[11px] text-slate-400 mt-1">
                No tasks match "{filter}".
              </p>

              {tasks.length === 0 && (
                <Link
                  href="/tasks/new"
                  className="inline-flex items-center justify-center mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[11px] font-semibold"
                >
                  + Assign First Task
                </Link>
              )}
            </div>
          ) : (
            filteredTasks.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-slate-200 rounded-xl p-4"
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                    {getInitials(
                      t.assignedEmployee
                        ?.name
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-slate-900 leading-snug">
                      {t.title}
                    </h3>

                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      {t.assignedEmployee
                        ?.name ? (
                        <>
                          {
                            t
                              .assignedEmployee
                              .name
                          }

                          {t
                            .assignedEmployee
                            .role && (
                            <>
                              {" "}
                              ·{" "}
                              {
                                t
                                  .assignedEmployee
                                  .role
                              }
                            </>
                          )}
                        </>
                      ) : (
                        "Unassigned"
                      )}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 border rounded-md font-bold text-[9px] ${getStatusStyle(
                      t.status
                    )}`}
                  >
                    <span>●</span>

                    {getStatusLabel(
                      t.status
                    )}
                  </span>
                </div>

                {/* Bottom metadata */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wide text-slate-400">
                      Priority
                    </span>

                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      {t.priority}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400">
                    {formatDate(
                      t.createdAt
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            MOBILE PENDING INDICATOR
        ───────────────────────────────────────────────────────────── */}

        {!loading &&
          pendingCount > 0 && (
            <div className="sm:hidden bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-mono text-amber-700">
                <span className="font-bold">
                  {pendingCount}
                </span>{" "}
                task
                {pendingCount !== 1
                  ? "s"
                  : ""}{" "}
                waiting for attention
              </p>
            </div>
          )}
      </div>
    </div>
  );
}