"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ConnectedAccount } from "@/lib/api";

const APP_ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg className="w-7 h-7 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
  slack: (
    <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24">
      <path fill="#E01E5A" d="M6 15a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 2.5a2.5 2.5 0 0 1 2.5-2.5H11v2.5a2.5 2.5 0 1 1-5 0z"/>
      <path fill="#36C5F0" d="M9 6a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm-2.5 0A2.5 2.5 0 0 1 9 3.5h2.5V6a2.5 2.5 0 1 1-5 0z"/>
      <path fill="#2EB67D" d="M18 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0-2.5a2.5 2.5 0 0 1-2.5 2.5H13V6.5a2.5 2.5 0 1 1 5 0z"/>
      <path fill="#ECB22E" d="M15 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm2.5 0a2.5 2.5 0 0 1-2.5 2.5H12.5V18a2.5 2.5 0 1 1 5 0z"/>
    </svg>
  ),
  gmail: (
    <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22 6.5V18a2 2 0 0 1-2 2h-3v-8.5L22 6.5z"/>
      <path fill="#34A853" d="M2 6.5V18a2 2 0 0 0 2 2h3v-8.5L2 6.5z"/>
      <path fill="#EA4335" d="M17 4l-5 3.5L7 4H4a2 2 0 0 0-2 2.5L12 14l10-7.5A2 2 0 0 0 20 4h-3z"/>
      <path fill="#FBBC04" d="M7 4h10v3.5L12 11 7 7.5V4z"/>
    </svg>
  ),
  notion: (
    <svg className="w-7 h-7 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.424.466l11.666-.746c.42 0 .047-.326-.093-.42L16.2.986c-.467-.373-.7-.466-1.54-.42L2.73 1.359c-.42.047-.56.28-.373.513l2.102 2.336zm1.12 3.638v14.041c0 .7.373.933 1.12.887l14.28-.887c.746-.047.933-.513.933-1.12V6.726c0-.606-.233-.887-.84-.84l-14.56.84c-.653.047-.933.373-.933 1.12zm13.16.84v12.268l-4.2-2.333V6.353l4.2 2.333zM9.826 8.593h2.333v9.893H9.826V8.593z" />
    </svg>
  ),
  linear: (
    <svg className="w-7 h-7 shrink-0 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.5L18.5 3.5M3.5 12.5L12.5 3.5M3.5 6.5L6.5 3.5M11.5 20.5L20.5 11.5M17.5 20.5L20.5 17.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>
      <path fill="#EA4335" d="M5 4h14v4H5z"/>
      <circle cx="12" cy="14" r="1.5" fill="#34A853" />
      <circle cx="16" cy="14" r="1.5" fill="#4285F4" />
      <circle cx="8" cy="14" r="1.5" fill="#FBBC04" />
    </svg>
  ),
  hubspot: (
    <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="#FF7A59">
      <path d="M18.164 7.844a2.766 2.766 0 00-2.352-1.309c-.61 0-1.163.2-1.614.538L11.53 4.29a3.18 3.18 0 00.123-.865A3.425 3.425 0 008.23 0a3.425 3.425 0 00-3.424 3.425c0 .324.045.638.13.935L2.39 6.906A2.887 2.887 0 00.01 9.42a2.886 2.886 0 002.585 2.868v5.776a3.298 3.298 0 00-1.854 2.96 3.3 3.3 0 006.598 0 3.296 3.296 0 00-1.854-2.96v-5.776c.49-.126.932-.382 1.282-.733l4.31 2.586a2.764 2.764 0 00-.095.72 2.77 2.77 0 105.54 0 2.77 2.77 0 00-2.358-2.74v-4.28z" />
    </svg>
  ),
  stripe: (
    <svg className="w-7 h-7 shrink-0 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.763-1.444 2.112-1.444 2.517 0 4.158 1.06 4.975 1.67L19.4 3.35C18.069 2.296 15.897 1.5 12.981 1.5c-4.469 0-7.534 2.37-7.534 6.275 0 5.86 8.04 4.887 8.04 7.4 0 .998-.87 1.624-2.33 1.624-2.684 0-4.887-1.426-5.834-2.193L3.6 18.274C5.23 19.645 7.828 20.5 11.082 20.5c4.767 0 7.834-2.37 7.834-6.425 0-6.196-4.94-5.118-4.94-4.925z" />
    </svg>
  ),
  intercom: (
    <svg className="w-7 h-7 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.05 21.95l5.097-1.282A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-4 12.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  ),
  vercel: (
    <svg className="w-7 h-7 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L24 22H0L12 1Z" />
    </svg>
  ),
  sentry: (
    <svg className="w-7 h-7 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 3L8.5 21H12.5L20.5 3H16.5ZM3.5 21H7.5L11.5 12H7.5L3.5 21Z" />
    </svg>
  ),
  e2b: (
    <svg className="w-7 h-7 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  jira: (
    <svg className="w-7 h-7 shrink-0 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 11.429h-7.714c-2.128 0-3.857 1.729-3.857 3.857v4.857c0 2.128 1.729 3.857 3.857 3.857h7.714v-12.571zm.858-11.429h-4.857c-2.128 0-3.857 1.729-3.857 3.857v7.714h8.714v-11.571zm.857 0v11.571h8.714v-7.714c0-2.128-1.729-3.857-3.857-3.857h-4.857z" />
    </svg>
  ),
};

const INTEGRATIONS_CATALOG = [
  { id: "github", name: "GitHub", category: "Engineering & Repositories", description: "Read/write access to repos, pull requests, and CI/CD actions." },
  { id: "slack", name: "Slack", category: "Communication & Alerts", description: "Send automated status updates, notifications, and interactive bots." },
  { id: "gmail", name: "Gmail / Google Workspace", category: "Communication & Email", description: "Draft support responses, send client emails with approval gates." },
  { id: "notion", name: "Notion", category: "Productivity & Knowledge", description: "Search knowledge base docs, auto-generate wiki entries." },
  { id: "linear", name: "Linear", category: "Project Management", description: "Create issues, update engineering tasks, and sync roadmaps." },
  { id: "calendar", name: "Google Calendar", category: "Productivity", description: "Schedule team meetings, manage executive calendar bookings." },
  { id: "hubspot", name: "HubSpot", category: "CRM & Marketing", description: "Log sales notes, update deal stages, and qualify inbound leads." },
  { id: "stripe", name: "Stripe", category: "Finance & Payments", description: "Retrieve billing data, monitor subscriptions, and issue refunds." },
  { id: "intercom", name: "Intercom", category: "Customer Support", description: "Handle Tier-1 support tickets and live chat inquiries." },
  { id: "vercel", name: "Vercel", category: "Cloud Infrastructure", description: "Trigger deployment previews, inspect build logs, monitor domains." },
  { id: "sentry", name: "Sentry", category: "Analytics & Monitoring", description: "Auto-triage runtime error stack traces and create bug reports." },
  { id: "e2b", name: "E2B MicroVM", category: "Cloud Execution", description: "Isolated cloud sandbox environment for secure code execution." },
  { id: "jira", name: "Jira Software", category: "Project Management", description: "Sync enterprise epic boards and agile sprint tickets." },
];

export default function IntegrationsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [connections, setConnections] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [connectedBanner, setConnectedBanner] = useState<string | null>(null);

  useEffect(() => {
    // Check if redirected back after OAuth callback
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const connectedProvider = urlParams.get("connected");
      if (connectedProvider) {
        setConnectedBanner(connectedProvider);
        // Clean URL without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, []);

  // Refetch integrations when banner changes (i.e., after returning from OAuth)
  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.getIntegrations(companyId);
        setConnections(res.connections || []);
      } catch (err) {
        console.warn("Failed to fetch integrations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, connectedBanner]);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleConnect = async (providerId: string, name: string) => {
    if (!companyId) {
      alert("Select a workspace before connecting an integration.");
      return;
    }
    setActionLoadingId(providerId);
    try {
      const res = await api.connectIntegration(companyId, providerId);
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      alert(`Could not initiate OAuth for ${name}: no authorization URL returned.`);
    } catch (err: any) {
      alert(`Could not initiate OAuth for ${name}: ${err?.message || "Error"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDisconnect = async (connectionId: string, name: string) => {
    if (!companyId) return;
    if (!confirm(`Are you sure you want to disconnect ${name}?`)) return;
    setActionLoadingId(connectionId);
    try {
      await api.disconnectIntegration(companyId, connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err: any) {
      alert(`Failed to disconnect ${name}: ${err?.message || "Error"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeConnectedAccountMap = new Map(
    connections
      .filter((c) => c.status === "CONNECTED")
      .map((c) => [c.provider.toLowerCase(), c])
  );

  const items = INTEGRATIONS_CATALOG.map((item) => {
    const activeConn = activeConnectedAccountMap.get(item.id);
    return {
      ...item,
      connectionId: activeConn?.id,
      accountName: activeConn?.accountName,
      accountEmail: activeConn?.accountEmail,
      isConnected: Boolean(activeConn),
    };
  });

  const filteredItems = items.filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase())
  );

  const connectedApps = filteredItems.filter((i) => i.isConnected);
  const availableApps = filteredItems.filter((i) => !i.isConnected);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {connectedBanner && (
        <div className="p-4 bg-emerald-900 border border-emerald-700 text-white flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm">Integration Connected Successfully</div>
              <div className="text-emerald-300 text-xs font-mono mt-0.5">
                <strong className="uppercase text-white">{connectedBanner}</strong> is now connected to your workspace. Clones can now access this tool.
              </div>
            </div>
          </div>
          <button
            onClick={() => setConnectedBanner(null)}
            className="text-emerald-400 hover:text-white font-bold cursor-pointer text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Connected Tool Integrations</h1>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {connectedApps.length} active OAuth connection{connectedApps.length !== 1 ? "s" : ""} in {activeCompany?.name || "Your Workspace"} • {availableApps.length} ready to link
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:border-slate-900 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Active Workspace Connections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Workspace Connections ({connectedApps.length})
          </h2>
          <span className="text-[11px] font-mono text-slate-400">OAuth 2.0 Encrypted (AES-256)</span>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-500 text-xs font-mono">
            <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading connected accounts…
          </div>
        ) : connectedApps.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center mb-1">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-700">No connected apps yet</p>
            <p className="text-[11px] font-mono text-slate-400 max-w-xs">Connect your first tool below. Your Clones will automatically gain access to use it.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectedApps.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {APP_ICONS[item.id] || (
                      <span className="font-mono text-xs font-bold text-slate-700">{item.name[0]}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.name}</div>
                    <div className="text-xs font-mono text-slate-500">{item.category}</div>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                  CONNECTED
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {item.description}
              </p>

              {item.accountName && (
                <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 border border-slate-100">
                  Account: <span className="font-bold text-slate-800">{item.accountName}</span> {item.accountEmail ? `(${item.accountEmail})` : ""}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-mono">
                <span className="text-slate-400 text-[11px]">OAuth Scope: Read & Write</span>
                <div className="flex items-center gap-3">
                  <button
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleConnect(item.id, item.name)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {actionLoadingId === item.id ? "Redirecting..." : "Reconnect"}
                  </button>
                  <button
                    disabled={actionLoadingId === (item.connectionId || item.id)}
                    onClick={() => handleDisconnect(item.connectionId || item.id, item.name)}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {actionLoadingId === (item.connectionId || item.id) ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Available Integrations */}
      <div className="space-y-3 pt-6 border-t border-slate-200">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
          Available Tools ({availableApps.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableApps.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {APP_ICONS[item.id] || (
                      <span className="font-mono text-xs font-bold text-slate-700">{item.name[0]}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.name}</div>
                    <div className="text-xs font-mono text-slate-500">{item.category}</div>
                  </div>
                </div>

                <button
                  disabled={actionLoadingId === item.id}
                  onClick={() => handleConnect(item.id, item.name)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-mono text-xs font-semibold cursor-pointer transition-colors shrink-0"
                >
                  {actionLoadingId === item.id ? "Connecting..." : "+ Connect"}
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
