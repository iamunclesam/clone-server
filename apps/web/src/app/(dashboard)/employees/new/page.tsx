"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const ROLES = [
  { id: "cto", title: "AI CTO & Lead Architect", desc: "Manages architecture, code reviews, PRs, CI/CD pipelines, and cloud environments." },
  { id: "cmo", title: "AI Growth CMO", desc: "Automates social campaigns, content strategy, newsletters, and lead attribution." },
  { id: "sdr", title: "AI Inbound/Outbound SDR", desc: "Qualifies leads, responds to support inquiries, drafts outreach, and logs CRM notes." },
  { id: "custom", title: "Custom AI Role", desc: "Design a unique autonomous role with custom tools, system prompts, and memory scope." },
];

export default function NewEmployeePage() {
  const router = useRouter();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [step, setStep] = useState(1);
  const [rolePreset, setRolePreset] = useState("cto");
  const [name, setName] = useState("Alex Vance");
  const [roleTitle, setRoleTitle] = useState("AI CTO & Lead Architect");
  const [shortDescription, setShortDescription] = useState("Technical architect & system strategist leading engineering initiatives.");
  const [personality, setPersonality] = useState("Pragmatic, analytical, high security standards, focused on clean architecture.");
  const [systemInstructions, setSystemInstructions] = useState("Analyze repositories, create task blueprints, enforce architectural standards, write modular TypeScript with unit tests.");
  const [maxMonthlySpend, setMaxMonthlySpend] = useState(500);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (!companyId) {
      setError("No active workspace selected. Please create or select a workspace first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.createEmployee(companyId, {
        name,
        role: roleTitle,
        shortDescription,
        personality,
        systemInstructions,
        maxMonthlySpend: Number(maxMonthlySpend),
      });
      router.push("/employees");
    } catch (err: any) {
      setError(err?.message || "Failed to hire AI employee. Check fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <Link href="/employees" className="text-xs font-mono text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-1">
            ← Back to AI Employees
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Hire New AI Employee</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">Configure role, persona, governance and system prompts</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 font-mono">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold ${
                step === s
                  ? "bg-slate-900 text-white"
                  : step > s
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-slate-100 text-slate-400 border border-slate-200"
              }`}
            >
              {step > s ? "✓" : s}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Step 1: Role & Identity */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 p-6 space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">
            1. Role Preset & Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRolePreset(r.id);
                  if (r.id !== "custom") setRoleTitle(r.title);
                }}
                className={`p-4 border text-left transition-colors cursor-pointer ${
                  rolePreset === r.id
                    ? "bg-blue-50/60 border-blue-500 text-slate-900"
                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="font-bold text-sm text-slate-900">{r.title}</div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{r.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                Employee Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Vance"
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                Role Title
              </label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="AI CTO"
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
              Short Description / Scope
            </label>
            <input
              type="text"
              required
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Technical architect leading backend migration initiatives."
              className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Continue to System Instructions →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Persona, Instructions & Governance */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 p-6 space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">
            2. System Prompt & Governance
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
              Personality Traits
            </label>
            <input
              type="text"
              required
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Pragmatic, analytical, high security standards."
              className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
              System Instruction Prompt
            </label>
            <textarea
              rows={4}
              required
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-mono">
              Max Monthly Spend Limit ($ USD)
            </label>
            <input
              type="number"
              value={maxMonthlySpend}
              onChange={(e) => setMaxMonthlySpend(Number(e.target.value))}
              className="w-full max-w-xs bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs cursor-pointer"
            >
              ← Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Deploying Employee..." : ` Deploy AI Employee (${name})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
