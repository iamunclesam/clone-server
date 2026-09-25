"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/overview",
        label: "Home",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "AI Workforce",
    items: [
      {
        href: "/employees",
        label: "AI Employees",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        ),
      },
      {
        href: "/teams",
        label: "Teams",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m10-6a4 4 0 11-8 0 4 4 0 018 0zM7 10a4 4 0 110-8 4 4 0 010 8z" />
          </svg>
        ),
      },
      {
        href: "/channels",
        label: "Clone Channels",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
      },
      {
        href: "/tasks",
        label: "Tasks",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        href: "/workflows",
        label: "Workflows",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="2" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="19" r="2" />
            <path strokeLinecap="round" d="M8 12h8M16 5H8l-2 7 2 7h8" />
          </svg>
        ),
      },
      {
        href: "/runtime",
        label: "Runtime Engine",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/integrations",
        label: "Connect Apps",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656-5.656l-1.1 1.1" />
          </svg>
        ),
      },
      {
        href: "/workspaces",
        label: "Workspaces",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4" />
          </svg>
        ),
      },
      {
        href: "/memory",
        label: "Memory",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
      {
        href: "/approvals",
        label: "Approvals",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: "/activity",
        label: "Activity",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: null,
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: (
          <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ],
  },
];

const CMD_ACTIONS = [
  { icon: "👤", label: "Hire new AI employee",      hint: "N E", href: "/employees/new" },
  { icon: "⚡", label: "Create task",               hint: "N T", href: "/tasks/new" },
  { icon: "🔀", label: "Build workflow",            hint: "N W", href: "/workflows" },
  { icon: "⚡", label: "Runtime Engine",            hint: "",    href: "/runtime" },
  { icon: "🔗", label: "Connect app integration",  hint: "N I", href: "/integrations" },
  { icon: "🛡️", label: "Review pending approvals",  hint: "",    href: "/approvals" },
  { icon: "📋", label: "Open activity log",        hint: "",    href: "/activity" },
  { icon: "⚙️", label: "Settings",                 hint: "G S", href: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeCompany, companies, switchCompany, logout, loading } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [createWsModalOpen, setCreateWsModalOpen] = useState(false);
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
      if (e.key === "Escape") { setCmdOpen(false); setSidebarOpen(false); setWsDropdownOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Authenticating Clone AI OS session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filteredActions = CMD_ACTIONS.filter(
    (a) => !cmdQuery || a.label.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  const getInitials = (name?: string) => {
    if (!name) return "ME";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-[#f9fafb] text-slate-900 overflow-hidden font-sans">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-slate-200/70 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: 240 }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-100 shrink-0">
          <Link href="/overview" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 flex items-center justify-center shadow-sm shrink-0">
              <img src="https://res.cloudinary.com/dsaqsxtup/image/upload/v1789836149/clone-icon_p3adnc.png" className="rounded" alt="Clone Icon" />
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-slate-900">Clone</span>
          </Link>
        </div>

        {/* Global Search */}
        <div className="px-3 py-3 border-b border-slate-100 shrink-0">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 w-full h-8 px-2.5 border border-slate-200 bg-slate-50 text-slate-400 text-[12px] hover:border-slate-300 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
            </svg>
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 font-mono">⌘K</kbd>
          </button>
        </div>

        {/* Workspace Selector Dropdown & Badge */}
        <div className="px-3 py-3 border-b border-slate-100 shrink-0 relative" ref={wsDropdownRef}>
          <button
            onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
            className="flex items-center justify-between gap-2 w-full p-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                {(activeCompany?.name || "W")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-800 truncate leading-snug">
                  {activeCompany?.name || "Workspace"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {activeCompany?.companyType || "Active Workspace"}
                </div>
              </div>
            </div>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${wsDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {wsDropdownOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-white border border-slate-200 shadow-xl divide-y divide-slate-100 font-sans">
              <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
                <p className="px-2 py-1 text-[10px] font-semibold font-mono text-slate-400 uppercase tracking-wider">
                  Workspaces
                </p>
                {companies.map((c) => {
                  const isActive = c.id === activeCompany?.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        switchCompany(c.id);
                        setWsDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-2 py-1.5 text-[12px] transition-colors cursor-pointer ${
                        isActive ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-mono">
                          {c.name[0].toUpperCase()}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      {isActive && <span className="text-blue-600 font-bold text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setWsDropdownOpen(false);
                    setCreateWsModalOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-2 text-[12px] font-bold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Create New Workspace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx}>
              {group.label && (
                <p className="px-2 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium transition-all duration-100 ${
                        active
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <span className={`shrink-0 ${active ? "text-slate-700" : "text-slate-400"}`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="shrink-0 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center px-1 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Help & User Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-100 shrink-0 space-y-1">
          <Link
            href="/audit-logs"
            className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <svg className="w-[17px] h-[17px] text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1.1 1.1-1.9 1.5-1.9 3M12 17h.01" />
            </svg>
            Help & Audit Logs
          </Link>

          {/* User profile */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 transition-colors group">
            <div className="w-7 h-7 bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 font-mono">
              {getInitials(user?.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-800 truncate">{user?.fullName || "You"}</div>
              <div className="text-[10px] text-slate-400 truncate font-mono">{user?.email || "You"}</div>
            </div>
            <button
              onClick={async () => {
                await logout();
                window.location.href = "/login";
              }}
              title="Sign out"
              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 font-sans shadow-xs">

          {/* Left section: Mobile hamburger + Desktop Page Breadcrumb & Live Status */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden text-slate-400 hover:text-slate-700 transition-colors p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop Breadcrumb & Workspace context */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs font-mono">
              <span className="font-bold text-slate-900 tracking-tight">
                {pathname === "/overview" ? "Command Center" : pathname.replace("/", "").replace(/-/g, " ").toUpperCase()}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-semibold truncate max-w-[180px]">
                {activeCompany?.name || "Your Workspace"}
              </span>
              <span className="px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                API LIVE
              </span>
            </div>
          </div>

          {/* Right section: Actions & Quick User Controls */}
          <div className="flex items-center gap-2.5">

            {/* Create Workspace Button */}
            <button
              onClick={() => setCreateWsModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold font-mono transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Workspace
            </button>

            {/* Hire AI Employee CTA */}
            <Link
              href="/employees/new"
              className="flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold font-mono transition-all shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Hire AI Employee
            </Link>

            {/* Approvals badge */}
            <Link
              href="/approvals"
              className="relative flex items-center gap-1.5 h-8 px-3 border border-amber-200 bg-amber-50 text-amber-800 text-[12px] font-mono font-medium hover:bg-amber-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Approvals</span>
            </Link>

            {/* Notifications */}
            <button className="w-8 h-8 border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* ─── CREATE WORKSPACE MODAL ─────────────────────────────────────── */}
      <CreateWorkspaceModal
        isOpen={createWsModalOpen}
        onClose={() => setCreateWsModalOpen(false)}
      />

      {/* ─── COMMAND PALETTE ────────────────────────────────────────────── */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { setCmdOpen(false); setCmdQuery(""); }} />
          <div className="relative w-full max-w-[520px] bg-white shadow-2xl shadow-slate-900/15 border border-slate-200 overflow-hidden font-sans">

            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-100">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search or run a command…"
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                className="flex-1 bg-transparent text-slate-800 text-sm placeholder:text-slate-400 outline-none"
              />
              <kbd className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono">ESC</kbd>
            </div>

            {/* Results */}
            <div className="py-2 max-h-80 overflow-y-auto">
              {filteredActions.length > 0 ? (
                filteredActions.map((cmd) => (
                  <Link
                    key={cmd.label}
                    href={cmd.href}
                    onClick={() => { setCmdOpen(false); setCmdQuery(""); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span className="w-5 text-center text-base">{cmd.icon}</span>
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5">
                        {cmd.hint}
                      </span>
                    )}
                  </Link>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  No results for "{cmdQuery}"
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">ESC</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
