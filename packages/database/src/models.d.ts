import mongoose from "mongoose";
export declare enum Role {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MEMBER = "MEMBER"
}
export declare enum EmployeeStatus {
    IDLE = "IDLE",
    WORKING = "WORKING",
    ACTIVE = "ACTIVE",
    PAUSED = "PAUSED"
}
export declare enum TaskStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}
export declare enum TaskPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT"
}
export declare enum RiskLevel {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum ApprovalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare enum TriggerType {
    EVENT = "EVENT",
    CRON = "CRON",
    INTERVAL = "INTERVAL",
    DEADLINE = "DEADLINE",
    CONDITION = "CONDITION",
    MANUAL = "MANUAL"
}
export declare enum RuntimeExecutionStatus {
    QUEUED = "QUEUED",
    PLANNING = "PLANNING",
    WAITING_FOR_AUTHORITY = "WAITING_FOR_AUTHORITY",
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL",
    EXECUTING = "EXECUTING",
    VERIFYING = "VERIFYING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum CommitmentStatus {
    OPEN = "OPEN",
    IN_PROGRESS = "IN_PROGRESS",
    BLOCKED = "BLOCKED",
    COMPLETED = "COMPLETED",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare enum EscalationSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum EscalationStatus {
    OPEN = "OPEN",
    ACKNOWLEDGED = "ACKNOWLEDGED",
    RESOLVED = "RESOLVED",
    ESCALATED = "ESCALATED"
}
export declare const WorkflowModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const WorkflowStepModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const UserModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const CompanyModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const MembershipModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const TeamModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ConnectedAccountModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const AIEmployeeModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const TaskModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ApprovalRequestModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const EmployeeMemoryModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ActivityLogModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ChannelModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ChannelMessageModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const OAuthStateModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const AuditLogModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ConversationModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ConversationMessageModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeEventModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeTriggerModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeActionModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeExecutionModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeScheduleModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeCommitmentModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RuntimeEscalationModel: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const CompiledRuntimeStateModel: mongoose.Model<any, {}, {}, {}, any, any>;
//# sourceMappingURL=models.d.ts.map