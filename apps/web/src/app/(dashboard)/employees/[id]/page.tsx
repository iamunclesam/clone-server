"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, AIEmployee, ConnectedAccount, EmployeePermission } from "@/lib/api";

const API_BASE = process.env.NEXT_API_URL || "http://localhost:4000/api/v1";
const BARK_VOICE_PRESET = "v2/en_speaker_6";

interface BrowserSpeechRecognitionResult {
  transcript: string;
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<BrowserSpeechRecognitionResult>>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface BrowserSpeechRecognitionConstructor {
  new(): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const TABS = [
  "Chat & Queries",
  "Connected Applications",
  "Permissions & Rules",
  "Activity Logs",
  "Employee Profile",
];

// ─── Integration Capability Registry (inlined for web) ──────────────────────

type ActionDef = {
  id: string;        // "github.create_issue"
  label: string;
  description: string;
  write: boolean;
  defaultApproval: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

type ProviderDef = {
  id: string;
  name: string;
  category: string;
  iconUrl: string;
  actions: ActionDef[];
};

const PROVIDER_CATALOG: ProviderDef[] = [
  {
    id: "github", name: "GitHub", category: "Engineering",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
    actions: [
      { id: "github.list_repositories", label: "List repositories", description: "List accessible repos", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "github.read_repository", label: "Read repository", description: "Read files, commits, history", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "github.create_issue", label: "Create issue", description: "Open a GitHub issue", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "github.comment", label: "Comment on PR/issue", description: "Post a comment", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "github.create_branch", label: "Create branch", description: "Create a git branch", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "github.create_pull_request", label: "Open pull request", description: "Open a PR from a branch", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "github.review_pull_request", label: "Review PR", description: "Submit a review on a pull request", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "github.merge_pull_request", label: "Merge PR", description: "Merge an approved pull request", write: true, defaultApproval: true, riskLevel: "HIGH" },
      { id: "github.close_issue", label: "Close issue", description: "Close a GitHub issue", write: true, defaultApproval: false, riskLevel: "LOW" },
    ],
  },
  {
    id: "linear", name: "Linear", category: "Project management",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linear/linear-original.svg",
    actions: [
      { id: "linear.list_issues", label: "List issues", description: "Query and list Linear issues", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "linear.create_issue", label: "Create issue", description: "Create a Linear issue", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "linear.update_issue", label: "Update issue", description: "Update status, priority, or assignee", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "linear.assign_issue", label: "Assign issue", description: "Assign a Linear issue to a team member", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "linear.comment_issue", label: "Comment on issue", description: "Add a comment to a Linear issue", write: true, defaultApproval: false, riskLevel: "LOW" },
    ],
  },
  {
    id: "sentry", name: "Sentry", category: "Monitoring",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sentry/sentry-original.svg",
    actions: [
      { id: "sentry.list_issues", label: "List issues", description: "List open Sentry issues", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "sentry.get_issue", label: "Get issue", description: "Fetch full details for a Sentry issue", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "sentry.get_event", label: "Get event", description: "Fetch a specific error event", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "sentry.resolve_issue", label: "Resolve issue", description: "Mark a Sentry issue as resolved", write: true, defaultApproval: false, riskLevel: "MEDIUM" },
      { id: "sentry.assign_issue", label: "Assign issue", description: "Assign a Sentry issue to a team member", write: true, defaultApproval: false, riskLevel: "LOW" },
    ],
  },
  {
    id: "slack", name: "Slack", category: "Communication",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg",
    actions: [
      { id: "slack.read_channel", label: "Read channel", description: "Read Slack channel message history", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "slack.send_message", label: "Send message", description: "Post a message to a channel", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "slack.send_dm", label: "Send DM", description: "Send a direct message to a user", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "slack.create_channel", label: "Create channel", description: "Create a new Slack channel", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
    ],
  },
  {
    id: "gmail", name: "Gmail", category: "Communication",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg",
    actions: [
      { id: "gmail.read_message", label: "Read email", description: "Read inbox messages and threads", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "gmail.draft_message", label: "Draft email", description: "Create an email draft (not sent)", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "gmail.send_message", label: "Send email", description: "Send an email to a recipient", write: true, defaultApproval: true, riskLevel: "HIGH" },
      { id: "gmail.label_message", label: "Label email", description: "Apply a label to an email thread", write: true, defaultApproval: false, riskLevel: "LOW" },
    ],
  },
  {
    id: "calendar", name: "Google Calendar", category: "Productivity",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg",
    actions: [
      { id: "calendar.read_events", label: "Read events", description: "Read upcoming calendar events", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "calendar.create_event", label: "Create event", description: "Create a new calendar event", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "calendar.update_event", label: "Update event", description: "Update an existing calendar event", write: true, defaultApproval: true, riskLevel: "MEDIUM" },
      { id: "calendar.delete_event", label: "Delete event", description: "Delete a calendar event", write: true, defaultApproval: true, riskLevel: "HIGH" },
    ],
  },
  {
    id: "notion", name: "Notion", category: "Productivity",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/notion/notion-original.svg",
    actions: [
      { id: "notion.search", label: "Search Notion", description: "Search across Notion workspace", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "notion.read_page", label: "Read page", description: "Read content from a page", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "notion.create_page", label: "Create page", description: "Create a new Notion page", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "notion.update_page", label: "Update page", description: "Update content in a page", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "notion.create_database_item", label: "Create database item", description: "Add a row to a Notion database", write: true, defaultApproval: false, riskLevel: "LOW" },
    ],
  },
  {
    id: "vercel", name: "Vercel", category: "Deployment",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg",
    actions: [
      { id: "vercel.list_deployments", label: "List deployments", description: "List recent Vercel deployments", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "vercel.get_deployment", label: "Get deployment", description: "Get details for a deployment", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "vercel.get_project", label: "Get project", description: "Get Vercel project details", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "vercel.create_deployment", label: "Deploy to production", description: "Trigger a new production deployment", write: true, defaultApproval: true, riskLevel: "CRITICAL" },
      { id: "vercel.rollback_deployment", label: "Rollback deployment", "description": "Roll back to a previous deployment", write: true, defaultApproval: true, riskLevel: "CRITICAL" },
      { id: "vercel.cancel_deployment", label: "Cancel deployment", description: "Cancel an in-progress deployment", write: true, defaultApproval: true, riskLevel: "HIGH" },
    ],
  },
  {
    id: "hubspot", name: "HubSpot", category: "CRM",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/hubspot/hubspot-original.svg",
    actions: [
      { id: "hubspot.read_contacts", label: "Read contacts", description: "List and search HubSpot contacts", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "hubspot.create_contact", label: "Create contact", description: "Add a new contact to HubSpot", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "hubspot.update_contact", label: "Update contact", description: "Update a HubSpot contact record", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "hubspot.create_deal", label: "Create deal", description: "Create a new deal in HubSpot", write: true, defaultApproval: false, riskLevel: "LOW" },
      { id: "hubspot.send_email", label: "Send email", description: "Send a marketing or transactional email", write: true, defaultApproval: true, riskLevel: "HIGH" },
    ],
  },
  {
    id: "stripe", name: "Stripe", category: "Finance",
    iconUrl: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/stripe/stripe-original.svg",
    actions: [
      { id: "stripe.read_customers", label: "Read customers", description: "List and search Stripe customers", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "stripe.read_invoices", label: "Read invoices", description: "Read invoice data", write: false, defaultApproval: false, riskLevel: "LOW" },
      { id: "stripe.create_payment_link", label: "Create payment link", description: "Create a Stripe payment link", write: true, defaultApproval: true, riskLevel: "HIGH" },
      { id: "stripe.issue_refund", label: "Issue refund", description: "Refund a payment", write: true, defaultApproval: true, riskLevel: "CRITICAL" },
    ],
  },
];

// ─── Permission state type ───────────────────────────────────────────────────
type PermissionEntry = {
  toolName: string;        // "github.create_issue" or "github" (provider-level)
  writeAccess: boolean;
  requiresApproval: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskColor(r: string) {
  const m: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return m[r] || "bg-slate-100 text-slate-500 border-slate-200";
}

function riskDot(r: string) {
  const m: Record<string, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-amber-400",
    LOW: "bg-emerald-500",
  };
  return m[r] || "bg-slate-300";
}

function FormattedText({ text, isUser }: { text: string; isUser: boolean }) {
  if (!text) return null;
  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-2">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
              return (
                <p key={lIdx} className="leading-relaxed">
                  {parts.map((part, i) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return (
                        <strong key={i} className={isUser ? "font-bold text-white" : "font-bold text-slate-900"}>
                          {part.slice(2, -2)}
                        </strong>
                      );
                    }
                    if (part.startsWith("`") && part.endsWith("`")) {
                      return (
                        <code
                          key={i}
                          className={
                            isUser
                              ? "bg-slate-800 text-blue-200 px-1 py-0.5 rounded font-mono text-[11px]"
                              : "bg-slate-200 text-purple-900 px-1 py-0.5 rounded font-mono text-[11px]"
                          }
                        >
                          {part.slice(1, -1)}
                        </code>
                      );
                    }
                    return part;
                  })}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params as Promise<{ id: string }>) : params as { id: string };
  const employeeId = resolvedParams.id;
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [activeTab, setActiveTab] = useState("Chat & Queries");
  const [employee, setEmployee] = useState<AIEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Chat tab state & history
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updatedAt?: string }>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [autoPlayVoiceReplies, setAutoPlayVoiceReplies] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSynthLoadingIndex, setVoiceSynthLoadingIndex] = useState<number | null>(null);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [voiceCache, setVoiceCache] = useState<Record<number, { src: string; model: string; voicePreset: string }>>({});
  const [chatMessages, setChatMessages] = useState<
    Array<{
      sender: "user" | "ai";
      text: string;
      time: string;
      model?: string;
      contextUsed?: string[];
      approvalRequired?: {
        approvalId: string;
        toolName: string;
        args: any;
        riskReason: string;
        status?: "PENDING" | "APPROVED" | "REJECTED";
      };
      actionExecuted?: { toolName: string; args: any; result: any };
    }>
  >([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Integrations & permissions state
  const [companyIntegrations, setCompanyIntegrations] = useState<ConnectedAccount[]>([]);
  // assignedProviders: provider ids the clone has access to
  const [assignedProviders, setAssignedProviders] = useState<Set<string>>(new Set());
  // permissions: granular per-action settings
  const [permissions, setPermissions] = useState<Record<string, PermissionEntry>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permSaveSuccess, setPermSaveSuccess] = useState(false);
  // Activity logs
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const getSpeechRecognition = () => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  };

  const voiceInputSupported = !!getSpeechRecognition();

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageIndex(null);
  };

  const playAudioSource = async (src: string, messageIndex: number) => {
    stopAudioPlayback();
    const audio = new Audio(src);
    audioRef.current = audio;
    setPlayingMessageIndex(messageIndex);
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingMessageIndex(null);
      }
    };
    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingMessageIndex(null);
        setVoiceError("Unable to play Bark audio in this browser.");
      }
    };
    await audio.play();
  };

  const playBrowserFallbackSpeech = (text: string, messageIndex: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceError("TTS unavailable: backend unreachable and browser speech synthesis not supported.");
      return;
    }
    stopAudioPlayback();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && v.name.toLowerCase().includes("female"))
      || voices.find((v) => /en[-_](US|GB)/i.test(v.lang))
      || voices[0];
    if (preferredVoice) utter.voice = preferredVoice;
    const cacheKey = `browser-${messageIndex}`;
    setVoiceCache((prev) => ({
      ...prev,
      [cacheKey]: { src: "browser-tts", model: "Web Speech API", voicePreset: utter.voice?.name || "default" },
    }));
    setPlayingMessageIndex(messageIndex);
    utter.onend = () => {
      if (playingMessageIndex === messageIndex) {
        setPlayingMessageIndex(null);
      }
    };
    utter.onerror = () => {
      setPlayingMessageIndex(null);
      setVoiceError("Browser speech synthesis playback failed.");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const synthesizeAndPlayMessage = async (messageText: string, messageIndex: number) => {
    const cached = voiceCache[messageIndex];
    if (cached) {
      if (cached.src === "browser-tts") {
        playBrowserFallbackSpeech(messageText, messageIndex);
        return;
      }
      await playAudioSource(cached.src, messageIndex);
      return;
    }

    if (!companyId || !employee) return;

    setVoiceError(null);
    setVoiceSynthLoadingIndex(messageIndex);
    try {
      const speech = await api.synthesizeEmployeeSpeech(companyId, employee.id, messageText, BARK_VOICE_PRESET);
      const src = `data:${speech.mimeType};base64,${speech.audioBase64}`;
      setVoiceCache((prev) => ({
        ...prev,
        [messageIndex]: {
          src,
          model: speech.model,
          voicePreset: speech.voicePreset,
        },
      }));
      await playAudioSource(src, messageIndex);
    } catch (err: any) {
      const msg = err?.message || String(err);
      const code = String(err?.code || "");
      const isNetError =
        /fetch failed|ENOTFOUND|TIMEOUT|TTS_ERROR|network|unreachable|DNS|blocked/i.test(msg) ||
        ["TTS_ERROR", "TIMEOUT_ERROR", "HTTP_502", "HTTP_503", "HTTP_504", "REQUEST_ERROR", "INTERNAL_ERROR"].includes(code) ||
        code.startsWith("HTTP_5");
      if (isNetError) {
        setVoiceSynthLoadingIndex(null);
        playBrowserFallbackSpeech(messageText, messageIndex);
        setVoiceError(`Using local browser voice (${(code ? code + ": " : "") + msg.slice(0, 60)})`);
        return;
      }
      setVoiceError((code ? code + ": " : "") + (msg || "Unable to synthesize voice reply."));
    } finally {
      setVoiceSynthLoadingIndex((current) => (current === messageIndex ? null : current));
    }
  };

  const handlePlayAiVoice = async (messageText: string, messageIndex: number) => {
    if (playingMessageIndex === messageIndex) {
      stopAudioPlayback();
      return;
    }

    await synthesizeAndPlayMessage(messageText, messageIndex);
  };

  const handleToggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    setVoiceError(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        void handleSendMessage(transcript);
      }
    };
    recognition.onerror = (event) => {
      setVoiceError(`Voice input error: ${event.error}`);
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  // Load conversations list for this employee
  const loadConversations = async (empId: string) => {
    if (!companyId) return;
    try {
      const res = await api.getConversations(companyId, empId);
      const list = res.conversations || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.warn("Error fetching conversations:", err);
      return [];
    }
  };

  // Select a specific conversation and load its messages
  const selectConversation = async (convId: string) => {
    if (!companyId || !employee) return;
    stopAudioPlayback();
    setVoiceCache({});
    setActiveConversationId(convId);
    setChatLoading(true);
    try {
      const res = await api.getConversationMessages(companyId, employee.id, convId);
      const msgs = res.messages || [];
      if (msgs.length > 0) {
        setChatMessages(
          msgs.map((m: any) => ({
            sender: m.sender,
            text: m.text,
            time: m.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            model: m.model,
            contextUsed: m.contextUsed,
            approvalRequired: m.approvalRequired,
            actionExecuted: m.actionExecuted,
          }))
        );
      }
    } catch (err) {
      console.warn("Error loading conversation messages:", err);
    } finally {
      setChatLoading(false);
    }
  };

  // Start a new conversation
  const handleNewConversation = async () => {
    if (!companyId || !employee) return;
    try {
      const res = await api.createConversation(companyId, employee.id, "New Chat");
      const newConv = res.conversation;
      stopAudioPlayback();
      setVoiceCache({});
      setActiveConversationId(newConv.id);
      setConversations((prev) => [newConv, ...prev]);
      setChatMessages([
        {
          sender: "ai",
          text: `Hello! I am ${employee.name}, your ${employee.role}. How can I assist you in this conversation?`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          model: employee.llmModel || "mistral-small-latest",
        },
      ]);
    } catch (err: any) {
      alert(`Failed to start new conversation: ${err?.message || "Error"}`);
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!companyId || !employee) return;
    if (!confirm("Are you sure you want to delete this conversation history?")) return;
    try {
      await api.deleteConversation(companyId, employee.id, convId);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);
      if (activeConversationId === convId) {
        if (updated.length > 0) {
          selectConversation(updated[0].id);
        } else {
          handleNewConversation();
        }
      }
    } catch (err: any) {
      alert(`Failed to delete conversation: ${err?.message || "Error"}`);
    }
  };

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [empRes, intRes] = await Promise.all([
          api.getEmployees(companyId),
          api.getIntegrations(companyId).catch(() => ({ connections: [] })),
        ]);
        const match = empRes.employees?.find((e) => e.id === employeeId) || empRes.employees?.[0];
        if (match) {
          setEmployee(match);

          // Build assignedProviders + granular permissions from existing employee.permissions
          const providerSet = new Set<string>();
          const permMap: Record<string, PermissionEntry> = {};

          if (match.permissions && match.permissions.length > 0) {
            match.permissions.forEach((p: EmployeePermission) => {
              const provider = p.toolName.includes(".") ? p.toolName.split(".")[0] : p.toolName;
              providerSet.add(provider);
              permMap[p.toolName] = {
                toolName: p.toolName,
                writeAccess: p.writeAccess ?? false,
                requiresApproval: p.requiresApproval ?? false,
              };
            });
          }

          setAssignedProviders(providerSet);
          setPermissions(permMap);

          // Load conversation history for this employee
          const convList = await loadConversations(match.id);
          if (convList && convList.length > 0) {
            await selectConversation(convList[0].id);
          } else {
            stopAudioPlayback();
            setVoiceCache({});
            setChatMessages([
              {
                sender: "ai",
                text: `Hello! I am ${match.name}, your ${match.role}. I am powered by Mistral AI (${match.llmModel || "mistral-small-latest"}). You can query me about your connected applications or assign tasks!`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                model: match.llmModel || "mistral-small-latest",
              },
            ]);
          }
        }
        setCompanyIntegrations(intRes.connections || []);
      } catch (err) {
        console.warn("Error fetching employee detail:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      recognitionRef.current?.stop();
      stopAudioPlayback();
    };
  }, [companyId, employeeId]);

  const handleTogglePause = async () => {
    if (!employee || !companyId) return;
    setActionLoading(true);
    try {
      if (employee.status === "PAUSED") {
        await api.resumeEmployee(companyId, employee.id);
        setEmployee({ ...employee, status: "ACTIVE" });
      } else {
        await api.pauseEmployee(companyId, employee.id);
        setEmployee({ ...employee, status: "PAUSED" });
      }
    } catch (err: any) {
      alert(`Action failed: ${err?.message || "Error updating employee"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim() || !employee || !companyId || chatLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const historyPayload = chatMessages.map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    setChatMessages((prev) => [...prev, { sender: "user", text: textToSend, time: timeStr }]);
    if (!customPrompt) setChatInput("");
    setChatLoading(true);

    try {
      const result = await api.chatWithEmployee(companyId, employee.id, textToSend, historyPayload, activeConversationId || undefined);
      const aiMessageIndex = chatMessages.length + 1;

      if (result.conversationId && result.conversationId !== activeConversationId) {
        setActiveConversationId(result.conversationId);
        loadConversations(employee.id);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: result.response,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          model: result.model || "mistral-small-latest",
          contextUsed: result.contextUsed || [],
          approvalRequired: result.approvalRequired
            ? { ...result.approvalRequired, status: "PENDING" }
            : undefined,
          actionExecuted: result.actionExecuted,
        },
      ]);

      if (autoPlayVoiceReplies) {
        void synthesizeAndPlayMessage(result.response, aiMessageIndex);
      }
    } catch (err: any) {
      const errorText = `⚠️ Query execution error: ${err?.message || "Failed to reach AI employee"}`;
      const aiMessageIndex = chatMessages.length + 1;
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: errorText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      if (autoPlayVoiceReplies) {
        void synthesizeAndPlayMessage(errorText, aiMessageIndex);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleApproveInChat = async (msgIndex: number, approvalId: string) => {
    if (!companyId) return;
    try {
      await api.approveAction(companyId, approvalId);
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex && msg.approvalRequired
            ? {
              ...msg,
              text: msg.text + "\n\n✅ **Action Authorized**: Approval request granted by founder!",
              approvalRequired: { ...msg.approvalRequired, status: "APPROVED" },
            }
            : msg
        )
      );
    } catch (err: any) {
      alert(`Approval error: ${err?.message || "Failed to approve action"}`);
    }
  };

  const handleRejectInChat = async (msgIndex: number, approvalId: string) => {
    if (!companyId) return;
    try {
      await api.rejectAction(companyId, approvalId, "Rejected by founder via chat interface");
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex && msg.approvalRequired
            ? {
              ...msg,
              text: msg.text + "\n\n❌ **Action Rejected**: Action cancelled by founder.",
              approvalRequired: { ...msg.approvalRequired, status: "REJECTED" },
            }
            : msg
        )
      );
    } catch (err: any) {
      alert(`Rejection error: ${err?.message || "Failed to reject action"}`);
    }
  };

  // ── Save: Connected Applications (provider-level assign/unassign) ─────────
  const handleSaveConnectedApps = async () => {
    if (!employee || !companyId) return;
    setSavingPermissions(true);
    setSaveSuccess(false);

    // Build permissions array from assignedProviders + existing per-action permissions
    const perms: EmployeePermission[] = [];
    assignedProviders.forEach((provider) => {
      const providerActions = PROVIDER_CATALOG.find((p) => p.id === provider)?.actions || [];
      if (providerActions.length === 0) {
        // Provider with no known actions — add provider-level wildcard
        perms.push({ toolName: provider, requiresApproval: false, writeAccess: true });
        return;
      }
      providerActions.forEach((action) => {
        const existing = permissions[action.id];
        perms.push({
          toolName: action.id,
          writeAccess: existing?.writeAccess ?? !action.write ? false : true,
          requiresApproval: existing?.requiresApproval ?? action.defaultApproval,
        });
      });
    });

    try {
      await api.updateEmployeePermissions(companyId, employee.id, perms);
      setEmployee({ ...employee, permissions: perms });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save: ${err?.message || "Error"}`);
    } finally {
      setSavingPermissions(false);
    }
  };

  // ── Save: Permissions & Rules (granular per-action) ────────────────────────
  const handleSavePermissions = async () => {
    if (!employee || !companyId) return;
    setSavingPermissions(true);
    setPermSaveSuccess(false);

    const perms: EmployeePermission[] = Object.values(permissions);
    try {
      await api.updateEmployeePermissions(companyId, employee.id, perms);
      setEmployee({ ...employee, permissions: perms });
      setPermSaveSuccess(true);
      setTimeout(() => setPermSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save permissions: ${err?.message || "Error"}`);
    } finally {
      setSavingPermissions(false);
    }
  };

  // ── Toggle a provider on/off (Connected Apps tab) ─────────────────────────
  const handleToggleProvider = (provider: ProviderDef, connected: boolean) => {
    setAssignedProviders((prev) => {
      const next = new Set(prev);
      if (connected) {
        next.add(provider.id);
        // Auto-populate default permissions for all actions
        setPermissions((p) => {
          const next = { ...p };
          provider.actions.forEach((a) => {
            if (!next[a.id]) {
              next[a.id] = { toolName: a.id, writeAccess: a.write, requiresApproval: a.defaultApproval };
            }
          });
          return next;
        });
      } else {
        next.delete(provider.id);
        // Remove permissions for this provider
        setPermissions((p) => {
          const next = { ...p };
          provider.actions.forEach((a) => delete next[a.id]);
          return next;
        });
      }
      return next;
    });
  };

  // ── Set read/write access for a provider (Connected Apps tab) ─────────────
  const handleProviderAccessMode = (provider: ProviderDef, writeAccess: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      provider.actions.forEach((a) => {
        if (next[a.id]) {
          next[a.id] = {
            ...next[a.id],
            writeAccess: writeAccess ? a.write : false,
          };
        } else {
          next[a.id] = { toolName: a.id, writeAccess: writeAccess ? a.write : false, requiresApproval: a.defaultApproval };
        }
      });
      return next;
    });
  };

  // ── Load activity logs ────────────────────────────────────────────────────
  const loadActivityLogs = useCallback(async () => {
    if (!companyId || !employee) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`${API_BASE}/companies/${companyId}/activity?employeeId=${employee.id}&limit=50`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setActivityLogs(data.data?.activities || []);
    } catch {/* silent */ } finally {
      setActivityLoading(false);
    }
  }, [companyId, employee]);

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto text-center font-mono text-xs text-slate-400 bg-white border border-slate-200">
        Loading AI employee profile...
      </div>
    );
  }

  const isPaused = employee?.status === "PAUSED";
  const connectedProviders = companyIntegrations.filter((c) => c.status === "CONNECTED").map((c) => c.provider);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4">
        <div>
          <Link href="/employees" className="text-xs font-mono text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2">
            ← Back to AI Employees
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 text-white font-mono font-bold text-lg flex items-center justify-center shrink-0">
              {(employee?.name || "AI")[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee?.name || "AI Employee"}</h1>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${isPaused ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                  ● {employee?.status || "ACTIVE"}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 border bg-purple-50 text-purple-700 border-purple-200">
                  ⚡ MISTRAL AI
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                Role: {employee?.role || "Agent"} • Workspace: {activeCompany?.slug || "acme"} • Model: {employee?.llmModel || "mistral-small-latest"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePause}
            disabled={actionLoading}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-mono font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {actionLoading ? "..." : isPaused ? "Resume Employee" : "Pause Employee"}
          </button>
          <Link
            href={`/tasks/new?employeeId=${employee?.id}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            + Assign Task
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer border whitespace-nowrap ${activeTab === tab
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>System Execution Profile</span>
                <span className="text-xs text-blue-600 font-mono">LIVE API</span>
              </h3>

              <div className="space-y-2 font-mono text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                  <span>✓ Mistral AI engine loaded ({employee?.llmModel || "mistral-small-latest"})</span>
                  <span className="text-[10px] text-purple-600 font-bold">MISTRAL AI</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                  <span>✓ Connected Applications Grounding Engine</span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    {connectedProviders.length > 0 ? `${connectedProviders.length} CONNECTED` : "READY"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                  <span>✓ E2B MicroVM execution environment active</span>
                  <span className="text-[10px] text-slate-400">READY</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                System Instructions & Directives
              </h3>
              <div className="p-4 bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {employee?.systemInstructions || "No explicit system instructions provided."}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider font-mono">
                Runtime Governance
              </h3>

              <div className="flex justify-between py-2 border-b border-slate-100 font-mono">
                <span className="text-slate-500">LLM Engine</span>
                <span className="text-purple-700 font-bold">Mistral AI</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 font-mono">
                <span className="text-slate-500">Model Name</span>
                <span className="text-slate-900 font-bold">{employee?.llmModel || "mistral-small-latest"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 font-mono">
                <span className="text-slate-500">Monthly Spend Limit</span>
                <span className="text-slate-900 font-bold">${employee?.maxMonthlySpend || 500}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 font-mono">
                <span className="text-slate-500">Current Spend</span>
                <span className="text-blue-600 font-bold">${employee?.currentSpend || 0}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                Personality Matrix
              </h3>
              <p className="text-xs text-slate-600 font-mono bg-slate-50 p-3 border border-slate-200">
                {employee?.personality || "Analytical, precise, security-focused."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Chat & Queries */}
      {activeTab === "Chat & Queries" && (
        <div className="bg-white border border-slate-200 grid grid-cols-1 lg:grid-cols-5 min-h-[600px]">
          {/* Left Sidebar: Conversation History & Threads */}
          <div className="lg:col-span-1 border-r border-slate-200 bg-slate-50 flex flex-col justify-between p-4 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                  Conversations
                </h4>
                <button
                  onClick={handleNewConversation}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  + New
                </button>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[460px]">
                {conversations.length === 0 ? (
                  <div className="p-3 bg-white border border-slate-200 font-mono text-[11px] text-slate-400 text-center">
                    No past chat threads yet.
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`p-2.5 border text-xs font-mono transition-colors cursor-pointer flex items-center justify-between group ${activeConversationId === conv.id
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                      <div className="truncate flex-1 mr-2">
                        <span className="truncate block font-semibold">{conv.title || "Chat"}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className={`text-[11px] px-1 font-bold hover:text-red-500 opacity-60 group-hover:opacity-100 ${activeConversationId === conv.id ? "text-slate-300" : "text-slate-400"
                          }`}
                        title="Delete conversation"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-[10px] font-mono text-slate-400 block text-center">
                {conversations.length} total thread{conversations.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Chat main window */}
          <div className="lg:col-span-3 flex flex-col border-r border-slate-200">
            {/* Header / Active integration indicators */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-slate-900">
                  Interactive Query Console — {employee?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 font-semibold">
                  MISTRAL AI
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                  BARK VOICE
                </span>
                {connectedProviders.map((p) => (
                  <span key={p} className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-semibold uppercase">
                    ✓ {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[500px] font-mono text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-400">
                      {msg.sender === "user" ? "You" : `${employee?.name} (Mistral AI)`} • {msg.time}
                    </span>
                    {msg.sender === "ai" && (
                      <button
                        onClick={() => handlePlayAiVoice(msg.text, idx)}
                        disabled={voiceSynthLoadingIndex === idx}
                        className="text-[9px] bg-white text-slate-600 px-1.5 py-0.5 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {voiceSynthLoadingIndex === idx
                          ? "Generating voice..."
                          : playingMessageIndex === idx
                            ? "Stop voice"
                            : "Play voice"}
                      </button>
                    )}
                    {msg.contextUsed && msg.contextUsed.length > 0 && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 border border-slate-200">
                        Context: {msg.contextUsed.join(", ")}
                      </span>
                    )}
                  </div>
                  <div
                    className={`p-4 max-w-[85%] rounded-none leading-relaxed ${msg.sender === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-800 border border-slate-200"
                      }`}
                  >
                    <FormattedText text={msg.text} isUser={msg.sender === "user"} />

                    {/* Inline Interactive Approval Request Modal UI */}
                    {msg.approvalRequired && (
                      <div className="mt-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-none space-y-3 font-sans text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <div className="flex items-center gap-2 text-amber-900 font-bold font-mono">
                            <span className="text-base">🛡️</span>
                            <span>Security Authorization Required</span>
                          </div>
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold text-[10px] uppercase">
                            HIGH RISK ACTION
                          </span>
                        </div>

                        <p className="text-amber-900 font-mono text-[11px] leading-relaxed">
                          {msg.approvalRequired.riskReason}
                        </p>

                        <div className="p-3 bg-white border border-amber-200 font-mono text-[11px] space-y-1.5 text-slate-800">
                          <div>
                            <span className="text-slate-500">Tool Action: </span>
                            <code className="bg-purple-100 text-purple-900 px-1.5 py-0.5 font-bold">{msg.approvalRequired.toolName}</code>
                          </div>
                          {msg.approvalRequired.args?.to && (
                            <div>
                              <span className="text-slate-500">Recipient: </span>
                              <strong className="text-slate-900">{msg.approvalRequired.args.to}</strong>
                            </div>
                          )}
                          {msg.approvalRequired.args?.subject && (
                            <div>
                              <span className="text-slate-500">Subject: </span>
                              <span className="text-slate-900">{msg.approvalRequired.args.subject}</span>
                            </div>
                          )}
                        </div>

                        {msg.approvalRequired.status === "APPROVED" ? (
                          <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono font-bold text-xs flex items-center gap-2">
                            <span>✓ Action Approved & Executed (Email Sent via Gmail)</span>
                          </div>
                        ) : msg.approvalRequired.status === "REJECTED" ? (
                          <div className="p-2.5 bg-red-100 border border-red-300 text-red-900 font-mono font-bold text-xs flex items-center gap-2">
                            <span>✗ Action Rejected by Founder</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleApproveInChat(idx, msg.approvalRequired!.approvalId)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs transition-colors cursor-pointer"
                            >
                              ✓ Approve & Execute Action
                            </button>
                            <button
                              onClick={() => handleRejectInChat(idx, msg.approvalRequired!.approvalId)}
                              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-mono font-bold text-xs transition-colors cursor-pointer"
                            >
                              ✗ Reject Action
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono p-2">
                  <span className="animate-spin">⏳</span>
                  <span>{employee?.name} is querying connected applications with Mistral AI...</span>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 border border-amber-200 bg-amber-50 text-amber-800">
                Bark preset: {BARK_VOICE_PRESET}
              </span>
              <button
                onClick={() => setAutoPlayVoiceReplies((prev) => !prev)}
                className={`px-2.5 py-1 border transition-colors cursor-pointer ${autoPlayVoiceReplies
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
              >
                {autoPlayVoiceReplies ? "Auto-play replies: On" : "Auto-play replies: Off"}
              </button>
              <span className={`px-2 py-1 border ${voiceInputSupported ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                Mic input: {voiceInputSupported ? "Ready" : "Unsupported"}
              </span>
              {voiceError && (
                <span className="px-2 py-1 border border-red-200 bg-red-50 text-red-700">
                  {voiceError}
                </span>
              )}
            </div>

            {/* Quick Prompts Suggestions */}
            <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-2">
              <span className="text-[10px] font-mono text-slate-400 self-center">Quick queries:</span>
              <button
                onClick={() => handleSendMessage("Check our connected Gmail account for unread emails or support messages")}
                className="px-2.5 py-1 text-[11px] font-mono bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                📧 Check Gmail emails
              </button>
              <button
                onClick={() => handleSendMessage("Summarize recent repository status and open GitHub issues")}
                className="px-2.5 py-1 text-[11px] font-mono bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                🐙 Check GitHub status
              </button>
              <button
                onClick={() => handleSendMessage("What connected applications are currently assigned to you?")}
                className="px-2.5 py-1 text-[11px] font-mono bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                ⚡ List active permissions
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-slate-200 flex items-center gap-2">
              <button
                onClick={handleToggleVoiceInput}
                disabled={!voiceInputSupported || chatLoading}
                className={`px-4 py-2.5 border text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-40 ${isListening
                    ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                {isListening ? "Listening..." : "Mic"}
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder={`Ask ${employee?.name} anything grounded in your connected apps...`}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-40"
              >
                {chatLoading ? "Querying..." : "Send →"}
              </button>
            </div>
          </div>

          {/* Right Sidebar: Context & Assigned Tools Info */}
          <div className="lg:col-span-1 p-6 bg-slate-50 space-y-6 border-l border-slate-200">
            <div>
              <h4 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider mb-2">
                Assigned Apps Context
              </h4>
              <p className="text-[11px] font-mono text-slate-500 mb-4">
                Queries are processed with <strong>Mistral AI</strong> and grounded in live data from assigned integrations.
              </p>

              <div className="space-y-3">
                {companyIntegrations.length === 0 ? (
                  <div className="p-3 bg-white border border-slate-200 font-mono text-xs text-slate-500 text-center">
                    No connected apps found.
                    <br />
                    <Link href="/integrations" className="text-blue-600 underline font-bold mt-1 inline-block">
                      Connect Integrations →
                    </Link>
                  </div>
                ) : (
                  companyIntegrations.map((app) => (
                    <div key={app.id} className="p-3 bg-white border border-slate-200 font-mono text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 capitalize">{app.provider}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          {app.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{app.accountEmail || app.accountName}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 space-y-2">
              <h5 className="text-xs font-mono font-bold text-slate-900">LLM Provider Specs</h5>
              <div className="text-[11px] font-mono text-slate-600 space-y-1">
                <div>Provider: <span className="font-bold text-purple-700">Mistral AI</span></div>
                <div>Model: <span className="font-bold">{employee?.llmModel || "mistral-small-latest"}</span></div>
                <div>Grounding: <span className="text-emerald-700 font-bold">Enabled</span></div>
                <div>Voice: <span className="font-bold text-amber-700">Bark ({BARK_VOICE_PRESET})</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Connected Applications */}
      {activeTab === "Connected Applications" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Connected Applications</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Assign which workspace integrations <strong>{employee?.name}</strong> can access.
                Toggle read-only or full access per app. Granular action permissions are in the <em>Permissions & Rules</em> tab.
              </p>
            </div>
            <button
              onClick={handleSaveConnectedApps}
              disabled={savingPermissions}
              className="shrink-0 px-4 py-2 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {savingPermissions ? "Saving…" : saveSuccess ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>

          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium px-4 py-2">
              ✓ Connected applications saved for {employee?.name}.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {PROVIDER_CATALOG.map((provider) => {
              const isWorkspaceConnected = companyIntegrations.some(
                (c) => c.provider === provider.id && c.status === "CONNECTED"
              );
              const isAssigned = assignedProviders.has(provider.id);
              const connAcc = companyIntegrations.find((c) => c.provider === provider.id);

              // Determine current access mode for this provider
              const providerPerms = provider.actions.map((a) => permissions[a.id]).filter(Boolean);
              const hasWrite = providerPerms.some((p) => p?.writeAccess);

              return (
                <div
                  key={provider.id}
                  className={`bg-white border transition-all ${isAssigned ? "border-slate-900 shadow-sm" : "border-slate-200"
                    }`}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0">
                      <img
                        src={provider.iconUrl}
                        alt={provider.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-bold text-slate-900">{provider.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{provider.category}</span>
                        {isWorkspaceConnected ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CONNECTED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200">
                            NOT IN WORKSPACE
                          </span>
                        )}
                      </div>
                      {connAcc && (
                        <p className="text-[11px] text-slate-500 font-mono mb-1">{connAcc.accountEmail || connAcc.accountName}</p>
                      )}
                      <p className="text-[11px] text-slate-500">{provider.actions.length} actions available</p>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => isWorkspaceConnected && handleToggleProvider(provider, !isAssigned)}
                      disabled={!isWorkspaceConnected}
                      className={`shrink-0 w-11 h-6 rounded-full border-2 transition-all duration-150 relative ${isAssigned && isWorkspaceConnected
                          ? "bg-slate-900 border-slate-900"
                          : "bg-slate-100 border-slate-300"
                        } disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
                      title={!isWorkspaceConnected ? "Connect this integration in workspace settings first" : ""}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${isAssigned && isWorkspaceConnected ? "translate-x-5" : "translate-x-0.5"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Access mode when assigned */}
                  {isAssigned && isWorkspaceConnected && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-medium">Access mode:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleProviderAccessMode(provider, false)}
                          className={`px-2.5 py-1 text-[11px] font-semibold border transition-colors ${!hasWrite
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                          Read-only
                        </button>
                        <button
                          onClick={() => handleProviderAccessMode(provider, true)}
                          className={`px-2.5 py-1 text-[11px] font-semibold border transition-colors ${hasWrite
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                          Full access
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">
                        {providerPerms.filter((p) => p).length} actions enabled
                      </span>
                    </div>
                  )}

                  {!isWorkspaceConnected && (
                    <div className="px-4 pb-3 pt-1">
                      <Link
                        href="/integrations"
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Connect {provider.name} in workspace →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Permissions & Rules */}
      {activeTab === "Permissions & Rules" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Permissions & Rules</h3>
              <p className="text-[12px] text-slate-500 mt-1">
                Configure exactly what <strong>{employee?.name}</strong> can do — per action, with write access and approval requirements.
                Only assigned integrations are shown.
              </p>
            </div>
            <button
              onClick={handleSavePermissions}
              disabled={savingPermissions}
              className="shrink-0 px-4 py-2 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {savingPermissions ? "Saving…" : permSaveSuccess ? "✓ Saved!" : "Save Rules"}
            </button>
          </div>

          {permSaveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium px-4 py-2">
              ✓ Permission rules saved for {employee?.name}.
            </div>
          )}

          {assignedProviders.size === 0 ? (
            <div className="bg-white border border-slate-200 p-10 text-center">
              <div className="text-slate-400 text-[13px] mb-2">No integrations assigned yet.</div>
              <button
                onClick={() => setActiveTab("Connected Applications")}
                className="text-[12px] text-blue-600 hover:text-blue-800 font-medium"
              >
                Go to Connected Applications →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Risk legend */}
              <div className="bg-white border border-slate-200 p-3 flex items-center gap-4 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Risk levels:</span>
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((r) => (
                  <span key={r} className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${riskColor(r)}`}>{r}</span>
                ))}
                <span className="text-[10px] text-slate-400 ml-auto">
                  Actions requiring approval are blocked until a human approves them.
                </span>
              </div>

              {PROVIDER_CATALOG.filter((p) => assignedProviders.has(p.id)).map((provider) => (
                <div key={provider.id} className="bg-white border border-slate-200">
                  {/* Provider header */}
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <img
                      src={provider.iconUrl}
                      alt={provider.name}
                      className="w-5 h-5 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-[13px] font-bold text-slate-900">{provider.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{provider.category}</span>
                    <span className="text-[10px] font-mono ml-auto text-slate-400">
                      {provider.actions.filter((a) => permissions[a.id]).length}/{provider.actions.length} actions enabled
                    </span>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-5 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    <span>Action</span>
                    <span className="w-20 text-center">Enabled</span>
                    <span className="w-24 text-center">Write access</span>
                    <span className="w-28 text-center">Req. approval</span>
                  </div>

                  {/* Action rows */}
                  {provider.actions.map((action) => {
                    const perm = permissions[action.id];
                    const isEnabled = !!perm;

                    const toggle = (field: "enabled" | "writeAccess" | "requiresApproval") => {
                      setPermissions((prev) => {
                        const next = { ...prev };
                        if (field === "enabled") {
                          if (isEnabled) {
                            delete next[action.id];
                          } else {
                            next[action.id] = {
                              toolName: action.id,
                              writeAccess: action.write,
                              requiresApproval: action.defaultApproval,
                            };
                          }
                        } else if (field === "writeAccess" && isEnabled) {
                          next[action.id] = { ...next[action.id], writeAccess: !next[action.id].writeAccess };
                        } else if (field === "requiresApproval" && isEnabled) {
                          next[action.id] = { ...next[action.id], requiresApproval: !next[action.id].requiresApproval };
                        }
                        return next;
                      });
                    };

                    return (
                      <div
                        key={action.id}
                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 px-5 py-3 border-b border-slate-50 last:border-0 items-center transition-colors ${isEnabled ? "" : "opacity-40"
                          }`}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${riskDot(action.riskLevel)}`} />
                            <span className="text-[12px] font-semibold text-slate-800">{action.label}</span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${riskColor(action.riskLevel)}`}>
                              {action.riskLevel}
                            </span>
                            {action.write && (
                              <span className="text-[9px] font-mono text-slate-400 border border-slate-200 px-1">WRITE</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 ml-4">{action.description}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 ml-4">{action.id}</p>
                        </div>

                        {/* Enabled toggle */}
                        <div className="w-20 flex justify-center">
                          <button
                            onClick={() => toggle("enabled")}
                            className={`w-10 h-5 rounded-full border-2 relative transition-all cursor-pointer ${isEnabled ? "bg-slate-900 border-slate-900" : "bg-slate-100 border-slate-300"
                              }`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isEnabled ? "translate-x-4" : "translate-x-0.5"
                              }`} />
                          </button>
                        </div>

                        {/* Write access */}
                        <div className="w-24 flex justify-center">
                          {action.write ? (
                            <button
                              onClick={() => isEnabled && toggle("writeAccess")}
                              disabled={!isEnabled}
                              className={`w-10 h-5 rounded-full border-2 relative transition-all cursor-pointer disabled:cursor-default ${isEnabled && perm?.writeAccess
                                  ? "bg-blue-600 border-blue-600"
                                  : "bg-slate-100 border-slate-300"
                                }`}
                            >
                              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isEnabled && perm?.writeAccess ? "translate-x-4" : "translate-x-0.5"
                                }`} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-mono">read-only</span>
                          )}
                        </div>

                        {/* Requires approval */}
                        <div className="w-28 flex justify-center">
                          <button
                            onClick={() => isEnabled && toggle("requiresApproval")}
                            disabled={!isEnabled}
                            className={`w-10 h-5 rounded-full border-2 relative transition-all cursor-pointer disabled:cursor-default ${isEnabled && perm?.requiresApproval
                                ? "bg-amber-500 border-amber-500"
                                : "bg-slate-100 border-slate-300"
                              }`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isEnabled && perm?.requiresApproval ? "translate-x-4" : "translate-x-0.5"
                              }`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Guardrails summary */}
              <div className="bg-white border border-slate-200 p-5">
                <h4 className="text-[12px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Permission Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {[
                    { label: "Total actions", value: Object.keys(permissions).length, color: "text-slate-700" },
                    { label: "Write-enabled", value: Object.values(permissions).filter((p) => p.writeAccess).length, color: "text-blue-600" },
                    { label: "Require approval", value: Object.values(permissions).filter((p) => p.requiresApproval).length, color: "text-amber-600" },
                    {
                      label: "CRITICAL risk", value: Object.keys(permissions).filter((id) => {
                        const a = PROVIDER_CATALOG.flatMap((p) => p.actions).find((a) => a.id === id);
                        return a?.riskLevel === "CRITICAL";
                      }).length, color: "text-red-600"
                    },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 border border-slate-200 p-3">
                      <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Hard system rules always apply: financial actions require financial authority, production deployments always require approval, and Clones cannot modify their own authority.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity Logs */}
      {activeTab === "Activity Logs" && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Activity Logs</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">All recorded actions for {employee?.name}.</p>
            </div>
            <button
              onClick={loadActivityLogs}
              disabled={activityLoading}
              className="px-3 py-1.5 text-[12px] border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              {activityLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          <div className="bg-white border border-slate-200 divide-y divide-slate-100">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse">
                  <div className="h-3 bg-slate-100 w-1/3 mb-2" />
                  <div className="h-2.5 bg-slate-50 w-2/3" />
                </div>
              ))
            ) : activityLogs.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-slate-400">
                No activity yet.{" "}
                <button onClick={loadActivityLogs} className="text-blue-600 underline">Load logs</button>
              </div>
            ) : (
              activityLogs.map((log: any) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                  <div className="w-8 h-8 bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-800">{log.action?.replace(/_/g, " ")}</span>
                      {log.resource && (
                        <span className="text-[11px] font-mono text-slate-500 truncate max-w-[240px]">{log.resource}</span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{log.details}</p>
                    )}
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

      {/* Tab: Employee Profile */}
      {activeTab === "Employee Profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 p-6">
              <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono mb-4">System Instructions</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 font-mono text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                {employee?.systemInstructions || "No system instructions provided."}
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-6">
              <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono mb-4">Personality</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 font-mono text-[12px] text-slate-700 leading-relaxed">
                {employee?.personality || "Not set."}
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-6">
              <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono mb-4">Short Description</h3>
              <p className="text-[12px] text-slate-600">{employee?.shortDescription || "Not set."}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-5">
              <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wider font-mono mb-4">Runtime Config</h3>
              <div className="space-y-2 text-[12px] font-mono divide-y divide-slate-100">
                {[
                  ["LLM Engine", "Mistral AI"],
                  ["Model", employee?.llmModel || "mistral-small-latest"],
                  ["Status", employee?.status || "ACTIVE"],
                  ["Monthly spend limit", `$${employee?.maxMonthlySpend || 500}`],
                  ["Current spend", `$${employee?.currentSpend || 0}`],
                  ["Assigned integrations", `${assignedProviders.size}`],
                  ["Total permissions", `${Object.keys(permissions).length}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5">
              <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-wider font-mono mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab("Connected Applications")}
                  className="w-full text-left px-3 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] text-slate-700 font-medium transition-colors"
                >
                  ⚡ Manage connected apps
                </button>
                <button
                  onClick={() => setActiveTab("Permissions & Rules")}
                  className="w-full text-left px-3 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] text-slate-700 font-medium transition-colors"
                >
                  🛡 Edit permissions & rules
                </button>
                <Link
                  href={`/runtime/${employee?.id}`}
                  className="block w-full text-left px-3 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] text-slate-700 font-medium transition-colors"
                >
                  📊 View runtime dashboard
                </Link>
                <Link
                  href={`/tasks/new?employeeId=${employee?.id}`}
                  className="block w-full text-left px-3 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] text-slate-700 font-medium transition-colors"
                >
                  + Assign new task
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
