"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, Team, AIEmployee } from "@/lib/api";

const RAW_API = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_API_URL || "http://localhost:4000/api/v1").trim().replace(/\/+$/, "");
const API_BASE = RAW_API.endsWith("/api/v1") ? RAW_API : `${RAW_API}/api/v1`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(s: string) {
  if (s === "WORKING") return "bg-blue-500 animate-pulse";
  if (s === "ACTIVE") return "bg-emerald-500";
  if (s === "PAUSED") return "bg-slate-300";
  return "bg-slate-300";
}

function statusBadge(s: string) {
  if (s === "WORKING") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "PAUSED") return "bg-slate-100 text-slate-500 border-slate-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function execBadge(s: string) {
  const m: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    EXECUTING: "bg-blue-100 text-blue-700 border-blue-200",
    PLANNING: "bg-violet-100 text-violet-700 border-violet-200",
    QUEUED: "bg-slate-100 text-slate-600 border-slate-200",
    WAITING_FOR_APPROVAL: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return m[s] || "bg-slate-100 text-slate-500 border-slate-200";
}

function relTime(ts?: string) {
  if (!ts) return "—";
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditTeamModal({
  team, companyId, onClose, onSaved,
}: {
  team: Team; companyId: string;
  onClose: () => void; onSaved: (patch: Partial<Team>) => void;
}) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [instructions, setInstructions] = useState(team.instructions || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      await api.updateTeam(companyId, team.id, { name, description, instructions });
      onSaved({ name, description, instructions });
      onClose();
    } catch (e: any) { setError(e?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-slate-200 shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-900">Edit Team</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Team name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Directives & SLA</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4}
              className="w-full border border-slate-200 px-3 py-2 text-[12px] text-slate-800 focus:outline-none focus:border-slate-400 resize-none font-mono"
              placeholder="Operating instructions, SLA, priorities…" />
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium cursor-pointer">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 text-[12px] bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-60 cursor-pointer">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "members" | "runtime" | "activity";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id: teamId } = params instanceof Promise ? use(params) : params;
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [team, setTeam] = useState<Team | null>(null);
  const [allEmployees, setAllEmployees] = useState<AIEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [executions, setExecutions] = useState<any[]>([]);
  const [execLoading, setExecLoading] = useState(false);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settingLeadId, setSettingLeadId] = useState<string | null>(null);

  // ── Load team + all employees ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [teamsRes, empRes] = await Promise.all([
        api.getTeams(companyId),
        api.getEmployees(companyId),
      ]);
      setTeam(teamsRes.teams?.find((t) => t.id === teamId) || null);
      setAllEmployees(empRes.employees || []);
    } catch (err) {
      console.warn("Team load error:", err);
    } finally { setLoading(false); }
  }, [companyId, teamId]);

  // ── Load activity (team-wide) ─────────────────────────────────────────────
  const loadActivity = useCallback(async () => {
    if (!companyId) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/activity?limit=80`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setActivity(data.data?.activities || []);
    } catch { /* silent */ } finally { setActivityLoading(false); }
  }, [companyId]);

  // ── Load runtime executions for all team members ──────────────────────────
  const loadExecutions = useCallback(async (t: Team) => {
    if (!companyId) return;
    setExecLoading(true);
    try {
      const results: any[] = [];
      await Promise.all(
        t.members.map(async (member) => {
          try {
            const res = await fetch(
              `${API_BASE}/companies/${companyId}/runtime/clones/${member.id}/executions?limit=6`,
              { credentials: "include" }
            );
            const data = await res.json();
            if (data.success) {
              (data.data?.executions || []).forEach((e: any) => {
                results.push({ ...e, memberName: member.name, memberRole: member.role });
              });
            }
          } catch { /* silent */ }
        })
      );
      results.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
      setExecutions(results.slice(0, 40));
    } finally { setExecLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "activity") loadActivity();
  }, [tab, loadActivity]);

  useEffect(() => {
    if (tab === "runtime" && team) loadExecutions(team);
  }, [tab, team, loadExecutions]);

  // ── Member actions ────────────────────────────────────────────────────────
  async function assignMember(empId: string) {
    if (!companyId || !team) return;
    setAssigningId(empId);
    try {
      await api.assignTeamMembers(companyId, team.id, [empId]);
      await load();
    } catch (e: any) { alert(e?.message || "Failed to assign"); }
    finally { setAssigningId(null); }
  }

  async function removeMember(empId: string) {
    if (!companyId || !team || !confirm("Remove this member from the team?")) return;
    setRemovingId(empId);
    try {
      await api.removeTeamMember(companyId, team.id, empId);
      await load();
    } catch (e: any) { alert(e?.message || "Failed to remove"); }
    finally { setRemovingId(null); }
  }

  async function setLead(empId: string) {
    if (!companyId || !team) return;
    setSettingLeadId(empId);
    try {
      await api.setTeamLead(companyId, team.id, empId);
      await load();
    } catch (e: any) { alert(e?.message || "Failed to set lead"); }
    finally { setSettingLeadId(null); }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const memberMap = new Map(allEmployees.map((e) => [e.id, e]));
  const memberIds = new Set((team?.members || []).map((m) => m.id));
  const unassigned = allEmployees.filter((e) => !memberIds.has(e.id));
  const lead = team?.members.find((m) => m.id === team.leadEmployeeId) || team?.leadEmployee;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members", count: team?.memberCount },
    { id: "runtime", label: "Runtime", count: executions.length || undefined },
    { id: "activity", label: "Activity" },
  ];

  if (loading) return (
    <div className="p-10 flex items-center justify-center">
      <p className="text-[12px] text-slate-400 font-mono">Loading team…</p>
    </div>
  );

  if (!team) return (
    <div className="p-10 text-center space-y-3">
      <p className="text-[13px] text-slate-500">Team not found.</p>
      <Link href="/teams" className="text-blue-600 text-[12px] hover:underline">← Back to teams</Link>
    </div>
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5 font-sans">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <Link href="/teams" className="text-[11px] text-slate-400 hover:text-slate-600 font-mono flex items-center gap-1 mb-3">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Teams
        </Link>

        <div className="bg-white border border-slate-200 p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-slate-900 text-white flex items-center justify-center text-xl font-bold font-mono shrink-0">
              {initials(team.name)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{team.name}</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200">● ACTIVE</span>
                <span className="text-[10px] font-mono text-slate-400 border border-slate-200 px-2 py-0.5">
                  {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                </span>
              </div>
              {team.description && (
                <p className="text-[13px] text-slate-500 mt-1 max-w-[480px]">{team.description}</p>
              )}
              {lead && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-mono text-slate-400">Lead:</span>
                  <div className="w-5 h-5 bg-amber-100 text-amber-800 text-[10px] font-bold font-mono flex items-center justify-center">
                    {lead.name[0]}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700">{lead.name}</span>
                  <span className="text-[10px] text-slate-400">— {lead.role}</span>
                  <span className="text-[9px] font-mono font-bold text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5">👑 LEAD</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/runtime"
              className="h-8 px-3 border border-slate-200 text-slate-700 text-[12px] font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Runtime
            </Link>
            <button onClick={() => setEditOpen(true)}
              className="h-8 px-3 border border-slate-200 text-slate-700 text-[12px] font-medium hover:bg-slate-50 transition-colors cursor-pointer">
              Edit Team
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[12px] font-semibold flex items-center gap-1.5 border-b-2 transition-colors -mb-px cursor-pointer ${tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* OVERVIEW TAB                                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Members", value: team.memberCount, color: "text-slate-900" },
                { label: "Working now", value: team.members.filter((m) => (memberMap.get(m.id)?.status || m.status) === "WORKING").length, color: "text-blue-600" },
                { label: "Paused", value: team.members.filter((m) => (memberMap.get(m.id)?.status || m.status) === "PAUSED").length, color: "text-slate-400" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 p-4 text-center">
                  <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Directives */}
            <div className="bg-white border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wide font-mono">Directives & SLA</h3>
                <button onClick={() => setEditOpen(true)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer">Edit →</button>
              </div>
              {team.instructions ? (
                <div className="p-3 bg-slate-50 border border-slate-200 font-mono text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {team.instructions}
                </div>
              ) : (
                <div className="p-5 border border-dashed border-slate-200 text-center">
                  <p className="text-[12px] text-slate-400">No directives set.</p>
                  <button onClick={() => setEditOpen(true)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 cursor-pointer">
                    Add directives →
                  </button>
                </div>
              )}
            </div>

            {/* Roster preview */}
            <div className="bg-white border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wide font-mono">Team Roster</h3>
                <button onClick={() => setTab("members")} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                  Manage →
                </button>
              </div>
              {team.members.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-4">No members assigned yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {team.members.map((member) => {
                    const full = memberMap.get(member.id);
                    const isLead = member.id === team.leadEmployeeId || member.id === team.leadEmployee?.id;
                    return (
                      <div key={member.id} className="flex items-center gap-3 py-2.5">
                        <div className="relative shrink-0">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} className="w-8 h-8 object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-800 text-white text-[11px] font-bold font-mono flex items-center justify-center">
                              {initials(member.name)}
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${statusDot(full?.status || "ACTIVE")}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-slate-800">{member.name}</span>
                            {isLead && <span className="text-[9px] font-mono font-bold text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5">👑 LEAD</span>}
                          </div>
                          <span className="text-[11px] text-slate-500">{member.role}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusBadge(full?.status || "ACTIVE")}`}>
                          {full?.status || "ACTIVE"}
                        </span>
                        <Link href={`/employees/${member.id}`} className="text-[11px] text-slate-400 hover:text-slate-700 font-mono">View →</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-5">
              <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wide font-mono mb-4">Team Info</h3>
              <div className="divide-y divide-slate-100 text-[12px] font-mono">
                {[
                  ["Name", team.name],
                  ["Members", `${team.memberCount}`],
                  ["Lead", lead?.name || "Unassigned"],
                  ["Created", team.createdAt ? new Date(team.createdAt).toLocaleDateString() : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[130px]">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5">
              <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wide font-mono mb-3">Quick Actions</h3>
              <div className="space-y-1.5">
                {[
                  { label: "+ Add / remove members", action: () => setTab("members") },
                  { label: "✏️ Edit team settings", action: () => setEditOpen(true) },
                  { label: "⚡ View runtime", action: () => setTab("runtime") },
                  { label: "📋 Activity logs", action: () => setTab("activity") },
                ].map((item) => (
                  <button key={item.label} onClick={item.action}
                    className="w-full text-left px-3 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] text-slate-700 font-medium transition-colors cursor-pointer">
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MEMBERS TAB                                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === "members" && (
        <div className="space-y-5">

          {/* Current members */}
          <div className="bg-white border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-[13px] font-bold text-slate-900">Current Members ({team.memberCount})</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Click "Set as Lead" to promote a member. Remove to unassign from this team.</p>
            </div>

            {team.members.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-slate-400">
                No members yet. Assign employees below.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {team.members.map((member) => {
                  const full = memberMap.get(member.id);
                  const isLead = member.id === team.leadEmployeeId || member.id === team.leadEmployee?.id;
                  const perms = (full?.permissions || []) as any[];
                  const tools = [...new Set(perms.map((p) =>
                    p.toolName?.includes(".") ? p.toolName.split(".")[0] : p.toolName
                  ))].filter(Boolean).slice(0, 5);

                  return (
                    <div key={member.id} className="px-5 py-4 flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-800 text-white text-[13px] font-bold font-mono flex items-center justify-center">
                            {initials(member.name)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDot(full?.status || "ACTIVE")}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/employees/${member.id}`} className="text-[13px] font-bold text-slate-900 hover:text-blue-600">
                            {member.name}
                          </Link>
                          {isLead && (
                            <span className="text-[9px] font-mono font-bold text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5">👑 LEAD</span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusBadge(full?.status || "ACTIVE")}`}>
                            {full?.status || "ACTIVE"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{member.role}</p>
                        {tools.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {tools.map((t) => (
                              <span key={t} className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 border border-slate-200">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {!isLead && (
                          <button onClick={() => setLead(member.id)} disabled={settingLeadId === member.id}
                            className="text-[11px] px-2.5 py-1 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold transition-colors cursor-pointer disabled:opacity-50">
                            {settingLeadId === member.id ? "Setting…" : "Set as Lead"}
                          </button>
                        )}
                        <Link href={`/employees/${member.id}`}
                          className="text-[11px] px-2.5 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                          Profile →
                        </Link>
                        <button onClick={() => removeMember(member.id)} disabled={removingId === member.id}
                          className="text-[11px] px-2.5 py-1 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors cursor-pointer disabled:opacity-50">
                          {removingId === member.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add members */}
          {unassigned.length > 0 && (
            <div className="bg-white border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-[13px] font-bold text-slate-900">Add to Team</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{unassigned.length} employee{unassigned.length !== 1 ? "s" : ""} not yet on this team</p>
              </div>
              <div className="divide-y divide-slate-100">
                {unassigned.map((emp) => (
                  <div key={emp.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 text-white text-[11px] font-bold font-mono flex items-center justify-center shrink-0">
                      {initials(emp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800">{emp.name}</p>
                      <p className="text-[11px] text-slate-500">{emp.role}</p>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${statusBadge(emp.status)}`}>
                      {emp.status}
                    </span>
                    <button onClick={() => assignMember(emp.id)} disabled={assigningId === emp.id}
                      className="text-[11px] px-3 py-1.5 bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer">
                      {assigningId === emp.id ? "Adding…" : "+ Add"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassigned.length === 0 && team.members.length > 0 && (
            <div className="bg-white border border-slate-200 p-5 text-center">
              <p className="text-[12px] text-slate-400">All employees in this workspace are already on this team.</p>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* RUNTIME TAB                                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === "runtime" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Team Runtime Executions</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Recent executions across all {team.memberCount} team members.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => team && loadExecutions(team)} disabled={execLoading}
                className="h-8 px-3 border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                {execLoading ? "Loading…" : "↻ Refresh"}
              </button>
              <Link href="/runtime" className="h-8 px-3 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 transition-colors flex items-center">
                Full Dashboard →
              </Link>
            </div>
          </div>

          {/* Per-member status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.members.map((member) => {
              const full = memberMap.get(member.id);
              const memberExecs = executions.filter((e) => e.cloneId === member.id || e.memberName === member.name);
              const latest = memberExecs[0];
              return (
                <Link key={member.id} href={`/runtime/${member.id}`}
                  className="bg-white border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 bg-slate-800 text-white text-[11px] font-bold font-mono flex items-center justify-center">
                        {initials(member.name)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${statusDot(full?.status || "ACTIVE")}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-900 truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-500">{member.role}</p>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${statusBadge(full?.status || "ACTIVE")}`}>
                      {full?.status || "ACTIVE"}
                    </span>
                  </div>
                  {latest ? (
                    <div className="bg-slate-50 border border-slate-100 p-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${execBadge(latest.status)}`}>
                          {latest.status?.replace(/_/g, " ")}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">{relTime(latest.startedAt)}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-mono mt-1 truncate">{latest.triggerSource}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-mono">No recent executions</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2 group-hover:text-blue-600 transition-colors">
                    {memberExecs.length} execution{memberExecs.length !== 1 ? "s" : ""} · View runtime →
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Full execution log */}
          <div className="bg-white border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[12px] font-bold text-slate-900 font-mono uppercase">All Executions</h3>
            </div>
            {execLoading ? (
              <div className="px-5 py-8 text-center text-[12px] text-slate-400 font-mono">Loading executions…</div>
            ) : executions.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12px] text-slate-400">
                No executions yet. Compile runtimes and ingest events from the{" "}
                <Link href="/runtime" className="text-blue-600 hover:underline">Runtime Dashboard</Link>.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {executions.map((exec, i) => (
                  <div key={exec.id || i} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-7 h-7 bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      {initials(exec.memberName || "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-slate-800">{exec.memberName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">·</span>
                        <span className="text-[11px] font-mono text-slate-600 truncate max-w-[200px]">{exec.triggerSource}</span>
                      </div>
                      {exec.error && <p className="text-[10px] text-red-500 mt-0.5 truncate">{exec.error}</p>}
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${execBadge(exec.status)}`}>
                      {exec.status?.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{relTime(exec.startedAt)}</span>
                    {exec.cloneId && (
                      <Link href={`/runtime/${exec.cloneId}`} className="text-[10px] text-slate-400 hover:text-blue-600 font-mono shrink-0">
                        Detail →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ACTIVITY TAB                                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === "activity" && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Activity Logs</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Company-wide activity filtered to this team's members.</p>
            </div>
            <button onClick={loadActivity} disabled={activityLoading}
              className="h-8 px-3 border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-50">
              {activityLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          <div className="bg-white border border-slate-200 divide-y divide-slate-100">
            {activityLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex gap-3">
                  <div className="w-7 h-7 bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 w-1/3" />
                    <div className="h-2.5 bg-slate-50 w-2/3" />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-slate-400">
                No activity yet.{" "}
                <button onClick={loadActivity} className="text-blue-600 underline cursor-pointer">Load logs</button>
              </div>
            ) : (
              activity.map((log: any) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-800">{log.action?.replace(/_/g, " ")}</span>
                      {log.resource && (
                        <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">{log.resource}</span>
                      )}
                    </div>
                    {log.details && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{log.details}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>{log.actorName}</span>
                      <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      {editOpen && companyId && (
        <EditTeamModal
          team={team}
          companyId={companyId}
          onClose={() => setEditOpen(false)}
          onSaved={(patch) => setTeam((t) => t ? { ...t, ...patch } : t)}
        />
      )}
    </div>
  );
}
