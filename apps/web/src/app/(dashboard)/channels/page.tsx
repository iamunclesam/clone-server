"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  api,
  Channel,
  ChannelMessage,
  AIEmployee,
  Team,
  getApiBaseUrl,
} from "@/lib/api";
import { FormattedText } from "@/components/FormattedText";

const API_BASE = getApiBaseUrl();

const MSG_BADGES: Record<string, { label: string; cls: string }> = {
  DISCUSSION: {
    label: "Chat",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  },
  TASK_REQUEST: {
    label: "Task",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DELEGATION: {
    label: "Delegation",
    cls: "bg-purple-50 text-purple-700 border-purple-200",
  },
  DECISION: {
    label: "Decision",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  STATUS_UPDATE: {
    label: "Status",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeStr(ts?: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relDay(ts?: string) {
  if (!ts) return "";

  const d = new Date(ts);
  const today = new Date();

  if (d.toDateString() === today.toDateString()) return "Today";

  const y = new Date(today);
  y.setDate(y.getDate() - 1);

  if (d.toDateString() === y.toDateString()) return "Yesterday";

  return d.toLocaleDateString();
}

export default function ChannelsPage() {
  const { activeCompany, user } = useAuth();
  const companyId = activeCompany?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [employees, setEmployees] = useState<AIEmployee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Mobile UI only
  const [mobileSidebar, setMobileSidebar] = useState<
    "channels" | "members" | null
  >(null);

  // composer
  const [senderMode, setSenderMode] = useState<"human" | string>("human");
  const [inputContent, setInputContent] = useState("");
  const [msgType, setMsgType] = useState<
    "DISCUSSION" | "TASK_REQUEST" | "DELEGATION" | "DECISION" | "STATUS_UPDATE"
  >("DISCUSSION");
  const [mentionId, setMentionId] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [chRes, empRes, teamRes] = await Promise.all([
        api.getChannels(companyId),
        api.getEmployees(companyId),
        api.getTeams(companyId),
      ]);

      const fetchedTeams = teamRes.teams || [];
      const fetchedEmployees = empRes.employees || [];
      let fetchedChannels = chRes.channels || [];

      // Auto-create a dedicated channel for each team that doesn't have one
      for (const team of fetchedTeams) {
        const slug = team.name.toLowerCase().replace(/\s+/g, "-");

        const exists = fetchedChannels.some((c) => {
          const tid =
            typeof c.teamId === "object" && c.teamId !== null
              ? (c.teamId as any).id || (c.teamId as any)._id
              : c.teamId;

          return tid === team.id || c.name === slug;
        });

        if (!exists) {
          try {
            const res = await api.createChannel(companyId, {
              name: slug,
              type: "TEAM",
              teamId: team.id,
              topic: `${team.name} — team channel`,
              memberIds: team.members.map((m) => m.id),
            });

            fetchedChannels = [res.channel, ...fetchedChannels];
          } catch {
            /* already exists */
          }
        }
      }

      setTeams(fetchedTeams);
      setEmployees(fetchedEmployees);
      setChannels(fetchedChannels);

      if (!activeChannelId && fetchedChannels.length > 0) {
        setActiveChannelId(fetchedChannels[0].id);
      }
    } catch (err) {
      console.warn("Channels load error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [companyId]);

  // ── poll messages ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || !activeChannelId) return;

    const fetch = async () => {
      try {
        const res = await api.getChannelMessages(
          companyId,
          activeChannelId
        );

        setMessages(res.messages || []);
      } catch {
        /* silent */
      }
    };

    fetch();

    const iv = setInterval(fetch, 3000);

    return () => clearInterval(iv);
  }, [companyId, activeChannelId]);

  // ── scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── send message ─────────────────────────────────────────────────────────
  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!companyId || !activeChannelId || !inputContent.trim()) return;

    // Human sends through the first available clone as technical sender
    const resolvedSenderId =
      senderMode === "human" ? employees[0]?.id : senderMode;

    if (!resolvedSenderId) {
      alert("Add at least one AI employee first.");
      return;
    }

    const content =
      senderMode === "human"
        ? `[${user?.fullName || "You"}]: ${inputContent}`
        : inputContent;

    setSending(true);

    try {
      const mentions = mentionId ? [mentionId] : [];

      const res = await api.sendMessage(companyId, activeChannelId, {
        senderId: resolvedSenderId,
        content,
        messageType: msgType,
        mentions,
        createTaskIfRequested:
          msgType === "TASK_REQUEST" || msgType === "DELEGATION",
      });

      setMessages((prev) => [...prev, res.message]);
      setInputContent("");
      setMentionId("");

      inputRef.current?.focus();
    } catch (err: any) {
      alert(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // ── derived ──────────────────────────────────────────────────────────────
  const activeChannel = channels.find(
    (c) => c.id === activeChannelId
  );

  const activeTeamId = activeChannel
    ? typeof activeChannel.teamId === "object" &&
      activeChannel.teamId !== null
      ? (activeChannel.teamId as any).id
      : activeChannel.teamId
    : null;

  const activeTeam = teams.find(
    (t) => t.id === activeTeamId
  );

  const channelMembers =
    activeTeam?.members ||
    (Array.isArray(activeChannel?.members)
      ? (activeChannel!.members as any[])
      : []);

  const teamChannels = channels.filter(
    (c) => c.type === "TEAM"
  );

  const crossChannels = channels.filter(
    (c) => c.type === "CROSS_TEAM"
  );

  const directChannels = channels.filter(
    (c) => c.type === "DIRECT"
  );

  // Group messages by day
  type MsgGroup = {
    day: string;
    msgs: ChannelMessage[];
  };

  const grouped: MsgGroup[] = [];

  for (const msg of messages) {
    const day = relDay(msg.createdAt);
    const last = grouped[grouped.length - 1];

    if (!last || last.day !== day) {
      grouped.push({
        day,
        msgs: [msg],
      });
    } else {
      last.msgs.push(msg);
    }
  }

  // Mobile helper
  const selectChannel = (id: string) => {
    setActiveChannelId(id);
    setMobileSidebar(null);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex font-sans bg-white overflow-hidden relative">

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE BACKDROP
      ═══════════════════════════════════════════════════════════════ */}
      {mobileSidebar && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebar(null)}
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden cursor-default"
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          LEFT SIDEBAR — DESKTOP
      ═══════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex w-[220px] bg-slate-900 flex-col shrink-0 border-r border-slate-800">

        <div className="px-4 py-3.5 border-b border-slate-800">
          <p className="text-[13px] font-bold text-white truncate">
            {activeCompany?.name || "Workspace"}
          </p>

          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            Clone Channels
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">

          {/* Team channels */}
          {teamChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Teams
              </p>

              {teamChannels.map((ch) => {
                const tid =
                  typeof ch.teamId === "object" &&
                  ch.teamId !== null
                    ? (ch.teamId as any).id
                    : ch.teamId;

                const team = teams.find(
                  (t) => t.id === tid
                );

                const active =
                  ch.id === activeChannelId;

                return (
                  <button
                    key={ch.id}
                    onClick={() =>
                      setActiveChannelId(ch.id)
                    }
                    className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[12px] font-mono transition-colors cursor-pointer ${
                      active
                        ? "bg-slate-700 text-white font-bold"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-slate-500 shrink-0">
                      #
                    </span>

                    <span className="truncate flex-1">
                      {ch.name}
                    </span>

                    {team && (
                      <span className="text-[9px] text-slate-600 shrink-0">
                        {team.memberCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Cross-team */}
          {crossChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Cross-Team
              </p>

              {crossChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() =>
                    setActiveChannelId(ch.id)
                  }
                  className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[12px] font-mono transition-colors cursor-pointer ${
                    ch.id === activeChannelId
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span className="text-slate-500 shrink-0">
                    ⇄
                  </span>

                  <span className="truncate">
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Direct */}
          {directChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Direct
              </p>

              {directChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() =>
                    setActiveChannelId(ch.id)
                  }
                  className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[12px] font-mono transition-colors cursor-pointer ${
                    ch.id === activeChannelId
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span className="text-slate-500 shrink-0">
                    ●
                  </span>

                  <span className="truncate">
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clones */}
          <div>
            <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Clones
            </p>

            {employees.map((emp) => (
              <div
                key={emp.id}
                className="px-2.5 py-1 flex items-center gap-2"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    emp.status === "WORKING"
                      ? "bg-blue-400 animate-pulse"
                      : emp.status === "ACTIVE"
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                  }`}
                />

                <span className="text-[11px] font-mono text-slate-400 truncate">
                  {emp.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE CHANNEL DRAWER
      ═══════════════════════════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-slate-900 flex flex-col border-r border-slate-800 transform transition-transform duration-200 md:hidden ${
          mobileSidebar === "channels"
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white truncate">
              {activeCompany?.name || "Workspace"}
            </p>

            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              Clone Channels
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileSidebar(null)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">

          {/* Teams */}
          {teamChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Teams
              </p>

              {teamChannels.map((ch) => {
                const tid =
                  typeof ch.teamId === "object" &&
                  ch.teamId !== null
                    ? (ch.teamId as any).id
                    : ch.teamId;

                const team = teams.find(
                  (t) => t.id === tid
                );

                return (
                  <button
                    key={ch.id}
                    onClick={() =>
                      selectChannel(ch.id)
                    }
                    className={`w-full text-left px-2.5 py-2 flex items-center gap-2 text-[12px] font-mono transition-colors ${
                      ch.id === activeChannelId
                        ? "bg-slate-700 text-white font-bold"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-slate-500 shrink-0">
                      #
                    </span>

                    <span className="truncate flex-1">
                      {ch.name}
                    </span>

                    {team && (
                      <span className="text-[9px] text-slate-600">
                        {team.memberCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Cross Team */}
          {crossChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Cross-Team
              </p>

              {crossChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() =>
                    selectChannel(ch.id)
                  }
                  className={`w-full text-left px-2.5 py-2 flex items-center gap-2 text-[12px] font-mono ${
                    ch.id === activeChannelId
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span className="text-slate-500">
                    ⇄
                  </span>

                  <span className="truncate">
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Direct */}
          {directChannels.length > 0 && (
            <div>
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Direct
              </p>

              {directChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() =>
                    selectChannel(ch.id)
                  }
                  className={`w-full text-left px-2.5 py-2 flex items-center gap-2 text-[12px] font-mono ${
                    ch.id === activeChannelId
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span className="text-slate-500">
                    ●
                  </span>

                  <span className="truncate">
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clones */}
          <div>
            <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Clones
            </p>

            {employees.map((emp) => (
              <div
                key={emp.id}
                className="px-2.5 py-2 flex items-center gap-2"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    emp.status === "WORKING"
                      ? "bg-blue-400 animate-pulse"
                      : emp.status === "ACTIVE"
                      ? "bg-emerald-400"
                      : "bg-slate-600"
                  }`}
                />

                <span className="text-[11px] font-mono text-slate-400 truncate">
                  {emp.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CHAT
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="min-h-12 border-b border-slate-200 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 shrink-0 bg-white">

          <div className="flex items-center gap-2 min-w-0 flex-1">

            {/* Mobile channels */}
            <button
              type="button"
              onClick={() =>
                setMobileSidebar("channels")
              }
              className="md:hidden w-8 h-8 shrink-0 border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center text-sm"
              aria-label="Open channels"
            >
              ☰
            </button>

            <span className="text-[17px] sm:text-[18px] font-bold text-slate-300 shrink-0">
              #
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] sm:text-[14px] font-bold text-slate-900 truncate">
                  {activeChannel?.name ||
                    "Select a channel"}
                </span>

                {activeChannel?.type && (
                  <span className="hidden sm:inline text-[9px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                    {activeChannel.type}
                  </span>
                )}
              </div>

              {activeChannel?.topic && (
                <span className="hidden lg:block text-[11px] text-slate-400 truncate">
                  — {activeChannel.topic}
                </span>
              )}
            </div>
          </div>

          {/* Mobile members button / Desktop member avatars */}
          {channelMembers.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setMobileSidebar("members")
                }
                className="lg:hidden flex items-center gap-1.5 shrink-0 px-2 py-1.5 border border-slate-200 bg-slate-50"
                aria-label="Open members"
              >
                <div className="flex -space-x-1">
                  {channelMembers
                    .slice(0, 3)
                    .map((m: any) => (
                      <div
                        key={m.id}
                        className="w-6 h-6 bg-slate-800 text-white text-[8px] font-bold flex items-center justify-center border-2 border-white"
                      >
                        {initials(m.name)}
                      </div>
                    ))}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {channelMembers.length}
                </span>
              </button>

              <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                <div className="flex -space-x-1">
                  {channelMembers
                    .slice(0, 5)
                    .map((m: any) => (
                      <div
                        key={m.id}
                        title={m.name}
                        className="w-6 h-6 bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white"
                      >
                        {initials(m.name)}
                      </div>
                    ))}
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {channelMembers.length} members
                </span>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 bg-white">

          {loading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[12px] text-slate-400 font-mono">
                Loading…
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16 px-4">
              <div className="w-12 h-12 bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-400">
                #
              </div>

              <p className="text-[14px] font-bold text-slate-700">
                {activeChannel
                  ? `#${activeChannel.name}`
                  : "Select a channel to start"}
              </p>

              <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">
                {activeTeam
                  ? `This is the dedicated channel for the ${activeTeam.name} team. Send a message, @mention a clone, or create a task.`
                  : "Send a message below."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">

              {grouped.map(({ day, msgs }) => (
                <div key={day}>

                  {/* Day divider */}
                  <div className="flex items-center gap-2 sm:gap-3 py-3">
                    <div className="flex-1 h-px bg-slate-100" />

                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 font-mono shrink-0">
                      {day}
                    </span>

                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {msgs.map((msg, i) => {
                    const sender: any =
                      msg.senderId || {};

                    const badge =
                      MSG_BADGES[msg.messageType] ||
                      MSG_BADGES.DISCUSSION;

                    const content =
                      typeof msg.content === "string"
                        ? msg.content
                        : "";

                    const isHuman =
                      content.startsWith("[") &&
                      content.includes("]: ");

                    const humanName = isHuman
                      ? content.match(
                          /^\[([^\]]+)\]/
                        )?.[1] || "You"
                      : null;

                    const displayText = isHuman
                      ? content.replace(
                          /^\[[^\]]+\]:\s/,
                          ""
                        )
                      : content;

                    const mentions: any[] =
                      Array.isArray(msg.mentions)
                        ? msg.mentions
                        : [];

                    const prev = msgs[i - 1];

                    const prevSender: any =
                      prev?.senderId || {};

                    const compact =
                      !isHuman &&
                      prevSender?.id &&
                      prevSender.id === sender?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`group flex items-start gap-2 sm:gap-3 px-1.5 sm:px-2 py-1 -mx-1.5 sm:-mx-2 rounded hover:bg-slate-50 transition-colors ${
                          compact ? "" : "mt-3"
                        }`}
                      >
                        {/* Avatar */}
                        {compact ? (
                          <div className="w-7 sm:w-8 shrink-0 flex justify-center pt-0.5">
                            <span className="text-[8px] sm:text-[9px] text-slate-300 font-mono opacity-0 group-hover:opacity-100 leading-none">
                              {timeStr(
                                msg.createdAt
                              )}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-[11px] font-bold font-mono shrink-0 ${
                              isHuman
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-white"
                            }`}
                          >
                            {isHuman
                              ? initials(
                                  humanName ||
                                    "You"
                                )
                              : initials(
                                  sender.name ||
                                    "?"
                                )}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">

                          {/* Name row */}
                          {!compact && (
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                              {isHuman ? (
                                <span className="text-[12px] sm:text-[13px] font-bold text-blue-700">
                                  {humanName}
                                </span>
                              ) : (
                                <>
                                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-900">
                                    {sender.name ||
                                      "Clone"}
                                  </span>

                                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                                    {sender.role}
                                  </span>
                                </>
                              )}

                              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                                {timeStr(
                                  msg.createdAt
                                )}
                              </span>

                              <span
                                className={`text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 border ${badge.cls}`}
                              >
                                {badge.label}
                              </span>

                              {!isHuman && (
                                <span className="text-[8px] sm:text-[9px] font-mono text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5">
                                  AI
                                </span>
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="break-words [overflow-wrap:anywhere]">
                            <FormattedText
                              content={displayText}
                              isUser={isHuman}
                            />
                          </div>

                          {/* Mentions */}
                          {mentions.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {mentions.map(
                                (m: any) => (
                                  <span
                                    key={
                                      m.id || m
                                    }
                                    className="text-[9px] sm:text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 max-w-full truncate"
                                  >
                                    @{m.name || m}
                                  </span>
                                )
                              )}
                            </div>
                          )}

                          {/* Linked task */}
                          {msg.taskId && (
                            <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-[10px] sm:text-[11px] font-mono max-w-full">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />

                              <span className="font-bold text-amber-800">
                                Task:
                              </span>

                              <span className="text-amber-700 truncate max-w-[160px] sm:max-w-none">
                                {(msg.taskId as any)
                                  .title ||
                                  "Created"}
                              </span>

                              <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 border border-amber-300 bg-amber-100 px-1">
                                {(msg.taskId as any)
                                  .status ||
                                  "PENDING"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════
            COMPOSER
        ═════════════════════════════════════════════════════════════ */}
        <div className="bg-white border-t border-slate-200 px-3 sm:px-5 py-3 shrink-0">
          <form
            onSubmit={handleSend}
            className="space-y-2"
          >

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-[11px] font-mono">

              {/* Sender */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">
                  Send as:
                </span>

                <select
                  value={senderMode}
                  onChange={(e) =>
                    setSenderMode(e.target.value)
                  }
                  className="h-7 max-w-[170px] sm:max-w-none px-2 bg-white border border-slate-200 text-[10px] sm:text-[11px] font-mono focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="human">
                    👤 You (
                    {user?.fullName || "Human"})
                  </option>

                  {employees.map((emp) => (
                    <option
                      key={emp.id}
                      value={emp.id}
                    >
                      🤖 {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">
                  Type:
                </span>

                <select
                  value={msgType}
                  onChange={(e: any) =>
                    setMsgType(e.target.value)
                  }
                  className="h-7 max-w-[150px] sm:max-w-none px-2 bg-white border border-slate-200 text-[10px] sm:text-[11px] font-mono focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="DISCUSSION">
                    💬 Discussion
                  </option>
                  <option value="TASK_REQUEST">
                    📋 Task Request
                  </option>
                  <option value="DELEGATION">
                    🔀 Delegation
                  </option>
                  <option value="DECISION">
                    ✅ Decision
                  </option>
                  <option value="STATUS_UPDATE">
                    📊 Status Update
                  </option>
                </select>
              </div>

              {/* Mention */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 shrink-0">
                  @mention:
                </span>

                <select
                  value={mentionId}
                  onChange={(e) =>
                    setMentionId(e.target.value)
                  }
                  className="h-7 max-w-[140px] sm:max-w-none px-2 bg-white border border-slate-200 text-[10px] sm:text-[11px] font-mono focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="">
                    None
                  </option>

                  {employees.map((emp) => (
                    <option
                      key={emp.id}
                      value={emp.id}
                    >
                      @{emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {(msgType === "TASK_REQUEST" ||
                msgType === "DELEGATION") &&
                mentionId && (
                  <span className="text-amber-600 text-[9px] sm:text-[10px]">
                    ⚡ Auto-creates a task for the
                    mentioned clone
                  </span>
                )}
            </div>

            {/* Input */}
            <div className="flex flex-col sm:flex-row gap-2">

              <div className="flex-1 min-w-0 flex items-center border border-slate-200 bg-white px-3 focus-within:border-slate-400 transition-colors gap-2">

                <span
                  className={`text-[10px] sm:text-[11px] font-mono font-semibold shrink-0 max-w-[70px] sm:max-w-none truncate ${
                    senderMode === "human"
                      ? "text-blue-500"
                      : "text-violet-500"
                  }`}
                >
                  {senderMode === "human"
                    ? user?.fullName?.split(
                        " "
                      )[0] || "You"
                    : employees.find(
                        (e) =>
                          e.id === senderMode
                      )?.name?.split(" ")[0] ||
                      "Clone"}
                </span>

                <span className="text-slate-200 shrink-0">
                  |
                </span>

                <input
                  ref={inputRef}
                  type="text"
                  value={inputContent}
                  onChange={(e) =>
                    setInputContent(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message #${
                    activeChannel?.name ||
                    "channel"
                  }${
                    mentionId
                      ? ` — @${
                          employees.find(
                            (e) =>
                              e.id === mentionId
                          )?.name
                        }`
                      : ""
                  }…`}
                  className="flex-1 min-w-0 h-9 text-[12px] sm:text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={
                  sending ||
                  !inputContent.trim() ||
                  !activeChannelId
                }
                className="h-9 w-full sm:w-auto px-5 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-[12px] font-semibold transition-colors cursor-pointer shrink-0"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT SIDEBAR — DESKTOP
      ═══════════════════════════════════════════════════════════════ */}
      {(activeTeam ||
        channelMembers.length > 0) && (
        <aside className="hidden lg:flex w-[190px] bg-slate-50 border-l border-slate-200 flex-col shrink-0">

          <div className="px-4 py-3 border-b border-slate-200">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide truncate">
              {activeTeam?.name ||
                "Members"}
            </p>

            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              {channelMembers.length} members
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">

            {channelMembers.map(
              (m: any) => {
                const full =
                  employees.find(
                    (e) => e.id === m.id
                  );

                const isLead =
                  m.id ===
                    activeTeam?.leadEmployeeId ||
                  m.id ===
                    activeTeam
                      ?.leadEmployee?.id;

                return (
                  <div
                    key={m.id}
                    className="px-3 py-2 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 bg-slate-800 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                        {initials(m.name)}
                      </div>

                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                          (full?.status ||
                            "ACTIVE") ===
                          "WORKING"
                            ? "bg-blue-400 animate-pulse"
                            : (full?.status ||
                                "ACTIVE") ===
                              "ACTIVE"
                            ? "bg-emerald-400"
                            : "bg-slate-300"
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 truncate">
                        {m.name}
                      </p>

                      <p className="text-[9px] text-slate-400 font-mono truncate">
                        {m.role}
                      </p>
                    </div>

                    {isLead && (
                      <span className="text-[9px]">
                        👑
                      </span>
                    )}
                  </div>
                );
              }
            )}

            {/* You */}
            <div className="mx-3 mt-1 pt-2 border-t border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 text-white text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                {initials(
                  user?.fullName || "You"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-blue-700 truncate">
                  {user?.fullName || "You"}
                </p>

                <p className="text-[9px] text-slate-400 font-mono">
                  Human
                </p>
              </div>

              <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white shrink-0" />
            </div>
          </div>
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE MEMBERS DRAWER
      ═══════════════════════════════════════════════════════════════ */}
      {(activeTeam ||
        channelMembers.length > 0) && (
        <aside
          className={`fixed inset-y-0 right-0 z-50 w-[280px] max-w-[85vw] bg-slate-50 border-l border-slate-200 flex flex-col transform transition-transform duration-200 lg:hidden ${
            mobileSidebar === "members"
              ? "translate-x-0"
              : "translate-x-full"
          }`}
        >

          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide truncate">
                {activeTeam?.name ||
                  "Members"}
              </p>

              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {channelMembers.length} members
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setMobileSidebar(null)
              }
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-lg"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">

            {channelMembers.map(
              (m: any) => {
                const full =
                  employees.find(
                    (e) => e.id === m.id
                  );

                const isLead =
                  m.id ===
                    activeTeam?.leadEmployeeId ||
                  m.id ===
                    activeTeam
                      ?.leadEmployee?.id;

                return (
                  <div
                    key={m.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-slate-100"
                  >
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 bg-slate-800 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                        {initials(m.name)}
                      </div>

                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-50 ${
                          (full?.status ||
                            "ACTIVE") ===
                          "WORKING"
                            ? "bg-blue-400 animate-pulse"
                            : (full?.status ||
                                "ACTIVE") ===
                              "ACTIVE"
                            ? "bg-emerald-400"
                            : "bg-slate-300"
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">
                        {m.name}
                      </p>

                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {m.role}
                      </p>
                    </div>

                    {isLead && (
                      <span className="text-[10px]">
                        👑
                      </span>
                    )}
                  </div>
                );
              }
            )}

            {/* You */}
            <div className="mx-4 mt-2 pt-3 border-t border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                {initials(
                  user?.fullName || "You"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-blue-700 truncate">
                  {user?.fullName || "You"}
                </p>

                <p className="text-[10px] text-slate-400 font-mono">
                  Human
                </p>
              </div>

              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}