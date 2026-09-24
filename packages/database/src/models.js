"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompiledRuntimeStateModel = exports.RuntimeEscalationModel = exports.RuntimeCommitmentModel = exports.RuntimeScheduleModel = exports.RuntimeExecutionModel = exports.RuntimeActionModel = exports.RuntimeTriggerModel = exports.RuntimeEventModel = exports.ConversationMessageModel = exports.ConversationModel = exports.AuditLogModel = exports.OAuthStateModel = exports.ChannelMessageModel = exports.ChannelModel = exports.ActivityLogModel = exports.EmployeeMemoryModel = exports.ApprovalRequestModel = exports.TaskModel = exports.AIEmployeeModel = exports.ConnectedAccountModel = exports.TeamModel = exports.MembershipModel = exports.CompanyModel = exports.UserModel = exports.WorkflowStepModel = exports.WorkflowModel = exports.EscalationStatus = exports.EscalationSeverity = exports.CommitmentStatus = exports.RuntimeExecutionStatus = exports.TriggerType = exports.ApprovalStatus = exports.RiskLevel = exports.TaskPriority = exports.TaskStatus = exports.EmployeeStatus = exports.Role = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Enums
var Role;
(function (Role) {
    Role["OWNER"] = "OWNER";
    Role["ADMIN"] = "ADMIN";
    Role["MEMBER"] = "MEMBER";
})(Role || (exports.Role = Role = {}));
var EmployeeStatus;
(function (EmployeeStatus) {
    EmployeeStatus["IDLE"] = "IDLE";
    EmployeeStatus["WORKING"] = "WORKING";
    EmployeeStatus["ACTIVE"] = "ACTIVE";
    EmployeeStatus["PAUSED"] = "PAUSED";
})(EmployeeStatus || (exports.EmployeeStatus = EmployeeStatus = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "PENDING";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["WAITING_FOR_APPROVAL"] = "WAITING_FOR_APPROVAL";
    TaskStatus["COMPLETED"] = "COMPLETED";
    TaskStatus["FAILED"] = "FAILED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
    TaskPriority["URGENT"] = "URGENT";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "LOW";
    RiskLevel["MEDIUM"] = "MEDIUM";
    RiskLevel["HIGH"] = "HIGH";
    RiskLevel["CRITICAL"] = "CRITICAL";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "PENDING";
    ApprovalStatus["APPROVED"] = "APPROVED";
    ApprovalStatus["REJECTED"] = "REJECTED";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
// 1. User
const UserSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    avatarUrl: { type: String },
}, { timestamps: true });
// 2. Company
const CompanySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    companySize: { type: String },
    companyType: { type: String },
    logoUrl: { type: String },
}, { timestamps: true });
// 3. Membership
const MembershipSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    role: { type: String, enum: Object.values(Role), default: Role.MEMBER },
}, { timestamps: true });
MembershipSchema.index({ userId: 1, companyId: 1 }, { unique: true });
// 4. Team
const TeamSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    leadEmployeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    name: { type: String, required: true },
    description: { type: String },
    instructions: { type: String },
}, { timestamps: true });
// 5. ConnectedAccount
const ConnectedAccountSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    provider: { type: String, required: true },
    accountName: { type: String, required: true },
    accountEmail: { type: String },
    encryptedToken: { type: String, required: true },
    scopes: { type: String },
    status: { type: String, default: "CONNECTED" },
}, { timestamps: true });
// 6. AIEmployee
const AIEmployeeSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Team" },
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
}, { timestamps: true });
// 7. Task
const TaskSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Team" },
    assignedEmployeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    title: { type: String, required: true },
    description: { type: String },
    naturalPrompt: { type: String },
    status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
    priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
    approvalRequired: { type: Boolean, default: false },
}, { timestamps: true });
// 8. ApprovalRequest
const ApprovalRequestSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Task" },
    actionName: { type: String, required: true },
    toolName: { type: String, required: true },
    proposedParams: { type: String },
    riskLevel: { type: String, enum: Object.values(RiskLevel), default: RiskLevel.MEDIUM },
    riskReason: { type: String },
    status: { type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.PENDING },
}, { timestamps: true });
// 9. EmployeeMemory
const EmployeeMemorySchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    scope: { type: String, default: "COMPANY" },
    key: { type: String, required: true },
    content: { type: String, required: true },
    confidence: { type: Number, default: 1.0 },
    source: { type: String },
    vectorEmbedding: [Number],
}, { timestamps: true });
// 10. ActivityLog
const ActivityLogSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    resource: { type: String },
    details: { type: String },
}, { timestamps: true });
// 11. Channel
const ChannelSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Team" },
    name: { type: String, required: true },
    type: { type: String, enum: ["TEAM", "DIRECT", "CROSS_TEAM"], default: "TEAM" },
    topic: { type: String },
    members: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" }],
}, { timestamps: true });
// 12. ChannelMessage
const ChannelMessageSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    channelId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Channel", required: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ["DISCUSSION", "TASK_REQUEST", "DELEGATION", "DECISION", "STATUS_UPDATE"], default: "DISCUSSION" },
    mentions: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" }],
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Task" },
    parentMessageId: { type: mongoose_1.Schema.Types.ObjectId, ref: "ChannelMessage" },
    attachments: [
        {
            fileName: String,
            fileUrl: String,
            fileType: String,
        },
    ],
}, { timestamps: true });
// 13. OAuthState
const OAuthStateSchema = new mongoose_1.Schema({
    stateToken: { type: String, required: true, unique: true },
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
// 14. AuditLog
const AuditLogSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    ipAddress: { type: String },
    requestId: { type: String },
    result: { type: String, default: "SUCCESS" },
    metadata: { type: String },
}, { timestamps: true });
// 15. Conversation
const ConversationSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    title: { type: String, required: true, default: "New Conversation" },
}, { timestamps: true });
// 16. ConversationMessage
const ConversationMessageSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, required: true },
    time: { type: String },
    model: { type: String },
    contextUsed: [{ type: String }],
    approvalRequired: {
        approvalId: String,
        toolName: String,
        args: mongoose_1.Schema.Types.Mixed,
        riskReason: String,
        status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    },
    actionExecuted: {
        toolName: String,
        args: mongoose_1.Schema.Types.Mixed,
        result: mongoose_1.Schema.Types.Mixed,
    },
}, { timestamps: true });
// ─── Runtime Engine Enums ────────────────────────────────────────────────────
var TriggerType;
(function (TriggerType) {
    TriggerType["EVENT"] = "EVENT";
    TriggerType["CRON"] = "CRON";
    TriggerType["INTERVAL"] = "INTERVAL";
    TriggerType["DEADLINE"] = "DEADLINE";
    TriggerType["CONDITION"] = "CONDITION";
    TriggerType["MANUAL"] = "MANUAL";
})(TriggerType || (exports.TriggerType = TriggerType = {}));
var RuntimeExecutionStatus;
(function (RuntimeExecutionStatus) {
    RuntimeExecutionStatus["QUEUED"] = "QUEUED";
    RuntimeExecutionStatus["PLANNING"] = "PLANNING";
    RuntimeExecutionStatus["WAITING_FOR_AUTHORITY"] = "WAITING_FOR_AUTHORITY";
    RuntimeExecutionStatus["WAITING_FOR_APPROVAL"] = "WAITING_FOR_APPROVAL";
    RuntimeExecutionStatus["EXECUTING"] = "EXECUTING";
    RuntimeExecutionStatus["VERIFYING"] = "VERIFYING";
    RuntimeExecutionStatus["COMPLETED"] = "COMPLETED";
    RuntimeExecutionStatus["FAILED"] = "FAILED";
    RuntimeExecutionStatus["CANCELLED"] = "CANCELLED";
})(RuntimeExecutionStatus || (exports.RuntimeExecutionStatus = RuntimeExecutionStatus = {}));
var CommitmentStatus;
(function (CommitmentStatus) {
    CommitmentStatus["OPEN"] = "OPEN";
    CommitmentStatus["IN_PROGRESS"] = "IN_PROGRESS";
    CommitmentStatus["BLOCKED"] = "BLOCKED";
    CommitmentStatus["COMPLETED"] = "COMPLETED";
    CommitmentStatus["OVERDUE"] = "OVERDUE";
    CommitmentStatus["CANCELLED"] = "CANCELLED";
})(CommitmentStatus || (exports.CommitmentStatus = CommitmentStatus = {}));
var EscalationSeverity;
(function (EscalationSeverity) {
    EscalationSeverity["LOW"] = "LOW";
    EscalationSeverity["MEDIUM"] = "MEDIUM";
    EscalationSeverity["HIGH"] = "HIGH";
    EscalationSeverity["CRITICAL"] = "CRITICAL";
})(EscalationSeverity || (exports.EscalationSeverity = EscalationSeverity = {}));
var EscalationStatus;
(function (EscalationStatus) {
    EscalationStatus["OPEN"] = "OPEN";
    EscalationStatus["ACKNOWLEDGED"] = "ACKNOWLEDGED";
    EscalationStatus["RESOLVED"] = "RESOLVED";
    EscalationStatus["ESCALATED"] = "ESCALATED";
})(EscalationStatus || (exports.EscalationStatus = EscalationStatus = {}));
// ─── 17. RuntimeEvent ────────────────────────────────────────────────────────
// Inbound events from integrations or internal signals
const RuntimeEventSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    source: { type: String, required: true }, // "sentry", "github", "linear", "manual", etc.
    eventType: { type: String, required: true }, // "incident.created", "pr.opened", etc.
    payload: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    deduplicationKey: { type: String }, // prevents double-processing
    processedAt: { type: Date },
}, { timestamps: true });
RuntimeEventSchema.index({ companyId: 1, createdAt: -1 });
RuntimeEventSchema.index({ deduplicationKey: 1 }, { sparse: true, unique: true });
// ─── 18. RuntimeTrigger ──────────────────────────────────────────────────────
// Compiled trigger rules for a Clone — generated by RuntimeCompiler
const RuntimeTriggerSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    description: { type: String },
    triggerType: {
        type: String,
        enum: Object.values(TriggerType),
        required: true,
    },
    source: { type: String }, // integration provider, e.g. "sentry"
    eventType: { type: String }, // e.g. "incident.created"
    schedule: { type: String }, // cron expression or ISO interval
    condition: { type: mongoose_1.Schema.Types.Mixed },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 5 }, // 1=highest, 10=lowest
}, { timestamps: true });
RuntimeTriggerSchema.index({ companyId: 1, cloneId: 1 });
RuntimeTriggerSchema.index({ companyId: 1, source: 1, eventType: 1 });
// ─── 19. RuntimeAction ───────────────────────────────────────────────────────
// Available actions for a Clone, derived from integrations + permissions
const RuntimeActionSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    description: { type: String },
    actionType: { type: String }, // "integration", "delegation", "approval_request", "memory", etc.
    toolName: { type: String, required: true },
    riskLevel: { type: String, enum: Object.values(RiskLevel), default: RiskLevel.LOW },
    requiresApproval: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
}, { timestamps: true });
RuntimeActionSchema.index({ companyId: 1, cloneId: 1 });
// ─── 20. RuntimeExecution ────────────────────────────────────────────────────
// A single execution lifecycle — from trigger to completion
const RuntimeExecutionSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    triggerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "RuntimeTrigger" },
    actionId: { type: mongoose_1.Schema.Types.ObjectId, ref: "RuntimeAction" },
    status: {
        type: String,
        enum: Object.values(RuntimeExecutionStatus),
        default: RuntimeExecutionStatus.QUEUED,
    },
    triggerSource: { type: String }, // "sentry.incident.created", "cron:0 8 * * 1-5", "manual", etc.
    input: { type: mongoose_1.Schema.Types.Mixed },
    plan: { type: mongoose_1.Schema.Types.Mixed }, // LLM-generated execution plan
    result: { type: mongoose_1.Schema.Types.Mixed },
    error: { type: String },
    stepLog: [
        {
            step: Number,
            state: String,
            timestamp: Date,
            details: String,
            toolCall: mongoose_1.Schema.Types.Mixed,
        },
    ],
    delegatedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    approvalRequestId: { type: mongoose_1.Schema.Types.ObjectId, ref: "ApprovalRequest" },
    startedAt: { type: Date },
    completedAt: { type: Date },
}, { timestamps: true });
RuntimeExecutionSchema.index({ companyId: 1, cloneId: 1, createdAt: -1 });
RuntimeExecutionSchema.index({ companyId: 1, status: 1 });
// ─── 21. RuntimeSchedule ─────────────────────────────────────────────────────
// Persistent schedules for Clones — CRON, INTERVAL, DEADLINE, ONE_TIME
const RuntimeScheduleSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    name: { type: String, required: true },
    triggerType: {
        type: String,
        enum: Object.values(TriggerType),
        default: TriggerType.CRON,
    },
    cronExpression: { type: String }, // for CRON triggers
    intervalMs: { type: Number }, // for INTERVAL triggers
    timezone: { type: String, default: "UTC" },
    taskType: { type: String }, // e.g. "daily_briefing", "commitment_check"
    taskPayload: { type: mongoose_1.Schema.Types.Mixed },
    enabled: { type: Boolean, default: true },
    nextRunAt: { type: Date },
    lastRunAt: { type: Date },
    lastRunStatus: { type: String },
}, { timestamps: true });
RuntimeScheduleSchema.index({ companyId: 1, cloneId: 1 });
RuntimeScheduleSchema.index({ enabled: 1, nextRunAt: 1 });
// ─── 22. RuntimeCommitment ───────────────────────────────────────────────────
// Promises/obligations a Clone has made — tracked by CommitmentMonitor
const RuntimeCommitmentSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    title: { type: String, required: true },
    description: { type: String },
    source: { type: String }, // "execution", "delegation", "channel_message", "manual"
    sourceId: { type: String }, // executionId or messageId that created it
    ownerCloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
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
}, { timestamps: true });
RuntimeCommitmentSchema.index({ companyId: 1, cloneId: 1, status: 1 });
RuntimeCommitmentSchema.index({ status: 1, dueAt: 1 });
// ─── 23. RuntimeEscalation ───────────────────────────────────────────────────
// Escalation records — when a Clone cannot proceed and needs human/lead attention
const RuntimeEscalationSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true },
    executionId: { type: mongoose_1.Schema.Types.ObjectId, ref: "RuntimeExecution" },
    commitmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: "RuntimeCommitment" },
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
}, { timestamps: true });
RuntimeEscalationSchema.index({ companyId: 1, status: 1 });
RuntimeEscalationSchema.index({ companyId: 1, cloneId: 1, createdAt: -1 });
// ─── 24. CompiledRuntimeState ─────────────────────────────────────────────────
// Cached output of RuntimeCompiler.compileRuntime() — updated when Clone config changes
const CompiledRuntimeStateSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    cloneId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee", required: true, unique: true },
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
}, { timestamps: true });
CompiledRuntimeStateSchema.index({ companyId: 1 });
// ─── 25. Workflow ─────────────────────────────────────────────────────────────
const WorkflowSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
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
    canvasJson: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
WorkflowSchema.index({ companyId: 1, createdAt: -1 });
// ─── 26. WorkflowStep ─────────────────────────────────────────────────────────
const WorkflowStepSchema = new mongoose_1.Schema({
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Company", required: true },
    workflowId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Workflow", required: true },
    stepOrder: { type: Number, required: true },
    employeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "AIEmployee" },
    actionType: {
        type: String,
        enum: ["FETCH_CONTEXT", "PLAN", "EXECUTE_TOOL", "HUMAN_APPROVAL", "NOTIFY_SLACK", "SEND_EMAIL"],
        required: true,
    },
    configJson: { type: String },
    status: { type: String, enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "SKIPPED"], default: "PENDING" },
}, { timestamps: true });
WorkflowStepSchema.index({ workflowId: 1, stepOrder: 1 });
// Export Models
exports.WorkflowModel = mongoose_1.default.models.Workflow || mongoose_1.default.model("Workflow", WorkflowSchema);
exports.WorkflowStepModel = mongoose_1.default.models.WorkflowStep || mongoose_1.default.model("WorkflowStep", WorkflowStepSchema);
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model("User", UserSchema);
exports.CompanyModel = mongoose_1.default.models.Company || mongoose_1.default.model("Company", CompanySchema);
exports.MembershipModel = mongoose_1.default.models.Membership || mongoose_1.default.model("Membership", MembershipSchema);
exports.TeamModel = mongoose_1.default.models.Team || mongoose_1.default.model("Team", TeamSchema);
exports.ConnectedAccountModel = mongoose_1.default.models.ConnectedAccount || mongoose_1.default.model("ConnectedAccount", ConnectedAccountSchema);
exports.AIEmployeeModel = mongoose_1.default.models.AIEmployee || mongoose_1.default.model("AIEmployee", AIEmployeeSchema);
exports.TaskModel = mongoose_1.default.models.Task || mongoose_1.default.model("Task", TaskSchema);
exports.ApprovalRequestModel = mongoose_1.default.models.ApprovalRequest || mongoose_1.default.model("ApprovalRequest", ApprovalRequestSchema);
exports.EmployeeMemoryModel = mongoose_1.default.models.EmployeeMemory || mongoose_1.default.model("EmployeeMemory", EmployeeMemorySchema);
exports.ActivityLogModel = mongoose_1.default.models.ActivityLog || mongoose_1.default.model("ActivityLog", ActivityLogSchema);
exports.ChannelModel = mongoose_1.default.models.Channel || mongoose_1.default.model("Channel", ChannelSchema);
exports.ChannelMessageModel = mongoose_1.default.models.ChannelMessage || mongoose_1.default.model("ChannelMessage", ChannelMessageSchema);
exports.OAuthStateModel = mongoose_1.default.models.OAuthState || mongoose_1.default.model("OAuthState", OAuthStateSchema);
exports.AuditLogModel = mongoose_1.default.models.AuditLog || mongoose_1.default.model("AuditLog", AuditLogSchema);
exports.ConversationModel = mongoose_1.default.models.Conversation || mongoose_1.default.model("Conversation", ConversationSchema);
exports.ConversationMessageModel = mongoose_1.default.models.ConversationMessage || mongoose_1.default.model("ConversationMessage", ConversationMessageSchema);
// Runtime Engine Models
exports.RuntimeEventModel = mongoose_1.default.models.RuntimeEvent || mongoose_1.default.model("RuntimeEvent", RuntimeEventSchema);
exports.RuntimeTriggerModel = mongoose_1.default.models.RuntimeTrigger || mongoose_1.default.model("RuntimeTrigger", RuntimeTriggerSchema);
exports.RuntimeActionModel = mongoose_1.default.models.RuntimeAction || mongoose_1.default.model("RuntimeAction", RuntimeActionSchema);
exports.RuntimeExecutionModel = mongoose_1.default.models.RuntimeExecution || mongoose_1.default.model("RuntimeExecution", RuntimeExecutionSchema);
exports.RuntimeScheduleModel = mongoose_1.default.models.RuntimeSchedule || mongoose_1.default.model("RuntimeSchedule", RuntimeScheduleSchema);
exports.RuntimeCommitmentModel = mongoose_1.default.models.RuntimeCommitment || mongoose_1.default.model("RuntimeCommitment", RuntimeCommitmentSchema);
exports.RuntimeEscalationModel = mongoose_1.default.models.RuntimeEscalation || mongoose_1.default.model("RuntimeEscalation", RuntimeEscalationSchema);
exports.CompiledRuntimeStateModel = mongoose_1.default.models.CompiledRuntimeState || mongoose_1.default.model("CompiledRuntimeState", CompiledRuntimeStateSchema);
//# sourceMappingURL=models.js.map