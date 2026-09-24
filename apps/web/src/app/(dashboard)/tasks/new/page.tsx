"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, AIEmployee } from "@/lib/api";

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedEmpId = searchParams.get("employeeId") || "";

  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [employees, setEmployees] = useState<AIEmployee[]>([]);
  const [prompt, setPrompt] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(preselectedEmpId);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmps() {
      if (!companyId) return;
      try {
        const res = await api.getEmployees(companyId);
        const list = res.employees || [];
        setEmployees(list);
        if (!assignedEmployeeId && list.length > 0) {
          setAssignedEmployeeId(list[0].id);
        }
      } catch (err) {
        console.warn("Failed to load employees for task:", err);
      }
    }
    loadEmps();
  }, [companyId, assignedEmployeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!companyId) {
      setError("No active workspace selected.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createTask(companyId, {
        title: prompt.slice(0, 80),
        description: prompt,
        naturalPrompt: prompt,
        assignedEmployeeId: assignedEmployeeId || undefined,
        priority,
        approvalRequired: requireApproval,
      });
      router.push("/tasks");
    } catch (err: any) {
      setError(err?.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Task Objective Prompt */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 font-mono">
          Task Goal / Directive Prompt
        </label>
        <textarea
          rows={5}
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Audit our backend API routes for missing authentication middleware. Add JWT validation to all unprotected endpoints and submit a Pull Request on GitHub with automated tests."
          className="w-full bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 focus:bg-white leading-relaxed"
        />
      </div>

      {/* Quick Templates */}
      <div>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Suggested Templates:
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            "Review V2 API security headers & open GitHub PR",
            "Draft customer support dispatch batch for review",
            "Publish launch announcement to Notion and Slack",
          ].map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(template)}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700 cursor-pointer"
            >
              + {template}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
            Assign AI Employee
          </label>
          <select
            value={assignedEmployeeId}
            onChange={(e) => setAssignedEmployeeId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
          >
            {employees.length === 0 ? (
              <option value="">No employees found</option>
            ) : (
              employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
            Priority Level
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200">
        <div>
          <div className="text-xs font-bold text-slate-900 font-mono">Require Approval for Write Actions</div>
          <div className="text-[10px] text-slate-500 font-mono">GitHub PRs, Email Sends, DB Mutations</div>
        </div>
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? "Dispatching..." : "⚡ Dispatch Task to AI Employee"}
        </button>
      </div>
    </form>
  );
}

export default function NewTaskPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4">
        <Link href="/tasks" className="text-xs font-mono text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-1">
          ← Back to Tasks
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Create Natural Language Task</h1>
        <p className="text-xs font-mono text-slate-500 mt-0.5">
          Describe what work you need completed. AI employees will execute autonomously.
        </p>
      </div>

      <Suspense fallback={<div className="bg-white border border-slate-200 p-8 text-center text-xs font-mono text-slate-400">Loading form...</div>}>
        <NewTaskForm />
      </Suspense>
    </div>
  );
}
