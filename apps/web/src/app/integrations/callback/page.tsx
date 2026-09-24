"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const PROVIDER_INFO: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
  gmail: {
    name: "Gmail / Google Workspace",
    color: "#EA4335",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22 6.5V18a2 2 0 0 1-2 2h-3v-8.5L22 6.5z" />
        <path fill="#34A853" d="M2 6.5V18a2 2 0 0 0 2 2h3v-8.5L2 6.5z" />
        <path fill="#EA4335" d="M17 4l-5 3.5L7 4H4a2 2 0 0 0-2 2.5L12 14l10-7.5A2 2 0 0 0 20 4h-3z" />
        <path fill="#FBBC04" d="M7 4h10v3.5L12 11 7 7.5V4z" />
      </svg>
    ),
  },
  github: {
    name: "GitHub",
    color: "#181717",
    icon: (
      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  slack: {
    name: "Slack",
    color: "#4A154B",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24">
        <path fill="#E01E5A" d="M6 15a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 2.5a2.5 2.5 0 0 1 2.5-2.5H11v2.5a2.5 2.5 0 1 1-5 0z" />
        <path fill="#36C5F0" d="M9 6a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm-2.5 0A2.5 2.5 0 0 1 9 3.5h2.5V6a2.5 2.5 0 1 1-5 0z" />
        <path fill="#2EB67D" d="M18 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0-2.5a2.5 2.5 0 0 1-2.5 2.5H13V6.5a2.5 2.5 0 1 1 5 0z" />
        <path fill="#ECB22E" d="M15 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm2.5 0a2.5 2.5 0 0 1-2.5 2.5H12.5V18a2.5 2.5 0 1 1 5 0z" />
      </svg>
    ),
  },
  notion: {
    name: "Notion",
    color: "#000000",
    icon: (
      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.424.466l11.666-.746c.42 0 .047-.326-.093-.42L16.2.986c-.467-.373-.7-.466-1.54-.42L2.73 1.359c-.42.047-.56.28-.373.513l2.102 2.336zm1.12 3.638v14.041c0 .7.373.933 1.12.887l14.28-.887c.746-.047.933-.513.933-1.12V6.726c0-.606-.233-.887-.84-.84l-14.56.84c-.653.047-.933.373-.933 1.12zm13.16.84v12.268l-4.2-2.333V6.353l4.2 2.333zM9.826 8.593h2.333v9.893H9.826V8.593z" />
      </svg>
    ),
  },
  linear: {
    name: "Linear",
    color: "#5E6AD2",
    icon: (
      <svg className="w-12 h-12 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.5 18.5L18.5 3.5M3.5 12.5L12.5 3.5M3.5 6.5L6.5 3.5M11.5 20.5L20.5 11.5M17.5 20.5L20.5 17.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<"processing" | "success" | "error">("processing");
  const [countdown, setCountdown] = useState(5);

  const provider = searchParams?.get("provider") || (searchParams?.get("code") ? "github" : "app");
  const error = searchParams?.get("error");
  const oauthCode = searchParams?.get("code");
  const oauthState = searchParams?.get("state");
  const info = PROVIDER_INFO[provider] || {
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    color: "#6366f1",
    icon: (
      <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656-5.656l-1.1 1.1" />
      </svg>
    ),
  };

  useEffect(() => {
    if (error) {
      setPhase("error");
      return;
    }
    // If GitHub redirected to the web app instead of the API, forward the code for token exchange.
    if (oauthCode && oauthState) {
      const apiBase = process.env.NEXT_API_URL || "http://localhost:4000/api/v1";
      window.location.replace(
        `${apiBase}/integrations/${encodeURIComponent(provider)}/callback?code=${encodeURIComponent(oauthCode)}&state=${encodeURIComponent(oauthState)}`
      );
      return;
    }
    const t = setTimeout(() => setPhase("success"), 1200);
    return () => clearTimeout(t);
  }, [error, oauthCode, oauthState, provider]);

  useEffect(() => {
    if (phase !== "success") return;
    if (countdown <= 0) {
      router.push(`/integrations?connected=${provider}`);
      return;
    }
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [phase, countdown, provider, router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 font-sans relative overflow-hidden"
      style={{ backgroundColor: "#020617" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: info.color,
          opacity: 0.08,
          filter: "blur(120px)",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 p-12 max-w-md w-full flex flex-col items-center text-center gap-6 shadow-2xl"
        style={{
          backgroundColor: "rgb(15 23 42)",
          border: "1px solid rgba(148, 163, 184, 0.15)",
        }}
      >
        {/* Processing State */}
        {phase === "processing" && (
          <>
            <div className="relative">
              <div
                className="w-20 h-20 flex items-center justify-center"
                style={{ backgroundColor: "rgb(30 41 59)", border: "1px solid rgba(148,163,184,0.2)" }}
              >
                {info.icon}
              </div>
              {/* Spinning ring */}
              <div
                className="absolute"
                style={{
                  inset: "-12px",
                  animation: "spin 2s linear infinite",
                }}
              >
                <svg className="w-full h-full" viewBox="0 0 104 104" fill="none">
                  <circle
                    cx="52" cy="52" r="50"
                    stroke="url(#spinGrad)"
                    strokeWidth="1.5"
                    strokeDasharray="60 260"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="spinGrad" x1="0" y1="0" x2="104" y2="104" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366f1" />
                      <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-white text-xl font-bold tracking-tight">Connecting {info.name}</h1>
              <p className="text-slate-400 text-sm font-mono mt-2">Exchanging OAuth tokens and securing credentials…</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-indigo-500 rounded-full"
                  style={{
                    animation: "bounce 1s infinite",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Success State */}
        {phase === "success" && (
          <>
            <div className="relative">
              <div
                className="w-20 h-20 flex items-center justify-center"
                style={{ backgroundColor: "rgb(30 41 59)", border: "1px solid rgba(148,163,184,0.2)" }}
              >
                {info.icon}
              </div>
              {/* Checkmark badge */}
              <div
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#10b981", border: "2px solid rgb(15 23 42)" }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider mb-3"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#34d399",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#34d399", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                />
                OAuth 2.0 Connected
              </div>
              <h1 className="text-white text-xl font-bold tracking-tight">{info.name} Connected</h1>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Your account is now securely linked. Your AI Clones will have authorized access to use this integration.
              </p>
            </div>

            {/* Feature list */}
            <div
              className="w-full p-4 space-y-2.5 text-left"
              style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)" }}
            >
              <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-3">
                What&apos;s now enabled
              </div>
              {[
                "AI Clones can access this integration",
                "OAuth token encrypted with AES-256-GCM",
                "Scoped permissions — read & write ready",
                "Revoke anytime from integrations dashboard",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                  <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "#34d399" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>

            {/* Countdown progress bar */}
            <div className="w-full space-y-2">
              <div
                className="h-0.5 w-full overflow-hidden"
                style={{ backgroundColor: "rgb(30 41 59)" }}
              >
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${((5 - countdown) / 5) * 100}%`,
                    backgroundColor: "#6366f1",
                  }}
                />
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                Returning to integrations in{" "}
                <span className="text-white font-bold">{countdown}</span>s…
              </p>
            </div>

            <button
              onClick={() => router.push(`/integrations?connected=${provider}`)}
              className="w-full h-10 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
              style={{ backgroundColor: "#6366f1" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6366f1")}
            >
              Go to Integrations →
            </button>
          </>
        )}

        {/* Error State */}
        {phase === "error" && (
          <>
            <div
              className="w-20 h-20 flex items-center justify-center"
              style={{ backgroundColor: "rgba(190, 18, 60, 0.15)", border: "1px solid rgba(190, 18, 60, 0.4)" }}
            >
              <svg className="w-10 h-10" style={{ color: "#f43f5e" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Connection Failed</h1>
              <p className="text-slate-400 text-sm mt-2">
                {error || "OAuth authorization was denied or an unexpected error occurred."}
              </p>
            </div>
            <button
              onClick={() => router.push("/integrations")}
              className="w-full h-10 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
              style={{ backgroundColor: "rgb(51 65 85)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(71 85 105)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgb(51 65 85)")}
            >
              ← Back to Integrations
            </button>
          </>
        )}
      </div>

      {/* Brand footer */}
      <div className="relative z-10 mt-8 flex items-center gap-2 text-[11px] font-mono" style={{ color: "#475569" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#475569" }} />
        Clone OS · Secure OAuth 2.0 · AES-256-GCM Encrypted
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: "#020617" }}
        >
          <div className="text-slate-400 text-sm font-mono">Authenticating…</div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
