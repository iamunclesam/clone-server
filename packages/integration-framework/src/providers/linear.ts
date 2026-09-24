import { IntegrationProvider, IntegrationCapability } from "../types";

export class LinearIntegrationProvider implements IntegrationProvider {
  providerId = "linear";
  name = "Linear";
  description = "Manage issue tracking, project cycles, and roadmap execution for engineering & product teams.";
  category = "Project management" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const clientId = process.env.LINEAR_CLIENT_ID || "mock_linear_client_id";
    return `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(input.redirectUri)}&state=${input.state}&response_type=code&scope=read,write`;
  }

  async handleCallback() {
    return {
      accountName: "Acme Linear Team",
      accountEmail: "pm@acme.com",
      accessToken: `lin_mock_${Date.now()}`,
      scopes: ["read", "write"],
    };
  }

  async getCapabilities(): Promise<IntegrationCapability[]> {
    return [
      {
        name: "linear.create_issue",
        description: "Create an issue in Linear with priority, team assignment, and labels.",
        inputSchema: { title: "string", description: "string", priority: "number?", teamKey: "string?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["write"],
      },
      {
        name: "linear.update_issue",
        description: "Update issue status, assignees, or sprint cycles.",
        inputSchema: { issueId: "string", status: "string" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["write"],
      },
    ];
  }

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
    if (input.toolName === "linear.create_issue") {
      return {
        success: true,
        data: {
          issueId: "issue_lin_101",
          identifier: "ACME-104",
          url: "https://linear.app/acme/issue/ACME-104",
          title: input.arguments.title
        }
      };
    }
    if (input.toolName === "linear.update_issue") {
      return {
        success: true,
        data: { issueId: input.arguments.issueId, status: input.arguments.status, updated: true }
      };
    }
    throw new Error(`Unknown Linear tool: ${input.toolName}`);
  }

  async disconnect(): Promise<void> {}
}
