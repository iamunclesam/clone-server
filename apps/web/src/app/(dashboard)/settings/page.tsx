"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { activeCompany } = useAuth();

  const [orgName, setOrgName] = useState(activeCompany?.name || "Acme Corp");
  const [domain, setDomain] = useState(activeCompany?.slug || "acme");
  const [requireApprovalForDeploy, setRequireApprovalForDeploy] = useState(true);
  const [maxMonthlyBudget, setMaxMonthlyBudget] = useState("500.00");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      setOrgName(activeCompany.name);
      setDomain(activeCompany.slug);
    }
  }, [activeCompany]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Workspace & Governance Settings</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Configure security, spend caps, and human-in-the-loop policies for {activeCompany?.name || "Your Workspace"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Info */}
        <div className="bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-900">
            General Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold font-mono text-slate-700 uppercase tracking-wider mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold font-mono text-slate-700 uppercase tracking-wider mb-1">
                Workspace Slug / Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Security & Risk Policies */}
        <div className="bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-900">
            Human-in-the-Loop Governance
          </h2>

          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-bold text-slate-900">Require Approval for Production Code Deploys</div>
                <div className="text-[10px] text-slate-500">Forces human sign-off before AI employees merge PRs or deploy to production</div>
              </div>
              <input
                type="checkbox"
                checked={requireApprovalForDeploy}
                onChange={(e) => setRequireApprovalForDeploy(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-bold text-slate-900">Prompt Injection Protection Guardrails</div>
                <div className="text-[10px] text-slate-500">Filter untrusted inputs (GitHub comments, emails) before LLM execution context</div>
              </div>
              <span className="px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                STRICT (ENABLED)
              </span>
            </div>
          </div>
        </div>

        {/* Budget Cap */}
        <div className="bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-900">
            LLM Execution Hard Budget
          </h2>
          <div>
            <label className="block text-xs font-semibold font-mono text-slate-700 uppercase tracking-wider mb-1">
              Monthly Budget Limit ($ USD)
            </label>
            <input
              type="number"
              value={maxMonthlyBudget}
              onChange={(e) => setMaxMonthlyBudget(e.target.value)}
              className="w-full max-w-xs bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <p className="text-[10px] font-mono text-slate-400 mt-1">
              AI employee execution automatically pauses if token costs reach this ceiling.
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-mono text-emerald-600 font-bold">✓ Settings saved!</span>}
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Save Governance Settings
          </button>
        </div>
      </form>
    </div>
  );
}
