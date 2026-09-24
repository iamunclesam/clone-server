import mongoose, { Schema, Document } from "mongoose";

// Enums
export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export enum EmployeeStatus {
  IDLE = "IDLE",
  WORKING = "WORKING",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
}

export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

// 1. User
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

// 2. Company
const CompanySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    companySize: { type: String },
    companyType: { type: String },
    logoUrl: { type: String },
  },
  { timestamps: true }
);

// 3. Membership
const MembershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    role: { type: String, enum: Object.values(Role), default: Role.MEMBER },
  },
  { timestamps: true }
);
MembershipSchema.index({ userId: 1, companyId: 1 }, { unique: true });

// 4. Team
const TeamSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    leadEmployeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    name: { type: String, required: true },
    description: { type: String },
    instructions: { type: String },
  },
  { timestamps: true }
);

// 5. ConnectedAccount
const ConnectedAccountSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    provider: { type: String, required: true },
    accountName: { type: String, required: true },
    accountEmail: { type: String },
    encryptedToken: { type: String, required: true },
    scopes: { type: String },
    status: { type: String, default: "CONNECTED" },
  },
  { timestamps: true }
);

// 6. AIEmployee
const AIEmployeeSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    name: { type: String, required: true },
    role: { type: String, required: true },
    avatarUrl: { type: String },
    shortDescription: { type: String },
    personality: { type: String },
    systemInstructions: { type: String },
    status: { type: String, enum: Object.values(EmployeeStatus), default: EmployeeStatus.ACTIVE },
    llmProvider: { type: String, default: "mistral" },
    llmModel: { type: String, default: "mistral-large-latest" },
    maxMonthlySpend: { type: Number, default: 500.0 },
    currentSpend: { type: Number, default: 0.0 },
    permissions: [
      {
        toolName: String,
        requiresApproval: Boolean,
        writeAccess: Boolean,
      },
    ],
  },
  { timestamps: true }
);

// 7. Task
const TaskSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    assignedEmployeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    title: { type: String, required: true },
    description: { type: String },
    naturalPrompt: { type: String },
    status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
    priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
    approvalRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 8. ApprovalRequest
const ApprovalRequestSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    actionName: { type: String, required: true },
    toolName: { type: String, required: true },
    proposedParams: { type: String },
    riskLevel: { type: String, enum: Object.values(RiskLevel), default: RiskLevel.MEDIUM },
    riskReason: { type: String },
    status: { type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.PENDING },
  },
  { timestamps: true }
);

// 9. EmployeeMemory
const EmployeeMemorySchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    scope: { type: String, default: "COMPANY" },
    key: { type: String, required: true },
    content: { type: String, required: true },
    confidence: { type: Number, default: 1.0 },
    source: { type: String },
    vectorEmbedding: [Number],
  },
  { timestamps: true }
);

// 10. ActivityLog
const ActivityLogSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    resource: { type: String },
    details: { type: String },
  },
  { timestamps: true }
);

// 11. Channel
const ChannelSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    name: { type: String, required: true },
    type: { type: String, enum: ["TEAM", "DIRECT", "CROSS_TEAM"], default: "TEAM" },
    topic: { type: String },
    members: [{ type: Schema.Types.ObjectId, ref: "AIEmployee" }],
  },
  { timestamps: true }
);

// 12. ChannelMessage
const ChannelMessageSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ["DISCUSSION", "TASK_REQUEST", "DELEGATION", "DECISION", "STATUS_UPDATE"], default: "DISCUSSION" },
    mentions: [{ type: Schema.Types.ObjectId, ref: "AIEmployee" }],
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    parentMessageId: { type: Schema.Types.ObjectId, ref: "ChannelMessage" },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
      },
    ],
  },
  { timestamps: true }
);

// 13. OAuthState
const OAuthStateSchema = new Schema(
  {
    stateToken: { type: String, required: true, unique: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// 14. AuditLog
const AuditLogSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    ipAddress: { type: String },
    requestId: { type: String },
    result: { type: String, default: "SUCCESS" },
    metadata: { type: String },
  },
  { timestamps: true }
);

// 15. Conversation
const ConversationSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    title: { type: String, required: true, default: "New Conversation" },
  },
  { timestamps: true }
);

// 16. ConversationMessage
const ConversationMessageSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, required: true },
    time: { type: String },
    model: { type: String },
    contextUsed: [{ type: String }],
    approvalRequired: {
      approvalId: String,
      toolName: String,
      args: Schema.Types.Mixed,
      riskReason: String,
      status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    },
    actionExecuted: {
      toolName: String,
      args: Schema.Types.Mixed,
      result: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// ─── Runtime Engine Enums ────────────────────────────────────────────────────

export enum TriggerType {
  EVENT = "EVENT",
  CRON = "CRON",
  INTERVAL = "INTERVAL",
  DEADLINE = "DEADLINE",
  CONDITION = "CONDITION",
  MANUAL = "MANUAL",
}

export enum RuntimeExecutionStatus {
  QUEUED = "QUEUED",
  PLANNING = "PLANNING",
  WAITING_FOR_AUTHORITY = "WAITING_FOR_AUTHORITY",
  WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL",
  EXECUTING = "EXECUTING",
  VERIFYING = "VERIFYING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum CommitmentStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

export enum EscalationSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum EscalationStatus {
  OPEN = "OPEN",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESOLVED = "RESOLVED",
  ESCALATED = "ESCALATED",
}

// ─── 17. RuntimeEvent ────────────────────────────────────────────────────────
// Inbound events from integrations or internal signals
const RuntimeEventSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    source: { type: String, required: true },           // "sentry", "github", "linear", "manual", etc.
    eventType: { type: String, required: true },         // "incident.created", "pr.opened", etc.
    payload: { type: Schema.Types.Mixed, default: {} },
    deduplicationKey: { type: String },                  // prevents double-processing
    processedAt: { type: Date },
  },
  { timestamps: true }
);
RuntimeEventSchema.index({ companyId: 1, createdAt: -1 });
RuntimeEventSchema.index({ deduplicationKey: 1 }, { sparse: true, unique: true });

// ─── 18. RuntimeTrigger ──────────────────────────────────────────────────────
// Compiled trigger rules for a Clone — generated by RuntimeCompiler
const RuntimeTriggerSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    description: { type: String },
    triggerType: {
      type: String,
      enum: Object.values(TriggerType),
      required: true,
    },
    source: { type: String },               // integration provider, e.g. "sentry"
    eventType: { type: String },            // e.g. "incident.created"
    schedule: { type: String },             // cron expression or ISO interval
    condition: { type: Schema.Types.Mixed },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 5 }, // 1=highest, 10=lowest
  },
  { timestamps: true }
);
RuntimeTriggerSchema.index({ companyId: 1, cloneId: 1 });
RuntimeTriggerSchema.index({ companyId: 1, source: 1, eventType: 1 });

// ─── 19. RuntimeAction ───────────────────────────────────────────────────────
// Available actions for a Clone, derived from integrations + permissions
const RuntimeActionSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    description: { type: String },
    actionType: { type: String },         // "integration", "delegation", "approval_request", "memory", etc.
    toolName: { type: String, required: true },
    riskLevel: { type: String, enum: Object.values(RiskLevel), default: RiskLevel.LOW },
    requiresApproval: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);
RuntimeActionSchema.index({ companyId: 1, cloneId: 1 });

// ─── 20. RuntimeExecution ────────────────────────────────────────────────────
// A single execution lifecycle — from trigger to completion
const RuntimeExecutionSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    triggerId: { type: Schema.Types.ObjectId, ref: "RuntimeTrigger" },
    actionId: { type: Schema.Types.ObjectId, ref: "RuntimeAction" },
    status: {
      type: String,
      enum: Object.values(RuntimeExecutionStatus),
      default: RuntimeExecutionStatus.QUEUED,
    },
    triggerSource: { type: String },      // "sentry.incident.created", "cron:0 8 * * 1-5", "manual", etc.
    input: { type: Schema.Types.Mixed },
    plan: { type: Schema.Types.Mixed },   // LLM-generated execution plan
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    stepLog: [
      {
        step: Number,
        state: String,
        timestamp: Date,
        details: String,
        toolCall: Schema.Types.Mixed,
      },
    ],
    delegatedTo: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    approvalRequestId: { type: Schema.Types.ObjectId, ref: "ApprovalRequest" },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);
RuntimeExecutionSchema.index({ companyId: 1, cloneId: 1, createdAt: -1 });
RuntimeExecutionSchema.index({ companyId: 1, status: 1 });

// ─── 21. RuntimeSchedule ─────────────────────────────────────────────────────
// Persistent schedules for Clones — CRON, INTERVAL, DEADLINE, ONE_TIME
const RuntimeScheduleSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    triggerType: {
      type: String,
      enum: Object.values(TriggerType),
      default: TriggerType.CRON,
    },
    cronExpression: { type: String },     // for CRON triggers
    intervalMs: { type: Number },         // for INTERVAL triggers
    timezone: { type: String, default: "UTC" },
    taskType: { type: String },           // e.g. "daily_briefing", "commitment_check"
    taskPayload: { type: Schema.Types.Mixed },
    enabled: { type: Boolean, default: true },
    nextRunAt: { type: Date },
    lastRunAt: { type: Date },
    lastRunStatus: { type: String },
  },
  { timestamps: true }
);
RuntimeScheduleSchema.index({ companyId: 1, cloneId: 1 });
RuntimeScheduleSchema.index({ enabled: 1, nextRunAt: 1 });

// ─── 22. RuntimeCommitment ───────────────────────────────────────────────────
// Promises/obligations a Clone has made — tracked by CommitmentMonitor
const RuntimeCommitmentSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    title: { type: String, required: true },
    description: { type: String },
    source: { type: String },              // "execution", "delegation", "channel_message", "manual"
    sourceId: { type: String },            // executionId or messageId that created it
    ownerCloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    dueAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(CommitmentStatus),
      default: CommitmentStatus.OPEN,
    },
    priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
    reminderSentAt: { type: Date },
    escalatedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);
RuntimeCommitmentSchema.index({ companyId: 1, cloneId: 1, status: 1 });
RuntimeCommitmentSchema.index({ status: 1, dueAt: 1 });

// ─── 23. RuntimeEscalation ───────────────────────────────────────────────────
// Escalation records — when a Clone cannot proceed and needs human/lead attention
const RuntimeEscalationSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    executionId: { type: Schema.Types.ObjectId, ref: "RuntimeExecution" },
    commitmentId: { type: Schema.Types.ObjectId, ref: "RuntimeCommitment" },
    reason: { type: String, required: true },
    severity: {
      type: String,
      enum: Object.values(EscalationSeverity),
      default: EscalationSeverity.MEDIUM,
    },
    targetType: { type: String, enum: ["CLONE", "HUMAN", "TEAM_LEAD"], required: true },
    targetId: { type: String, required: true }, // cloneId, userId, or teamId
    status: {
      type: String,
      enum: Object.values(EscalationStatus),
      default: EscalationStatus.OPEN,
    },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);
RuntimeEscalationSchema.index({ companyId: 1, status: 1 });
RuntimeEscalationSchema.index({ companyId: 1, cloneId: 1, createdAt: -1 });

// ─── 24. CompiledRuntimeState ─────────────────────────────────────────────────
// Cached output of RuntimeCompiler.compileRuntime() — updated when Clone config changes
const CompiledRuntimeStateSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: Schema.Types.ObjectId, ref: "AIEmployee", required: true, unique: true },
    relevantEvents: [String],
    availableActions: [String],
    approvalRequirements: [String],
    delegationTargets: [
      {
        employeeId: String,
        reason: String,
      },
    ],
    scheduleNames: [String],
    compiledAt: { type: Date, required: true },
    connectedProviders: [String],
  },
  { timestamps: true }
);
CompiledRuntimeStateSchema.index({ companyId: 1 });

// ─── 25. Workflow ─────────────────────────────────────────────────────────────
const WorkflowSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    description: { type: String },
    triggerType: {
      type: String,
      enum: ["EMAIL", "GITHUB_ISSUE", "LINEAR_ISSUE", "SLACK_MESSAGE", "SCHEDULE", "WEBHOOK", "MANUAL"],
      default: "MANUAL",
    },
    isActive: { type: Boolean, default: true },
    lastRunAt: { type: Date },
    runCount: { type: Number, default: 0 },
    // Canvas layout serialised as JSON (nodes + edges from React Flow)
    canvasJson: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);
WorkflowSchema.index({ companyId: 1, createdAt: -1 });

// ─── 26. WorkflowStep ─────────────────────────────────────────────────────────
const WorkflowStepSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    stepOrder: { type: Number, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "AIEmployee" },
    actionType: {
      type: String,
      enum: ["FETCH_CONTEXT", "PLAN", "EXECUTE_TOOL", "HUMAN_APPROVAL", "NOTIFY_SLACK", "SEND_EMAIL"],
      required: true,
    },
    configJson: { type: String },
    status: { type: String, enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "SKIPPED"], default: "PENDING" },
  },
  { timestamps: true }
);
WorkflowStepSchema.index({ workflowId: 1, stepOrder: 1 });

// Export Models
export const WorkflowModel = mongoose.models.Workflow || mongoose.model("Workflow", WorkflowSchema);
export const WorkflowStepModel = mongoose.models.WorkflowStep || mongoose.model("WorkflowStep", WorkflowStepSchema);
export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
export const CompanyModel = mongoose.models.Company || mongoose.model("Company", CompanySchema);
export const MembershipModel = mongoose.models.Membership || mongoose.model("Membership", MembershipSchema);
export const TeamModel = mongoose.models.Team || mongoose.model("Team", TeamSchema);
export const ConnectedAccountModel = mongoose.models.ConnectedAccount || mongoose.model("ConnectedAccount", ConnectedAccountSchema);
export const AIEmployeeModel = mongoose.models.AIEmployee || mongoose.model("AIEmployee", AIEmployeeSchema);
export const TaskModel = mongoose.models.Task || mongoose.model("Task", TaskSchema);
export const ApprovalRequestModel = mongoose.models.ApprovalRequest || mongoose.model("ApprovalRequest", ApprovalRequestSchema);
export const EmployeeMemoryModel = mongoose.models.EmployeeMemory || mongoose.model("EmployeeMemory", EmployeeMemorySchema);
export const ActivityLogModel = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
export const ChannelModel = mongoose.models.Channel || mongoose.model("Channel", ChannelSchema);
export const ChannelMessageModel = mongoose.models.ChannelMessage || mongoose.model("ChannelMessage", ChannelMessageSchema);
export const OAuthStateModel = mongoose.models.OAuthState || mongoose.model("OAuthState", OAuthStateSchema);
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
export const ConversationModel = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
export const ConversationMessageModel = mongoose.models.ConversationMessage || mongoose.model("ConversationMessage", ConversationMessageSchema);

// Runtime Engine Models
export const RuntimeEventModel = mongoose.models.RuntimeEvent || mongoose.model("RuntimeEvent", RuntimeEventSchema);
export const RuntimeTriggerModel = mongoose.models.RuntimeTrigger || mongoose.model("RuntimeTrigger", RuntimeTriggerSchema);
export const RuntimeActionModel = mongoose.models.RuntimeAction || mongoose.model("RuntimeAction", RuntimeActionSchema);
export const RuntimeExecutionModel = mongoose.models.RuntimeExecution || mongoose.model("RuntimeExecution", RuntimeExecutionSchema);
export const RuntimeScheduleModel = mongoose.models.RuntimeSchedule || mongoose.model("RuntimeSchedule", RuntimeScheduleSchema);
export const RuntimeCommitmentModel = mongoose.models.RuntimeCommitment || mongoose.model("RuntimeCommitment", RuntimeCommitmentSchema);
export const RuntimeEscalationModel = mongoose.models.RuntimeEscalation || mongoose.model("RuntimeEscalation", RuntimeEscalationSchema);
export const CompiledRuntimeStateModel = mongoose.models.CompiledRuntimeState || mongoose.model("CompiledRuntimeState", CompiledRuntimeStateSchema);



