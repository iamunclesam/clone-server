"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, Team } from "@/lib/api";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { AssignTeamMembersModal } from "@/components/AssignTeamMembersModal";

export default function TeamsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTeams(companyId);
      setTeams(res.teams || []);
    } catch (err: any) {
      console.warn("Teams API error:", err);
      setError("Unable to sync with live teams API. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Employee Teams</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Functional units for automated multi-agent collaboration in {activeCompany?.name || "Your Workspace"}
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          + Create New Team
        </button>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={loadTeams}
            className="px-2 py-1 bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 cursor-pointer font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Team Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white border border-slate-200">
          Loading AI Teams from live API...
        </div>
      ) : teams.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 space-y-3">
          <div className="w-10 h-10 bg-slate-100 border border-slate-200 text-slate-500 font-mono text-base flex items-center justify-center font-bold mx-auto">
            👥
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-mono">No Functional Teams Created</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-sans">
            Group your specialized AI employees into collaborative units (e.g., Engineering & DevOps, Operations & Customer Care) to execute complex multi-agent workflows.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer inline-block"
          >
            + Create First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
            >              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200">
                    ● {team.status || "ACTIVE"}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{team.memberCount} assigned employee{team.memberCount !== 1 ? "s" : ""}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    <Link href={`/teams/${team.id}`} className="hover:text-blue-600 transition-colors">
                      {team.name}
                    </Link>
                  </h3>
                  {team.description && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {team.description}
                    </p>
                  )}
                </div>

                {/* Team Directives */}
                {team.instructions && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900 uppercase block text-[9px] text-slate-400 mb-0.5">DIRECTIVES & SLA:</span>
                    {team.instructions}
                  </div>
                )}

                {/* Members */}
                <div className="pt-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span>Assigned Roster ({team.members.length})</span>
                    <button
                      onClick={() => setManageTeam(team)}
                      className="text-blue-600 font-bold hover:underline cursor-pointer lowercase text-[11px]"
                    >
                      + assign / edit
                    </button>
                  </div>

                  {team.members.length === 0 ? (
                    <div className="text-xs font-mono text-slate-400 italic p-3 bg-slate-50 border border-slate-100 text-center">
                      No AI employees assigned yet. Click "+ assign / edit" to add roster.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {team.members.map((m) => {
                        const isLead = team.leadEmployeeId === m.id || team.leadEmployee?.id === m.id;
                        return (
                          <Link
                            key={m.id}
                            href={`/employees/${m.id}`}
                            className={`flex items-center gap-2 px-2.5 py-1 border transition-colors ${
                              isLead ? "bg-amber-50/80 border-amber-200" : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                            }`}
                          >
                            <div className="w-5 h-5 bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                              {m.name[0]}
                            </div>
                            <span className="text-xs font-mono text-slate-800 font-semibold">{m.name}</span>
                            {isLead ? (
                              <span className="text-[9px] font-mono font-bold text-amber-800">👑 LEAD</span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">({m.role})</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Lead: <strong className="text-slate-900">{team.lead}</strong></span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setManageTeam(team)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer transition-colors"
                  >
                    Manage Roster
                  </button>
                  <Link
                    href={`/teams/${team.id}`}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-700 text-white font-bold text-[11px] transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* Add team card */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white p-8 hover:border-slate-400 hover:bg-slate-50/50 transition-all text-center space-y-2 cursor-pointer min-h-[220px]"
          >
            <div className="w-10 h-10 border border-slate-300 bg-slate-50 text-slate-500 font-mono text-lg flex items-center justify-center font-bold">
              +
            </div>
            <div className="text-xs font-semibold text-slate-700">Create New Team</div>
            <div className="text-[11px] font-mono text-slate-400">Group AI employees by mandate & directives</div>
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateTeamModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadTeams}
      />

      <AssignTeamMembersModal
        team={manageTeam}
        isOpen={!!manageTeam}
        onClose={() => setManageTeam(null)}
        onUpdated={loadTeams}
      />
    </div>
  );
}
