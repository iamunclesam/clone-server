"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreated }: CreateWorkspaceModalProps) {
  const { createCompany } = useAuth();
  const [name, setName] = useState("");
  const [companySize, setCompanySize] = useState("1-10");
  const [companyType, setCompanyType] = useState("SaaS Platform");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createCompany(name.trim(), companySize, companyType);
      setName("");
      onClose();
      if (onCreated) onCreated();
    } catch (err: any) {
      setError(err?.message || "Failed to create workspace");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Content - Sharp Edge Light Theme */}
      <div className="relative w-full max-w-md bg-white border border-slate-300 shadow-2xl p-6 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Create New Workspace</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Set up an isolated AI employee workspace</p>
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
              Workspace Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp, Stark Industries"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-slate-900 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                Team Size
              </label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-900 outline-none transition-colors"
              >
                <option value="1-10">1 - 10 people</option>
                <option value="11-50">11 - 50 people</option>
                <option value="51-200">51 - 200 people</option>
                <option value="201+">201+ enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                Industry / Type
              </label>
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-900 outline-none transition-colors"
              >
                <option value="SaaS Platform">SaaS Platform</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Agency / Services">Agency / Services</option>
                <option value="Fintech">Fintech</option>
                <option value="AI / Hardware">AI / Hardware</option>
                <option value="Other">Other</option>
              </select>
            </div>
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
              {submitting ? "Creating Workspace..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
