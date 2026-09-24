"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow, Controls, Background, useNodesState, useEdgesState, addEdge,
  Handle, Position, Node, Edge, BackgroundVariant, Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAuth } from "@/lib/auth-context";
import { api, Workflow, WorkflowStep, AIEmployee } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual", EMAIL: "Email", GITHUB_ISSUE: "GitHub Issue",
  LINEAR_ISSUE: "Linear Issue", SLACK_MESSAGE: "Slack Message",
  SCHEDULE: "Schedule", WEBHOOK: "Webhook",
};

const ACTION_ICONS: Record<string, string> = {
  FETCH_CONTEXT: "🔍", PLAN: "🧠", EXECUTE_TOOL: "⚙️",
  HUMAN_APPROVAL: "🛡️", NOTIFY_SLACK: "💬", SEND_EMAIL: "✉️",
};

const ACTION_COLORS: Record<string, { node: string; badge: string }> = {
  FETCH_CONTEXT: { node: "border-blue-200",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  PLAN:          { node: "border-violet-200",  badge: "bg-violet-50 text-violet-700 border-violet-200" },
  EXECUTE_TOOL:  { node: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  HUMAN_APPROVAL:{ node: "border-amber-300",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  NOTIFY_SLACK:  { node: "border-indigo-200",  badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  SEND_EMAIL:    { node: "border-rose-200",    badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const STEP_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  FAILED:    "text-red-700 bg-red-50 border-red-200",
  RUNNING:   "text-blue-700 bg-blue-50 border-blue-200",
  PENDING:   "text-slate-500 bg-slate-50 border-slate-200",
  WAITING_FOR_APPROVAL: "text-amber-700 bg-amber-50 border-amber-200",
};

function relTime(ts?: string) {
  if (!ts) return "never";
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── React Flow custom nodes ──────────────────────────────────────────────────

function TriggerNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div className={`bg-white border-2 p-3 min-w-[160px] shadow-sm ${selected ? "border-blue-500 ring-2 ring-blue-100" : "border-blue-300"}`}>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">TRIGGER</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <div>
          <p className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "Trigger"}</p>
          <p className="text-[10px] text-slate-500 font-mono">{data.subtitle || ""}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
}

function StepNode({ data, selected }: { data: any; selected?: boolean }) {
  const colors = ACTION_COLORS[data.actionType] || ACTION_COLORS.PLAN;
  const statusCls = data.runStatus ? STEP_STATUS_COLORS[data.runStatus] || STEP_STATUS_COLORS.PENDING : null;
  return (
    <div className={`bg-white border-2 p-3 min-w-[170px] shadow-sm transition-all ${selected ? "border-indigo-500 ring-2 ring-indigo-100" : colors.node}`}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-white" />
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${colors.badge}`}>
          {ACTION_ICONS[data.actionType]} {data.actionType?.replace(/_/g, " ")}
        </span>
        {statusCls && (
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${statusCls}`}>{data.runStatus}</span>
        )}
      </div>
      <p className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "Step"}</p>
      {data.employeeName && <p className="text-[10px] text-slate-500 font-mono mt-0.5">👤 {data.employeeName}</p>}
      {data.output && (
        <p className="text-[10px] text-slate-600 mt-1 leading-relaxed line-clamp-2 border-t border-slate-100 pt-1">{data.output}</p>
      )}
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-white" />
    </div>
  );
}

function ApprovalNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div className={`bg-white border-2 p-3 min-w-[160px] shadow-sm ${selected ? "border-amber-500 ring-2 ring-amber-100" : "border-amber-300"}`}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white" />
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">🛡️ APPROVAL</span>
      </div>
      <p className="text-[12px] font-bold text-slate-900">{data.label || "Human Gate"}</p>
      <p className="text-[10px] text-amber-700 font-mono mt-0.5">Awaiting authorization</p>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white" />
    </div>
  );
}

// ─── Build canvas nodes+edges from workflow steps ─────────────────────────────

function stepsToCanvas(
  workflow: Workflow,
  employees: AIEmployee[],
  runResults?: Array<{ step: number; actionType: string; status: string; output: string }>
): { nodes: Node[]; edges: Edge[] } {
  const saved = workflow.canvasJson as any;
  if (saved?.nodes?.length) {
    // Merge run results into saved canvas
    const nodes: Node[] = (saved.nodes as Node[]).map((n) => {
      if (!runResults || n.type === "trigger") return n;
      const res = runResults.find((r) => r.step === (n.data as any).stepOrder);
      if (!res) return n;
      return { ...n, data: { ...n.data, runStatus: res.status, output: res.output } };
    });
    return { nodes, edges: saved.edges || [] };
  }

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const steps = workflow.steps || [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Trigger node
  nodes.push({
    id: "trigger",
    type: "trigger",
    position: { x: 40, y: 180 },
    data: { label: TRIGGER_LABELS[workflow.triggerType] || workflow.triggerType, subtitle: workflow.triggerType.toLowerCase() },
  });

  steps.forEach((step, i) => {
    const x = 280 + i * 240;
    const y = 180;
    const emp = step.employeeId ? empMap.get(step.employeeId) : undefined;
    const res = runResults?.find((r) => r.step === step.stepOrder);
    const nodeType = step.actionType === "HUMAN_APPROVAL" ? "approval" : "step";
    nodes.push({
      id: `step-${step.stepOrder}`,
      type: nodeType,
      position: { x, y },
      data: {
        label: `Step ${step.stepOrder}: ${step.actionType.replace(/_/g, " ")}`,
        actionType: step.actionType,
        stepOrder: step.stepOrder,
        employeeName: emp?.name,
        runStatus: res?.status,
        output: res?.output,
      },
    });
    const from = i === 0 ? "trigger" : `step-${steps[i - 1].stepOrder}`;
    edges.push({
      id: `e-${from}-step-${step.stepOrder}`,
      source: from,
      target: `step-${step.stepOrder}`,
      animated: !!res && res.status === "RUNNING",
      style: { stroke: res?.status === "COMPLETED" ? "#059669" : res?.status === "FAILED" ? "#ef4444" : "#6366f1", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}

// ─── Create workflow modal ────────────────────────────────────────────────────

const ACTION_TYPES: WorkflowStep["actionType"][] = [
  "FETCH_CONTEXT", "PLAN", "EXECUTE_TOOL", "HUMAN_APPROVAL", "NOTIFY_SLACK", "SEND_EMAIL",
];
const TRIGGER_TYPES: Workflow["triggerType"][] = [
  "MANUAL", "EMAIL", "GITHUB_ISSUE", "LINEAR_ISSUE", "SLACK_MESSAGE", "SCHEDULE", "WEBHOOK",
];

function CreateWorkflowModal({
  companyId, employees, onClose, onCreated,
}: {
  companyId: string; employees: AIEmployee[];
  onClose: () => void; onCreated: (wf: Workflow) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<Workflow["triggerType"]>("MANUAL");
  const [steps, setSteps] = useState<Array<{
    actionType: WorkflowStep["actionType"]; employeeId: string; configJson: string;
  }>>([{ actionType: "PLAN", employeeId: "", configJson: "{}" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addStep = () => setSteps((s) => [...s, { actionType: "EXECUTE_TOOL", employeeId: "", configJson: "{}" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  async function submit() {
    if (!name.trim()) { setError("Name is required"); return; }
    for (const s of steps) {
      try { JSON.parse(s.configJson); } catch { setError("Config JSON must be valid JSON"); return; }
    }
    setSaving(true); setError("");
    try {
      const res = await api.createWorkflow(companyId, {
        name, description, triggerType,
        steps: steps.map((s, i) => ({
          stepOrder: i + 1,
          actionType: s.actionType,
          employeeId: s.employeeId || undefined,
          configJson: JSON.parse(s.configJson),
        })),
      });
      onCreated(res.workflow);
      onClose();
    } catch (e: any) { setError(e?.message || "Failed to create"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Build New Workflow</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Define trigger, steps, and assigned clone for each step.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name + Trigger */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Workflow Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400"
                placeholder="e.g. Review incoming PRs" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Trigger</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as any)}
                className="w-full border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 cursor-pointer">
                {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400"
              placeholder="What does this workflow do?" />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Steps</label>
              <button onClick={addStep} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer">+ Add step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-500">STEP {i + 1}</span>
                    {steps.length > 1 && (
                      <button onClick={() => removeStep(i)} className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Action Type</label>
                      <select value={step.actionType}
                        onChange={(e) => setSteps((s) => s.map((ss, idx) => idx === i ? { ...ss, actionType: e.target.value as any } : ss))}
                        className="w-full border border-slate-200 px-2 py-1.5 text-[12px] focus:outline-none cursor-pointer bg-white">
                        {ACTION_TYPES.map((t) => <option key={t} value={t}>{ACTION_ICONS[t]} {t.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Assigned Clone (optional)</label>
                      <select value={step.employeeId}
                        onChange={(e) => setSteps((s) => s.map((ss, idx) => idx === i ? { ...ss, employeeId: e.target.value } : ss))}
                        className="w-full border border-slate-200 px-2 py-1.5 text-[12px] focus:outline-none cursor-pointer bg-white">
                        <option value="">Any available clone</option>
                        {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Config JSON</label>
                    <textarea value={step.configJson} rows={2}
                      onChange={(e) => setSteps((s) => s.map((ss, idx) => idx === i ? { ...ss, configJson: e.target.value } : ss))}
                      className="w-full border border-slate-200 px-2 py-1.5 text-[11px] font-mono focus:outline-none resize-none bg-white"
                      placeholder='{"tool": "github.list_repositories"}' />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium cursor-pointer">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-1.5 text-[12px] bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-60 cursor-pointer">
            {saving ? "Creating…" : "Create Workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Canvas panel for a single workflow ──────────────────────────────────────

function WorkflowCanvas({
  workflow, employees, runResults, onSave,
}: {
  workflow: Workflow; employees: AIEmployee[];
  runResults?: Array<{ step: number; actionType: string; status: string; output: string }>;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}) {
  const nodeTypes = useMemo(() => ({ trigger: TriggerNode, step: StepNode, approval: ApprovalNode }), []);
  const { nodes: initNodes, edges: initEdges } = stepsToCanvas(workflow, employees, runResults);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Re-sync when run results change
  useEffect(() => {
    const { nodes: n, edges: e } = stepsToCanvas(workflow, employees, runResults);
    setNodes(n); setEdges(e);
  }, [runResults?.length]);

  const onConnect = useCallback(
    (p: Connection) => setEdges((es) => addEdge({ ...p, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }, es)),
    [setEdges]
  );

  return (
    <div className="h-[360px] bg-slate-50 border border-slate-200 relative">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        fitView fitViewOptions={{ padding: 0.25 }}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls className="!bg-white !border !border-slate-200" />
      </ReactFlow>
      {onSave && (
        <button onClick={() => onSave(nodes, edges)}
          className="absolute top-2 right-2 z-10 px-2.5 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer">
          Save Layout
        </button>
      )}
    </div>
  );
}

// ─── Run Result Panel ─────────────────────────────────────────────────────────

function RunResultPanel({ results, onClose }: {
  results: Array<{ step: number; actionType: string; status: string; output: string }>;
  onClose: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Run Complete — {results.filter(r => r.status === "COMPLETED").length}/{results.length} steps succeeded
        </h4>
        <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">Dismiss</button>
      </div>
      <div className="divide-y divide-slate-100">
        {results.map((r) => (
          <div key={r.step} className="py-2.5 flex items-start gap-3">
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 mt-0.5 ${STEP_STATUS_COLORS[r.status] || STEP_STATUS_COLORS.PENDING}`}>
              {r.status}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-700">{ACTION_ICONS[r.actionType]} Step {r.step}: {r.actionType.replace(/_/g, " ")}</p>
              <p className="text-[12px] text-slate-600 mt-0.5 leading-relaxed">{r.output}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Workflow card ────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow, employees, companyId, onRefresh,
}: {
  workflow: Workflow; employees: AIEmployee[]; companyId: string; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [runResults, setRunResults] = useState<Array<{ step: number; actionType: string; status: string; output: string }> | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function trigger() {
    setTriggering(true);
    setRunResults(null);
    try {
      const res = await api.triggerWorkflow(companyId, workflow.id, {});
      setRunResults(res.stepResults);
      setExpanded(true);
    } catch (e: any) { alert(e?.message || "Failed to trigger"); }
    finally { setTriggering(false); }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      await api.updateWorkflow(companyId, workflow.id, { isActive: !workflow.isActive });
      onRefresh();
    } finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteWorkflow(companyId, workflow.id);
      onRefresh();
    } finally { setDeleting(false); }
  }

  async function saveCanvas(nodes: Node[], edges: Edge[]) {
    try {
      await api.saveWorkflowCanvas(companyId, workflow.id, nodes, edges);
    } catch { /* silent */ }
  }

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-bold text-slate-900 truncate">{workflow.name}</h3>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${workflow.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                {workflow.isActive ? "● ACTIVE" : "○ PAUSED"}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200">
                ⚡ {TRIGGER_LABELS[workflow.triggerType]}
              </span>
            </div>
            {workflow.description && (
              <p className="text-[12px] text-slate-500 mt-1 line-clamp-1">{workflow.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
              <span>{(workflow.steps || []).length} step{(workflow.steps || []).length !== 1 ? "s" : ""}</span>
              <span>Runs: {workflow.runCount || 0}</span>
              {workflow.lastRunAt && <span>Last: {relTime(workflow.lastRunAt)}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <button onClick={() => setExpanded(!expanded)}
              className="h-7 px-2.5 border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-50 cursor-pointer">
              {expanded ? "Collapse" : "View Canvas"}
            </button>
            <button onClick={trigger} disabled={triggering || !workflow.isActive}
              className="h-7 px-3 bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors">
              {triggering ? "Running…" : "▶ Run"}
            </button>
            <button onClick={toggleActive} disabled={toggling}
              className="h-7 px-2.5 border border-slate-200 text-slate-500 text-[11px] hover:bg-slate-50 cursor-pointer disabled:opacity-50">
              {workflow.isActive ? "Pause" : "Enable"}
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="h-7 px-2 border border-red-200 text-red-500 text-[11px] hover:bg-red-50 cursor-pointer disabled:opacity-50">
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        </div>

        {/* Step pills */}
        {(workflow.steps || []).length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {(workflow.steps || []).map((step, i) => (
              <div key={step.id || i} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300 text-[10px]">→</span>}
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${ACTION_COLORS[step.actionType]?.badge || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                  {ACTION_ICONS[step.actionType]} {step.actionType.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Canvas + run results */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <WorkflowCanvas
            workflow={workflow} employees={employees}
            runResults={runResults || undefined}
            onSave={saveCanvas}
          />
          {runResults && (
            <RunResultPanel results={runResults} onClose={() => setRunResults(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [employees, setEmployees] = useState<AIEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [wfRes, empRes] = await Promise.all([
        api.getWorkflows(companyId),
        api.getEmployees(companyId),
      ]);
      setWorkflows(wfRes.workflows || []);
      setEmployees(empRes.employees || []);
    } catch (err) { console.warn("Workflow load error:", err); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = workflows.filter((wf) => {
    if (filter === "active" && !wf.isActive) return false;
    if (filter === "paused" && wf.isActive) return false;
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase()) &&
        !wf.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.isActive).length,
    runs: workflows.reduce((a, w) => a + (w.runCount || 0), 0),
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5 font-sans">

      {/* Header */}
      <div className="bg-white border border-slate-200 p-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workflows</h1>
          <p className="text-[12px] text-slate-500 mt-1">
            Automate multi-step clone processes — each step powered by Mistral AI.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="h-9 px-4 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Build New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Workflows", value: stats.total, color: "text-slate-900" },
          { label: "Active",          value: stats.active, color: "text-emerald-600" },
          { label: "Total Runs",      value: stats.runs,  color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-slate-200 bg-white">
          {(["all", "active", "paused"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer capitalize ${
                filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {f}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows…"
          className="flex-1 max-w-xs h-8 px-3 border border-slate-200 text-[12px] text-slate-800 focus:outline-none focus:border-slate-400" />
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length} workflow{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="bg-white border border-slate-200 h-24 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 flex items-center justify-center text-2xl mx-auto">🔀</div>
          <p className="text-[14px] font-bold text-slate-700">
            {workflows.length === 0 ? "No workflows yet" : "No matching workflows"}
          </p>
          <p className="text-[12px] text-slate-400 max-w-xs mx-auto">
            {workflows.length === 0
              ? "Build a workflow to automate multi-step processes across your AI team."
              : "Try adjusting your search or filter."}
          </p>
          {workflows.length === 0 && (
            <button onClick={() => setCreateOpen(true)}
              className="px-4 py-2 bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-700 cursor-pointer">
              + Build First Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((wf) => (
            <WorkflowCard key={wf.id} workflow={wf} employees={employees} companyId={companyId!} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Create modal */}
      {createOpen && companyId && (
        <CreateWorkflowModal
          companyId={companyId}
          employees={employees}
          onClose={() => setCreateOpen(false)}
          onCreated={(wf) => { setWorkflows((prev) => [wf, ...prev]); }}
        />
      )}
    </div>
  );
}
