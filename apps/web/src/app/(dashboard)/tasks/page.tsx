"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, Task } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-400 border-slate-200",
};

export default function TasksPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.getTasks(companyId);
        setTasks(res.tasks || []);
      } catch (err) {
        console.warn("Tasks API error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "All") return true;
    if (filter === "In Progress") return t.status === "IN_PROGRESS";
    if (filter === "Waiting Approval") return t.status === "WAITING_FOR_APPROVAL";
    if (filter === "Completed") return t.status === "COMPLETED";
    return t.status === filter.toUpperCase();
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Task Execution Queue</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {tasks.length} total tasks assigned across AI Employees
          </p>
        </div>
        <Link
          href="/tasks/new"
          id="create-task-btn"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          + Assign New Task
        </Link>
      </div>

      {/* View controls */}
      <div className="flex flex-wrap gap-2">
        {["All", "In Progress", "Waiting Approval", "Completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer border ${
              filter === f
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="bg-white border border-slate-200 overflow-hidden">
        <table className="w-full text-xs font-mono text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <th className="px-4 py-3">Task Title</th>
              <th className="px-4 py-3">Assigned Employee</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Loading tasks...
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No tasks found for "{filter}".
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans font-semibold text-slate-900">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.assignedEmployee?.name ? (
                      <span className="font-bold text-slate-900">{t.assignedEmployee.name} ({t.assignedEmployee.role})</span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {t.priority}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 border font-bold text-[10px] ${STATUS_STYLES[t.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      ● {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Today"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
