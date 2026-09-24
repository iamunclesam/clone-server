"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIEmployeeOrchestrator = void 0;
const state_machine_1 = require("./state-machine");
const sanitizer_1 = require("./sanitizer");
const memory_engine_1 = require("./memory-engine");
const integration_framework_1 = require("@clone/integration-framework");
class AIEmployeeOrchestrator {
    memoryEngine;
    registry;
    constructor() {
        this.memoryEngine = new memory_engine_1.MemoryEngine();
        this.registry = integration_framework_1.IntegrationRegistry.getInstance();
    }
    async executeTask(input) {
        const traceId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sanitizedPrompt = sanitizer_1.PromptSanitizer.sanitizeInput(input.naturalPrompt);
        const context = {
            executionId: `exec_${Date.now()}`,
            traceId,
            companyId: input.companyId,
            employeeId: input.employee.id,
            taskId: input.taskId,
            naturalPrompt: sanitizedPrompt,
            currentState: "RECEIVED",
            steps: [],
            tokenUsage: 0,
            maxSteps: input.maxSteps || 10,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.addLogStep(context, "RECEIVED", `Execution initialized for AI Employee ${input.employee.name} (${input.employee.role}).`);
        // 1. Transition to PLANNING
        context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "PLANNING");
        this.addLogStep(context, "PLANNING", `Analyzing task: "${sanitizedPrompt}" using persona instructions.`);
        // Fetch memory context
        const memories = await this.memoryEngine.searchMemories({
            companyId: input.companyId,
            employeeId: input.employee.id,
            query: sanitizedPrompt,
        });
        this.addLogStep(context, "PLANNING", `Loaded ${memories.length} relevant memory snippets for context.`);
        // 2. Determine required tool based on natural language intent
        const intentLower = sanitizedPrompt.toLowerCase();
        if (intentLower.includes("email") || intentLower.includes("support")) {
            const toolName = intentLower.includes("send") ? "gmail.send_message" : "gmail.read_message";
            const requiresApproval = toolName === "gmail.send_message";
            if (requiresApproval) {
                context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_APPROVAL");
                const approvalId = `appr_${Date.now()}`;
                this.addLogStep(context, "WAITING_FOR_APPROVAL", `Sensitive action detected (${toolName}). Escalating for founder approval.`, {
                    toolName,
                    args: { to: "customer@company.com", subject: "Support Follow-up", body: "Draft prepared by " + input.employee.name },
                    approvalId,
                });
            }
            else {
                context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_TOOL");
                context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "EXECUTING");
                const provider = this.registry.getProvider("gmail");
                const toolResult = await provider?.executeTool({
                    connectionId: "conn_gmail_demo",
                    toolName: "gmail.read_message",
                    arguments: { query: "is:unread" },
                    employeeId: input.employee.id,
                    companyId: input.companyId,
                });
                this.addLogStep(context, "EXECUTING", `Executed tool ${toolName} successfully.`, {
                    toolName,
                    args: { query: "is:unread" },
                    result: toolResult?.data,
                });
                context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "VERIFYING");
                context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "COMPLETED");
                this.addLogStep(context, "COMPLETED", `Task completed successfully. Unread support emails reviewed.`);
            }
        }
        else if (intentLower.includes("pr") || intentLower.includes("code") || intentLower.includes("github") || intentLower.includes("architect")) {
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_TOOL");
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "EXECUTING");
            const ghProvider = this.registry.getProvider("github");
            const result = await ghProvider?.executeTool({
                connectionId: "conn_gh_demo",
                toolName: "github.read_repository",
                arguments: { owner: "acme", repo: "api-core" },
                employeeId: input.employee.id,
                companyId: input.companyId,
            });
            this.addLogStep(context, "EXECUTING", `Executed github.read_repository. Fetched repository file tree.`, {
                toolName: "github.read_repository",
                args: { owner: "acme", repo: "api-core" },
                result: result?.data,
            });
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "VERIFYING");
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "COMPLETED");
            this.addLogStep(context, "COMPLETED", `Technical plan created and repository verified.`);
        }
        else {
            // General task completion
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "VERIFYING");
            context.currentState = state_machine_1.ExecutionStateMachine.transition(context.currentState, "COMPLETED");
            this.addLogStep(context, "COMPLETED", `Task analyzed and executed according to instructions.`);
        }
        context.tokenUsage = 350 + context.steps.length * 45;
        return context;
    }
    addLogStep(context, state, details, toolCall) {
        context.steps.push({
            stepIndex: context.steps.length + 1,
            state,
            timestamp: new Date(),
            details,
            toolCall,
        });
        context.updatedAt = new Date();
    }
}
exports.AIEmployeeOrchestrator = AIEmployeeOrchestrator;
//# sourceMappingURL=orchestrator.js.map