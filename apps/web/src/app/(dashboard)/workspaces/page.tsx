"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";

export default function WorkspacesPage() {
  const { companies, activeCompany, switchCompany } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Workspaces & Organizations</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Manage your AI workforce organizations and cloud execution environments
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          + Create Workspace
        </button>
      </div>

      {/* Active Workspaces List */}
      <div className="bg-white border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-900">
            Your Workspaces ({companies.length})
          </h2>
          <span className="text-xs font-mono text-slate-500">Real-time Connected</span>
        </div>

        <div className="divide-y divide-slate-100">
          {companies.length > 0 ? (
            companies.map((ws) => {
              const isActive = ws.id === activeCompany?.id;
              return (
                <div
                  key={ws.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isActive ? "bg-blue-50/40" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{ws.name}</span>
                      {isActive ? (
                        <span className="px-2 py-0.5 border font-bold text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                          ● ACTIVE WORKSPACE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 border font-bold text-[10px] bg-slate-100 text-slate-500 border-slate-200">
                          MEMBER
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600">
                      Slug: <strong className="text-slate-900">{ws.slug}</strong> • Size: {ws.companySize || "1-10"} • Type: {ws.companyType || "AI OS"}
                    </div>
                    <div className="text-[11px] text-slate-400">Workspace ID: {ws.id}</div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    {!isActive && (
                      <button
                        onClick={() => switchCompany(ws.id)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer transition-colors"
                      >
                        Switch to Workspace
                      </button>
                    )}
                    {isActive && (
                      <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                        Currently Selected
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No workspaces found. Click <strong>+ Create Workspace</strong> to create your first organization.
            </div>
          )}
        </div>
      </div>

      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
