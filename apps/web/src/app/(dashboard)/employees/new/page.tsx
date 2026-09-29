"use client";

import { useState, useRef } from "react";
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

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function NewEmployeePage() {
  const router = useRouter();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const cloudinaryRef = useRef<any>(null);
  const widgetRef = useRef<any>(null);

  const [step, setStep] = useState(1);
  const [rolePreset, setRolePreset] = useState("cto");
  const [name, setName] = useState("Alex Vance");
  const [roleTitle, setRoleTitle] = useState("AI CTO & Lead Architect");
  const [shortDescription, setShortDescription] = useState("Technical architect & system strategist leading engineering initiatives.");
  const [personality, setPersonality] = useState("Pragmatic, analytical, high security standards, focused on clean architecture.");
  const [systemInstructions, setSystemInstructions] = useState("Analyze repositories, create task blueprints, enforce architectural standards, write modular TypeScript with unit tests.");
  const [maxMonthlySpend, setMaxMonthlySpend] = useState(500);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryReady = !!(cloudName && uploadPreset && cloudName !== "your_cloud_name_here");

  const openCloudinaryWidget = () => {
    if (!cloudinaryReady) {
      alert("Cloudinary is not configured yet. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your .env.local file.");
      return;
    }

    if (typeof window === "undefined" || !(window as any).cloudinary) {
      // Load Cloudinary script dynamically
      const script = document.createElement("script");
      script.src = "https://upload-widget.cloudinary.com/global/all.js";
      script.onload = () => openWidget();
      document.head.appendChild(script);
    } else {
      openWidget();
    }
  };

  const openWidget = () => {
    const cld = (window as any).cloudinary;
    if (!cld) return;
    const widget = cld.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        cropping: true,
        croppingAspectRatio: 1,
        showSkipCropButton: false,
        maxFiles: 1,
        resourceType: "image",
        sources: ["local", "url", "camera"],
        styles: {
          palette: {
            window: "#0f172a",
            windowBorder: "#334155",
            tabIcon: "#6366f1",
            menuIcons: "#94a3b8",
            textDark: "#f8fafc",
            textLight: "#1e293b",
            link: "#6366f1",
            action: "#6366f1",
            inactiveTabIcon: "#475569",
            error: "#f43f5e",
            inProgress: "#6366f1",
            complete: "#22c55e",
            sourceBg: "#1e293b",
          },
          fonts: {
            default: null,
            "'Inter', sans-serif": {
              url: "https://fonts.googleapis.com/css?family=Inter",
              active: true,
            },
          },
        },
      },
      (error: any, result: any) => {
        if (!error && result && result.event === "success") {
          setAvatarUrl(result.info.secure_url);
        }
        if (result && result.event === "queues-end") {
          setAvatarUploading(false);
        }
        if (result && result.event === "upload-added") {
          setAvatarUploading(true);
        }
      }
    );
    widget.open();
  };

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
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      router.push("/employees");
    } catch (err: any) {
      setError(err?.message || "Failed to hire AI employee. Check fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-6 max-w-4xl mx-auto space-y-6 font-sans">
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

          {/* ── Profile Picture ── */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 font-mono">
              Profile Picture <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              {/* Avatar Preview */}
              <div className="w-16 h-16 bg-slate-800 text-white flex items-center justify-center shrink-0 overflow-hidden border-2 border-slate-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold font-mono">{initials(name)}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openCloudinaryWidget}
                  disabled={avatarUploading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold font-mono transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {avatarUploading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : avatarUrl ? (
                    "Change Photo"
                  ) : (
                    "Upload Photo"
                  )}
                </button>
                {!cloudinaryReady && (
                  <p className="text-[10px] font-mono text-amber-600">
                    ⚠️ Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &amp; NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local to enable uploads
                  </p>
                )}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-[10px] font-mono text-rose-500 hover:text-rose-700 text-left"
                  >
                    Remove photo
                  </button>
                )}
                <p className="text-[10px] font-mono text-slate-400">
                  PNG, JPG or GIF · Max 5MB · Will be cropped to square
                </p>
              </div>
            </div>
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
