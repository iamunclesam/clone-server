"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearIntegrationProvider = void 0;
class LinearIntegrationProvider {
    providerId = "linear";
    name = "Linear";
    description = "Manage issue tracking, project cycles, and roadmap execution for engineering & product teams.";
    category = "Project management";
    async getAuthorizationUrl(input) {
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
    async getCapabilities() {
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
    async executeTool(input) {
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
    async disconnect() { }
}
exports.LinearIntegrationProvider = LinearIntegrationProvider;
//# sourceMappingURL=linear.js.map