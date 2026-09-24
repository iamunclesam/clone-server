"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackIntegrationProvider = void 0;
class SlackIntegrationProvider {
    providerId = "slack";
    name = "Slack";
    description = "Send team updates, read channel threads, and notify team members of progress.";
    category = "Communication";
    async getAuthorizationUrl(input) {
        const clientId = process.env.SLACK_CLIENT_ID || "mock_slack_client_id";
        return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&state=${input.state}&user_scope=chat:write,channels:read`;
    }
    async handleCallback() {
        return {
            accountName: "Acme Workspace",
            accountEmail: "bot@acme.slack.com",
            accessToken: `xoxb_mock_${Date.now()}`,
            scopes: ["chat:write", "channels:read"],
        };
    }
    async getCapabilities() {
        return [
            {
                name: "slack.read_channel",
                description: "Read recent messages and discussion context from a Slack channel.",
                inputSchema: { channelId: "string", limit: "number?" },
                riskLevel: "low",
                requiresApproval: false,
                readOnly: true,
                requiredScopes: ["channels:read"],
            },
            {
                name: "slack.send_message",
                description: "Send status notifications or direct messages to Slack channels.",
                inputSchema: { channel: "string", text: "string", threadTs: "string?" },
                riskLevel: "medium",
                requiresApproval: true,
                readOnly: false,
                requiredScopes: ["chat:write"],
            },
        ];
    }
    async executeTool(input) {
        if (input.toolName === "slack.read_channel") {
            return {
                success: true,
                data: {
                    channel: input.arguments.channelId,
                    messages: [
                        { user: "Jane Doe", text: "When is the V2 launch scheduled?", ts: "171000000.100" },
                        { user: "Alex Vance (AI CTO)", text: "Targeting next Friday. PRs are currently under security review.", ts: "171000000.200" }
                    ]
                }
            };
        }
        if (input.toolName === "slack.send_message") {
            return {
                success: true,
                data: {
                    posted: true,
                    ts: `${Date.now()}.000100`,
                    channel: input.arguments.channel
                }
            };
        }
        throw new Error(`Unknown Slack tool: ${input.toolName}`);
    }
    async disconnect() { }
}
exports.SlackIntegrationProvider = SlackIntegrationProvider;
//# sourceMappingURL=slack.js.map