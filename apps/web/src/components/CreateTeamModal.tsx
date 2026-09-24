"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, AIEmployee } from "@/lib/api";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateTeamModal({ isOpen, onClose, onCreated }: CreateTeamModalProps) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [leadEmployeeId, setLeadEmployeeId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<AIEmployee[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmployees() {
      if (!companyId || !isOpen) return;
      try {
        const res = await api.getEmployees(companyId);
        setAvailableEmployees(res.employees || []);
        if (res.employees && res.employees.length > 0 && !leadEmployeeId) {
          setLeadEmployeeId(res.employees[0].id);
        }
      } catch (err) {
        console.warn("Failed to load employees for team creation:", err);
      }
    }
    loadEmployees();
  }, [companyId, isOpen]);

  if (!isOpen) return null;

  const toggleMember = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    if (!companyId) {
      setError("No active workspace selected");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createTeam(companyId, {
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        leadEmployeeId: leadEmployeeId || undefined,
        memberIds: selectedMemberIds,
      });
      setName("");
      setDescription("");
      setInstructions("");
      setLeadEmployeeId("");
      setSelectedMemberIds([]);
      onClose();
      if (onCreated) onCreated();
    } catch (err: any) {
      setError(err?.message || "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Content - Sharp Edge Light Theme */}
      <div className="relative w-full max-w-lg bg-white border border-slate-300 shadow-2xl p-6 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Create AI Functional Team</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Group specialized AI employees into task units</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Team Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Infrastructure & DevOps, Inbound Sales SDRs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-slate-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Choose Team Lead
            </label>
            <select
              value={leadEmployeeId}
              onChange={(e) => setLeadEmployeeId(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:bg-white focus:border-slate-900 outline-none transition-colors"
            >
              {availableEmployees.length === 0 ? (
                <option value="">No AI employees created yet</option>
              ) : (
                availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👑 {emp.name} ({emp.role})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Assign AI Employees to Team
            </label>
            {availableEmployees.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-400">
                No employees available. Hire AI employees first to assign them.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200">
                {availableEmployees.map((emp) => {
                  const checked = selectedMemberIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between p-2 bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(emp.id)}
                          className="w-4 h-4 text-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold text-slate-900">{emp.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">({emp.role})</span>
                      </div>
                      {leadEmployeeId === emp.id && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200">
                          TEAM LEAD
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Description / Mandate
            </label>
            <textarea
              rows={2}
              placeholder="Primary responsibilities and operational scope for this team."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:bg-white focus:border-slate-900 outline-none transition-colors leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              Team Directives & SLA Guidelines
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Enforce strict code review on pull requests. Respond to customer support tickets within 15 minutes."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:bg-white focus:border-slate-900 outline-none transition-colors leading-relaxed"
            />
          </div>

          {/* Action Footer */}
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
              {submitting ? "Creating Team..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
