import { ExecutionContext } from "./types";
export interface AIEmployeeProfile {
    id: string;
    name: string;
    role: string;
    personality: string;
    systemInstructions: string;
    llmProvider?: string;
    llmModel?: string;
    permissions: {
        toolName: string;
        requiresApproval: boolean;
        writeAccess: boolean;
    }[];
}
export declare class AIEmployeeOrchestrator {
    private memoryEngine;
    private registry;
    constructor();
    executeTask(input: {
        companyId: string;
        employee: AIEmployeeProfile;
        taskId?: string;
        naturalPrompt: string;
        maxSteps?: number;
    }): Promise<ExecutionContext>;
    private addLogStep;
}
//# sourceMappingURL=orchestrator.d.ts.map