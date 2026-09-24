/**
 * Runtime Engine — Core Type System
 *
 * These types are the vocabulary of the entire Runtime Engine.
 * Every component (compiler, router, authority gate, delegation, commitments,
 * escalation, memory) speaks in these terms.
 */

import { RuntimeTriggerKind } from "@clone/integration-framework";

// ─── Execution Status ─────────────────────────────────────────────────────────

export type RuntimeExecutionStatus =
  | "QUEUED"
  | "PLANNING"
  | "WAITING_FOR_AUTHORITY"
  | "WAITING_FOR_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ─── Authority ────────────────────────────────────────────────────────────────

export type AuthorityDecision = "ALLOW" | "DENY" | "APPROVAL" | "DELEGATE";

export type AuthorityResult = {
  decision: AuthorityDecision;
  reason: string;
  actionId: string;
  requiresApproval: boolean;
};

export type AuthorityLevel = "FOUNDER" | "LEAD" | "MEMBER";

// ─── Permissions ──────────────────────────────────────────────────────────────

export type ClonePermission = {
  /** Either "provider" (grants all actions for that provider) or "provider.action_name" */
  toolName: string;
  requiresApproval?: boolean;
  writeAccess?: boolean;
};

// ─── Responsibility ───────────────────────────────────────────────────────────

export type Responsibility = {
  id?: string;
  title: string;
  description?: string;
  /** Tags used for event relevance matching */
  tags?: string[];
};

// ─── Clone Identity ───────────────────────────────────────────────────────────

export type CloneIdentity = {
  id: string;
  name: string;
  role: string;
  personality?: string;
  /** Free-text responsibilities — used for relevance matching */
  responsibilities: string;
  status: string;
};

// ─── Connected Integration ────────────────────────────────────────────────────

export type ConnectedIntegration = {
  provider: string;
  connectionId: string;
  accountName?: string;
  accessToken?: string;
  scopes?: string;
};

// ─── Authority Config ─────────────────────────────────────────────────────────

export type CloneAuthority = {
  level: AuthorityLevel;
  canDelegate: boolean;
  canApprove: boolean;
  reportsTo?: string;   // cloneId or userId
  /** Specific actions this Clone can approve on behalf of others */
  approvalScope?: string[];
};

// ─── Human Team Member ────────────────────────────────────────────────────────

export type HumanTeamMember = {
  /** userId */
  id: string;
  name: string;
  role: string;
  /** The specific responsibilities this human owns */
  owns: string[];
  /** Can this human approve actions? */
  canApprove?: boolean;
  email?: string;
};

// ─── Team Context ─────────────────────────────────────────────────────────────

export type TeamContext = {
  id?: string;
  name?: string;
  leadId?: string;
  /** Clone IDs that are part of this team */
  memberIds: string[];
  /** Human users on this team */
  humanOwners: HumanTeamMember[];
};

// ─── Commitment Snapshot ─────────────────────────────────────────────────────

export type CommitmentSnapshot = {
  id: string;
  title: string;
  ownerCloneId: string;
  dueAt?: Date;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "OVERDUE" | "CANCELLED";
};

// ─── Full Runtime Context ─────────────────────────────────────────────────────
// This is the complete picture of a Clone at runtime.
// The RuntimeCompiler assembles this from DB records.
// Every decision (authority, delegation, relevance) is made from this context.

export type CloneRuntimeContext = {
  identity: CloneIdentity;
  responsibilities: Responsibility[];
  integrations: string[];               // provider IDs of assigned integrations
  connectedIntegrations: ConnectedIntegration[];
  permissions: ClonePermission[];
  authority: CloneAuthority;
  team: TeamContext;
  commitments: CommitmentSnapshot[];
};

// ─── Compiled Runtime ─────────────────────────────────────────────────────────
// The output of RuntimeCompiler.compileRuntime().
// Cached in DB as CompiledRuntimeState.

export type CompiledRuntime = {
  cloneId: string;
  companyId: string;

  /** Integration event IDs this Clone should react to */
  relevantEvents: string[];

  /** Tool action IDs this Clone can perform */
  availableActions: string[];

  /** Actions that require human/founder approval */
  approvalRequirements: string[];

  /** Clones that can receive delegated work */
  delegationTargets: Array<{
    employeeId: string;
    name: string;
    role: string;
    reason: string;
  }>;

  /** Persistent schedules derived from role + integrations */
  schedules: RuntimeScheduleSpec[];

  compiledAt: Date;
};

// ─── Schedule Spec ────────────────────────────────────────────────────────────

export type RuntimeScheduleSpec = {
  kind: RuntimeTriggerKind;
  name: string;
  taskType: string;
  taskPayload?: Record<string, unknown>;
  /** For CRON triggers */
  cronExpression?: string;
  /** For INTERVAL triggers (milliseconds) */
  intervalMs?: number;
  timezone?: string;
  nextRunAt?: Date;
};

// ─── Trigger Input ────────────────────────────────────────────────────────────

export type RuntimeTriggerInput = {
  kind: RuntimeTriggerKind;
  /** Integration event ID e.g. "sentry.incident_created" */
  eventId?: string;
  provider?: string;
  payload?: Record<string, unknown>;
  source?: string;
  /** For CRON/INTERVAL — the schedule's taskType */
  taskType?: string;
};

// ─── Wake Input ───────────────────────────────────────────────────────────────

export type CloneWakeInput = {
  cloneId: string;
  companyId: string;
  reason: string;
  trigger: RuntimeTriggerInput;
  context?: Record<string, unknown>;
};

// ─── Execution Step ───────────────────────────────────────────────────────────

export type ExecutionStep = {
  step: number;
  state: RuntimeExecutionStatus;
  timestamp: Date;
  details: string;
  toolCall?: {
    toolName: string;
    args?: Record<string, unknown>;
    result?: unknown;
    approvalId?: string;
  };
};

// ─── Execution Result ─────────────────────────────────────────────────────────

export type ExecutionResult = {
  status: RuntimeExecutionStatus;
  action?: string;
  result?: unknown;
  error?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
  delegatedTo?: string;
  stepLog: ExecutionStep[];
};

// ─── Delegation Task ─────────────────────────────────────────────────────────
// Structured task created when one Clone delegates to another

export type DelegationTask = {
  fromCloneId: string;
  toCloneId: string;
  title: string;
  objective: string;
  context: string;
  deadline?: Date;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  expectedOutput: string;
  sourceExecutionId?: string;
};

// ─── Approval Rule ────────────────────────────────────────────────────────────

export type ApprovalRule = {
  actionId: string;
  requiredApprovers: Array<{
    type: "HUMAN" | "CLONE";
    id: string;
    role?: string;
  }>;
  reason: string;
};

// ─── Runtime Dashboard State ─────────────────────────────────────────────────

export type RuntimeDashboardState = {
  companyId: string;
  activeClones: number;
  runningExecutions: number;
  waitingApprovals: number;
  blockedCommitments: number;
  failedExecutions: number;
  overdueCommitments: number;
  openEscalations: number;
  recentEvents: Array<{
    id: string;
    source: string;
    eventType: string;
    createdAt: Date;
    processedAt?: Date;
  }>;
  recentExecutions: Array<{
    id: string;
    cloneId: string;
    cloneName: string;
    cloneRole: string;
    status: RuntimeExecutionStatus;
    triggerSource: string;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  cloneStatuses: CloneRuntimeStatus[];
};

export type CloneRuntimeStatus = {
  cloneId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  status: string;
  currentTask?: string;
  triggeredBy?: string;
  delegatedTo?: string;
  waitingFor?: string;
  lastActiveAt?: Date;
  activeExecutionId?: string;
};
