import { IntegrationRegistry } from "@clone/integration-framework";
import { AuthorityGate } from "./authority";
import { CloneRuntimeContext, RuntimeExecutionStatus, RuntimeTriggerInput } from "./types";

export type ExecutionResult = {
  status: RuntimeExecutionStatus;
  action?: string;
  result?: unknown;
  error?: string;
  approvalRequired?: boolean;
  delegatedTo?: string;
};

export class ExecutionEngine {
  private authority = new AuthorityGate();
  private registry = IntegrationRegistry.getInstance();

  async run(input: {
    context: CloneRuntimeContext;
    connectedProviders: string[];
    trigger: RuntimeTriggerInput;
    proposedAction?: string;
    arguments?: Record<string, unknown>;
    connectionId?: string;
    accessToken?: string;
  }): Promise<ExecutionResult> {
    const actionId = input.proposedAction || this.defaultActionFor(input.trigger, input.context);
    if (!actionId) {
      return { status: "COMPLETED", result: { observed: true, trigger: input.trigger.eventId || input.trigger.kind } };
    }

    const gate = this.authority.evaluate({
      context: input.context,
      actionId,
      connectedProviders: input.connectedProviders,
    });

    if (gate.decision === "DENY") {
      return { status: "FAILED", action: actionId, error: gate.reason };
    }

    if (gate.decision === "APPROVAL") {
      return { status: "WAITING_FOR_APPROVAL", action: actionId, approvalRequired: true, error: gate.reason };
    }

    if (gate.decision === "DELEGATE") {
      const target = input.context.team.memberIds.find((id) => id !== input.context.identity.id);
      return { status: "QUEUED", action: actionId, delegatedTo: target, result: { reason: gate.reason } };
    }

    const actionStr = typeof actionId === "string" ? actionId : ((actionId as any)?.id || (actionId as any)?.toolName || String(actionId || ""));
    const providerId = actionStr.includes(".") ? actionStr.split(".")[0] : actionStr;
    const provider = this.registry.getProvider(providerId);
    if (!provider) {
      return { status: "COMPLETED", action: actionId, result: { planned: true, note: "Provider runtime stub — no live executor registered." } };
    }

    try {
      const executed = await provider.executeTool({
        connectionId: input.connectionId || "runtime",
        toolName: actionId,
        arguments: { ...(input.arguments || {}), accessToken: input.accessToken },
        employeeId: input.context.identity.id,
        companyId: "",
      });
      if (!executed?.success) {
        return { status: "FAILED", action: actionId, error: executed?.error || "Tool execution failed" };
      }
      return { status: "COMPLETED", action: actionId, result: executed.data };
    } catch (err: any) {
      return { status: "FAILED", action: actionId, error: err?.message || "Execution error" };
    }
  }

  private defaultActionFor(trigger: RuntimeTriggerInput, context: CloneRuntimeContext): string | undefined {
    if (trigger.kind === "CRON" && context.integrations.includes("github")) return "github.list_repositories";
    if (trigger.kind === "CRON" && context.integrations.includes("slack")) return "slack.read_channel";
    if (trigger.eventId === "github.pr_opened") return "github.read_repository";
    if (trigger.eventId === "github.ci_failed") return "github.read_repository";
    if (trigger.eventId === "linear.issue_overdue") return "linear.update_issue";
    if (trigger.eventId === "sentry.incident") return "sentry.read_issue";
    if (trigger.eventId === "gmail.message_received") return "gmail.read_message";
    return undefined;
  }
}
