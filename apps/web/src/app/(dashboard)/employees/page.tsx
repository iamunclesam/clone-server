"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, AIEmployee } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WORKING: "bg-blue-50 text-blue-700 border-blue-200",
  IDLE: "bg-purple-50 text-purple-700 border-purple-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function EmployeesPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [employees, setEmployees] = useState<AIEmployee[]>([]);
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
        const res = await api.getEmployees(companyId);
        setEmployees(res.employees || []);
      } catch (err) {
        console.warn("Employees API error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const filteredEmployees = employees.filter((emp) => {
    if (filter === "All") return true;
    if (filter === "Active") return emp.status === "ACTIVE" || emp.status === "WORKING";
    if (filter === "Paused") return emp.status === "PAUSED";
    return emp.status === filter.toUpperCase();
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Employees</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {employees.length} digital team members operating in {activeCompany?.name || "Your Workspace"}
          </p>
        </div>
        <Link
          href="/employees/new"
          id="create-employee-btn"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          + Hire AI Employee
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["All", "Active", "Working", "Paused"].map((f) => (
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

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-xs font-mono text-slate-400 bg-white border border-slate-200">
            Loading AI Employees...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs font-mono text-slate-400 bg-white border border-slate-200 space-y-3">
            <p>No AI employees found for status "{filter}".</p>
            <Link
              href="/employees/new"
              className="inline-block px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold"
            >
              Hire AI Employee
            </Link>
          </div>
        ) : (
          filteredEmployees.map((emp) => (
            <Link
              key={emp.id}
              href={`/employees/${emp.id}`}
              className="block bg-white border border-slate-200 p-5 hover:border-slate-300 transition-all space-y-4"
            >
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
                  {emp.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{emp.name}</div>
                  <div className="text-xs font-mono text-slate-500 truncate">{emp.role}</div>
                </div>
                <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 border ${STATUS_STYLES[emp.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  ● {emp.status}
                </span>
              </div>

              {/* Description / Instructions */}
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                  CORE SCOPE
                </div>
                <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {emp.shortDescription || emp.systemInstructions || "Autonomous task agent"}
                </div>
              </div>

              {/* Connected tools */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {((emp.connectedTools && emp.connectedTools.length > 0) ? emp.connectedTools : []).map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-0.5 bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-600"
                  >
                    {tool}
                  </span>
                ))}
                {(!emp.connectedTools || emp.connectedTools.length === 0) && (
                  <span className="px-2 py-0.5 bg-slate-50 border border-dashed border-slate-200 font-mono text-[10px] text-slate-400">
                    No tools assigned
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-mono text-slate-400">
                <span>Budget: ${emp.currentSpend || 0} / ${emp.maxMonthlySpend || 500}</span>
                <span className="text-blue-600 font-bold">Configure →</span>
              </div>
            </Link>
          ))
        )}

        {/* Hire new card */}
        <Link
          href="/employees/new"
          className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white p-8 hover:border-slate-400 hover:bg-slate-50/50 transition-all text-center space-y-2 cursor-pointer min-h-[220px]"
        >
          <div className="w-10 h-10 border border-slate-300 bg-slate-50 text-slate-500 font-mono text-lg flex items-center justify-center font-bold">
            +
          </div>
          <div className="text-xs font-semibold text-slate-700">Hire New AI Employee</div>
          <div className="text-[11px] font-mono text-slate-400">Custom persona, permissions & system prompt</div>
        </Link>
      </div>
    </div>
  );
}
