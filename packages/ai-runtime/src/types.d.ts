export type ExecutionState = "RECEIVED" | "PLANNING" | "WAITING_FOR_TOOL" | "EXECUTING" | "WAITING_FOR_APPROVAL" | "DELEGATING" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELLED";
export interface ExecutionStepLog {
    stepIndex: number;
    state: ExecutionState;
    timestamp: Date;
    details: string;
    toolCall?: {
        toolName: string;
        args: Record<string, unknown>;
        result?: unknown;
        approvalId?: string;
    };
}
export interface ExecutionContext {
    executionId: string;
    traceId: string;
    companyId: string;
    employeeId: string;
    taskId?: string;
    naturalPrompt: string;
    currentState: ExecutionState;
    steps: ExecutionStepLog[];
    tokenUsage: number;
    maxSteps: number;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=types.d.ts.map