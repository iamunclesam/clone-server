"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, Team, AIEmployee } from "@/lib/api";

interface AssignTeamMembersModalProps {
  team: Team | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function AssignTeamMembersModal({ team, isOpen, onClose, onUpdated }: AssignTeamMembersModalProps) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [availableEmployees, setAvailableEmployees] = useState<AIEmployee[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!companyId || !isOpen || !team) return;
      try {
        const res = await api.getEmployees(companyId);
        const emps = res.employees || [];
        setAvailableEmployees(emps);

        // Pre-select current team members
        const currentMemberIds = team.members.map((m) => m.id);
        setSelectedMemberIds(currentMemberIds);

        // Pre-select current lead
        const leadId = team.leadEmployeeId || team.leadEmployee?.id || currentMemberIds[0] || "";
        setSelectedLeadId(leadId);
      } catch (err) {
        console.warn("Failed to load employees for team assignment:", err);
      }
    }
    loadData();
  }, [companyId, isOpen, team]);

  if (!isOpen || !team) return null;

  const toggleMember = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !team) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Assign selected members
      const currentMemberIds = team.members.map((m) => m.id);
      
      // Members to add
      const toAdd = selectedMemberIds.filter((id) => !currentMemberIds.includes(id));
      if (toAdd.length > 0) {
        await api.assignTeamMembers(companyId, team.id, toAdd);
      }

      // Members to remove
      const toRemove = currentMemberIds.filter((id) => !selectedMemberIds.includes(id));
      for (const removeId of toRemove) {
        await api.removeTeamMember(companyId, team.id, removeId);
      }

      // 2. Set Team Lead if selected
      if (selectedLeadId && selectedLeadId !== team.leadEmployeeId) {
        await api.setTeamLead(companyId, team.id, selectedLeadId);
      }

      onClose();
      onUpdated();
    } catch (err: any) {
      setError(err?.message || "Failed to update team membership");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-white border border-slate-300 shadow-2xl p-6 font-sans max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Manage Team: {team.name}</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Assign AI employees & designate Team Lead</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Team Lead Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              👑 Designated Team Lead
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:bg-white focus:border-slate-900 outline-none transition-colors"
            >
              {availableEmployees.length === 0 ? (
                <option value="">No AI employees created</option>
              ) : (
                availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Member Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Team Roster ({selectedMemberIds.length} assigned)
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto p-2 bg-slate-50 border border-slate-200">
              {availableEmployees.length === 0 ? (
                <div className="text-xs font-mono text-slate-400 p-2">No AI employees available in this workspace.</div>
              ) : (
                availableEmployees.map((emp) => {
                  const isChecked = selectedMemberIds.includes(emp.id);
                  const isLead = selectedLeadId === emp.id;
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center justify-between p-2.5 bg-white border transition-colors cursor-pointer ${
                        isChecked ? "border-blue-300 bg-blue-50/30" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMember(emp.id)}
                          className="w-4 h-4 text-blue-600 cursor-pointer"
                        />
                        <div className="w-6 h-6 bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {emp.name[0]}
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold text-slate-900">{emp.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{emp.role}</div>
                        </div>
                      </div>

                      {isLead && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          👑 LEAD
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving Roster..." : "Save Roster & Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
