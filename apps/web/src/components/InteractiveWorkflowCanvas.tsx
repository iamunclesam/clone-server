"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Node,
  Edge,
  BackgroundVariant,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ─── CUSTOM REACT FLOW NODES ───────────────────────────────────────────────

function TriggerNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`bg-white border text-left p-3.5 shadow-sm min-w-[170px] font-sans transition-all ${
        selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border bg-blue-50 border-blue-200 text-blue-700">
          TRIGGER
        </span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border bg-emerald-50 border-emerald-200 text-emerald-700">
          ✓ READY
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">🐙</span>
        <div>
          <div className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "GitHub Webhook"}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.subtitle || "pull_request.opened"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white" />
    </div>
  );
}

function AgentNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`bg-white border text-left p-3.5 shadow-sm min-w-[180px] font-sans transition-all ${
        selected ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border bg-indigo-50 border-indigo-200 text-indigo-700">
          AI AGENT
        </span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          ACTIVE
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
          {data.avatar || "AV"}
        </div>
        <div>
          <div className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "Alex Vance"}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.subtitle || "AI CTO"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white" />
    </div>
  );
}

function MicroVMNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`bg-white border text-left p-3.5 shadow-sm min-w-[170px] font-sans transition-all ${
        selected ? "border-emerald-600 ring-2 ring-emerald-100" : "border-slate-200"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-emerald-600 !border-2 !border-white" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border bg-emerald-50 border-emerald-200 text-emerald-700">
          MICROVM
        </span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border bg-emerald-50 border-emerald-200 text-emerald-700">
          RUNNING
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <div>
          <div className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "E2B Sandbox"}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.subtitle || "npm test"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-600 !border-2 !border-white" />
    </div>
  );
}

function ApprovalNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`bg-white border text-left p-3.5 shadow-sm min-w-[170px] font-sans transition-all ${
        selected ? "border-amber-500 ring-2 ring-amber-100" : "border-amber-300"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border bg-amber-50 border-amber-200 text-amber-800">
          GOVERNANCE
        </span>
        <span className="text-[9px] font-mono font-bold text-amber-700 animate-pulse">⏳ WAITING</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">🛡️</span>
        <div>
          <div className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "Founder Gate"}</div>
          <div className="text-[10px] text-amber-700 font-mono mt-0.5">{data.subtitle || "github.create_pr"}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-white" />
    </div>
  );
}

function ActionNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`bg-white border text-left p-3.5 shadow-sm min-w-[170px] font-sans transition-all ${
        selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border bg-blue-50 border-blue-200 text-blue-700">
          DISPATCH
        </span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border bg-slate-100 border-slate-200 text-slate-600">
          QUEUED
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">{data.icon || "💬"}</span>
        <div>
          <div className="text-[12px] font-bold text-slate-900 leading-tight">{data.label || "Slack Dispatch"}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.subtitle || "#engineering"}</div>
        </div>
      </div>
    </div>
  );
}

// ─── INITIAL REACT FLOW DATA ───────────────────────────────────────────────

const INITIAL_NODES: Node[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 50, y: 140 },
    data: { label: "GitHub Webhook", subtitle: "pull_request.opened" },
  },
  {
    id: "agent-1",
    type: "agent",
    position: { x: 280, y: 140 },
    data: { label: "Alex Vance", subtitle: "AI CTO & Lead Architect", avatar: "AV" },
  },
  {
    id: "microvm-1",
    type: "microvm",
    position: { x: 530, y: 50 },
    data: { label: "E2B Sandbox", subtitle: "AST vulnerability scan" },
  },
  {
    id: "agent-2",
    type: "agent",
    position: { x: 530, y: 230 },
    data: { label: "DevBot-V2", subtitle: "Automated QA Test Suite", avatar: "DB" },
  },
  {
    id: "gate-1",
    type: "approval",
    position: { x: 780, y: 50 },
    data: { label: "Human Founder Gate", subtitle: "github.create_pull_request" },
  },
  {
    id: "action-1",
    type: "action",
    position: { x: 780, y: 230 },
    data: { label: "Slack Notification", subtitle: "#engineering-alerts", icon: "💬" },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1-2", source: "trigger-1", target: "agent-1", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
  { id: "e2-3", source: "agent-1", target: "microvm-1", animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } },
  { id: "e2-4", source: "agent-1", target: "agent-2", animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } },
  { id: "e3-5", source: "microvm-1", target: "gate-1", animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
  { id: "e4-6", source: "agent-2", target: "action-1", animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
];

export default function InteractiveWorkflowCanvas() {
  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      agent: AgentNode,
      microvm: MicroVMNode,
      approval: ApprovalNode,
      action: ActionNode,
    }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(INITIAL_NODES[1]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addCustomNode = (type: "agent" | "microvm" | "approval" | "action") => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 50 },
      data: {
        label: type === "agent" ? "New AI Agent" : type === "microvm" ? "New MicroVM Sandbox" : type === "approval" ? "Governance Gate" : "App Integration",
        subtitle: type === "agent" ? "Custom Role" : "Execution Unit",
        avatar: "AI",
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="space-y-4 font-sans text-slate-900">
      {/* React Flow Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              React Flow Multi-Agent Workflow Engine
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold">
            {nodes.length} Nodes • {edges.length} Connectors
          </span>
        </div>

        {/* Node Spawners */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Add Node:</span>
          <button
            onClick={() => addCustomNode("agent")}
            className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-mono text-[11px] font-bold cursor-pointer transition-colors"
          >
            + AI Agent
          </button>
          <button
            onClick={() => addCustomNode("microvm")}
            className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-mono text-[11px] font-bold cursor-pointer transition-colors"
          >
            + MicroVM
          </button>
          <button
            onClick={() => addCustomNode("approval")}
            className="px-2.5 py-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 font-mono text-[11px] font-bold cursor-pointer transition-colors"
          >
            + Gate
          </button>
          <button
            onClick={() => addCustomNode("action")}
            className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-mono text-[11px] font-bold cursor-pointer transition-colors"
          >
            + Action
          </button>
        </div>
      </div>

      {/* Main Flow Canvas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* React Flow Container */}
        <div className="lg:col-span-3 bg-white border border-slate-200 h-[480px] relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
            <Controls className="!bg-white !border !border-slate-200 !shadow-xs" />
          </ReactFlow>
        </div>

        {/* Selected Node Inspector */}
        <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between font-sans space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-mono text-xs">
              <span className="font-bold text-slate-900 uppercase">Node Inspector</span>
              <span className="text-[10px] text-blue-600 font-bold">{selectedNode?.type?.toUpperCase()}</span>
            </div>

            {selectedNode ? (
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Node Title</label>
                  <input
                    type="text"
                    value={(selectedNode.data as any).label || ""}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setNodes((nds) =>
                        nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n))
                      );
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: newLabel } });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:bg-white focus:border-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Subtitle / Function</label>
                  <input
                    type="text"
                    value={(selectedNode.data as any).subtitle || ""}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      setNodes((nds) =>
                        nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, subtitle: newSub } } : n))
                      );
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, subtitle: newSub } });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:bg-white focus:border-slate-900 outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Node ID:</span>
                    <span className="text-slate-800 font-bold">{selectedNode.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Position X:</span>
                    <span className="text-slate-800">{Math.round(selectedNode.position.x)}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Position Y:</span>
                    <span className="text-slate-800">{Math.round(selectedNode.position.y)}px</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400 text-center py-6">
                Click any node in the React Flow canvas to inspect or edit properties.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] font-mono text-slate-400 leading-relaxed">
            💡 Drag handles to connect nodes. Drag nodes to reposition canvas layout.
          </div>
        </div>
      </div>
    </div>
  );
}
