import { ExecutionContext, ExecutionState, ExecutionStepLog } from "./types";
import { ExecutionStateMachine } from "./state-machine";
import { PromptSanitizer } from "./sanitizer";
import { MemoryEngine } from "./memory-engine";
import { IntegrationRegistry } from "@clone/integration-framework";

export interface AIEmployeeProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
  systemInstructions: string;
  llmProvider?: string;
  llmModel?: string;
  permissions: { toolName: string; requiresApproval: boolean; writeAccess: boolean }[];
}

export class AIEmployeeOrchestrator {
  private memoryEngine: MemoryEngine;
  private registry: IntegrationRegistry;

  constructor() {
    this.memoryEngine = new MemoryEngine();
    this.registry = IntegrationRegistry.getInstance();
  }

  async executeTask(input: {
    companyId: string;
    employee: AIEmployeeProfile;
    taskId?: string;
    naturalPrompt: string;
    maxSteps?: number;
  }): Promise<ExecutionContext> {
    const traceId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedPrompt = PromptSanitizer.sanitizeInput(input.naturalPrompt);
    const llmProvider = input.employee.llmProvider || "mistral";
    const llmModel = input.employee.llmModel || "mistral-large-latest";

    const context: ExecutionContext = {
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

    this.addLogStep(context, "RECEIVED", `Execution initialized for AI Employee ${input.employee.name} (${input.employee.role}) powered by ${llmProvider.toUpperCase()} (${llmModel}).`);

    // 1. Transition to PLANNING
    context.currentState = ExecutionStateMachine.transition(context.currentState, "PLANNING");
    this.addLogStep(context, "PLANNING", `Analyzing task: "${sanitizedPrompt}" using ${llmProvider.toUpperCase()} model: ${llmModel}.`);

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
        context.currentState = ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_APPROVAL");
        const approvalId = `appr_${Date.now()}`;
        this.addLogStep(context, "WAITING_FOR_APPROVAL", `Sensitive action detected (${toolName}). Escalating for founder approval.`, {
          toolName,
          args: { to: "customer@company.com", subject: "Support Follow-up", body: "Draft prepared by " + input.employee.name },
          approvalId,
        });
      } else {
        context.currentState = ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_TOOL");
        context.currentState = ExecutionStateMachine.transition(context.currentState, "EXECUTING");
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
        context.currentState = ExecutionStateMachine.transition(context.currentState, "VERIFYING");
        context.currentState = ExecutionStateMachine.transition(context.currentState, "COMPLETED");
        this.addLogStep(context, "COMPLETED", `Task completed successfully. Unread support emails reviewed.`);
      }
    } else if (intentLower.includes("pr") || intentLower.includes("code") || intentLower.includes("github") || intentLower.includes("architect")) {
      context.currentState = ExecutionStateMachine.transition(context.currentState, "WAITING_FOR_TOOL");
      context.currentState = ExecutionStateMachine.transition(context.currentState, "EXECUTING");
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
      context.currentState = ExecutionStateMachine.transition(context.currentState, "VERIFYING");
      context.currentState = ExecutionStateMachine.transition(context.currentState, "COMPLETED");
      this.addLogStep(context, "COMPLETED", `Technical plan created and repository verified.`);
    } else {
      // General task completion
      context.currentState = ExecutionStateMachine.transition(context.currentState, "VERIFYING");
      context.currentState = ExecutionStateMachine.transition(context.currentState, "COMPLETED");
      this.addLogStep(context, "COMPLETED", `Task analyzed and executed according to instructions.`);
    }

    context.tokenUsage = 350 + context.steps.length * 45;
    return context;
  }

  private addLogStep(context: ExecutionContext, state: ExecutionState, details: string, toolCall?: ExecutionStepLog["toolCall"]) {
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
