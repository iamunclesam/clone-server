"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const MEMORY_ENTRIES = [
  {
    id: "mem-1",
    employee: "Alex Vance (AI CTO)",
    key: "codebase.architecture.auth_pattern",
    value: "All public API routes must use Bearer JWT authentication via middleware/auth.ts. Prisma models use standard cuid() identifiers.",
    type: "CODE_POLICY",
    updated: "2 hours ago",
    confidence: "99%",
  },
  {
    id: "mem-2",
    employee: "Maya Lin (AI CMO)",
    key: "company.brand.tone_guidelines",
    value: "Brand voice is confident, technical yet accessible, direct, and zero fluff. Highlight safety, SOC-2 compliance, and autonomy.",
    type: "BRAND_POLICY",
    updated: "1 day ago",
    confidence: "95%",
  },
  {
    id: "mem-3",
    employee: "Jordan Reed (AI SDR)",
    key: "sales.icp.target_criteria",
    value: "Target companies with 10-250 employees in Software, SaaS, FinTech. Key buyer personas: Founder, CTO, VP Engineering.",
    type: "ICP_PREFERENCE",
    updated: "3 days ago",
    confidence: "92%",
  },
  {
    id: "mem-4",
    employee: "Alex Vance (AI CTO)",
    key: "devops.database.mongodb_config",
    value: "MongoDB connection string uses TLS with replica set. Mongoose models are compiled in @clone/database package.",
    type: "INFRASTRUCTURE",
    updated: "4 hours ago",
    confidence: "98%",
  },
];

export default function MemoryPage() {
  const { activeCompany } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");

  const filtered = MEMORY_ENTRIES.filter((mem) => {
    const matchesSearch =
      mem.key.toLowerCase().includes(search.toLowerCase()) ||
      mem.value.toLowerCase().includes(search.toLowerCase()) ||
      mem.employee.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === "ALL" || mem.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Long-Term Shared Memory Inspector</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Retained knowledge vectors across AI Employees in {activeCompany?.name || "Your Workspace"}
          </p>
        </div>

        <button
          onClick={() => alert("Injecting custom memory vector...")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          + Inject Memory Vector
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <input
          type="text"
          placeholder="Search memory key, value, or employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 bg-white border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
        />

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "CODE_POLICY", "BRAND_POLICY", "ICP_PREFERENCE", "INFRASTRUCTURE"].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer border ${
                selectedType === t
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards */}
      <div className="bg-white border border-slate-200 divide-y divide-slate-100">
        {filtered.map((mem) => (
          <div key={mem.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-mono text-xs font-bold text-blue-600 flex items-center gap-1.5">
                <span>🧠</span>
                <span>{mem.key}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 border bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-mono font-bold">
                  {mem.type}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Confidence: {mem.confidence}</span>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed">
              "{mem.value}"
            </p>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span>Employee: <strong className="text-slate-800">{mem.employee}</strong></span>
              <span>Updated {mem.updated}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
