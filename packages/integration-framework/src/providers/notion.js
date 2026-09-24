"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionIntegrationProvider = void 0;
class NotionIntegrationProvider {
    providerId = "notion";
    name = "Notion";
    description = "Search organizational knowledge bases, index internal docs, and create wiki pages.";
    category = "Productivity";
    async getAuthorizationUrl(input) {
        const clientId = process.env.NOTION_CLIENT_ID || "mock_notion_client_id";
        return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&state=${input.state}`;
    }
    async handleCallback() {
        return {
            accountName: "Acme Knowledge Workspace",
            accountEmail: "docs@acme.com",
            accessToken: `secret_notion_mock_${Date.now()}`,
            scopes: ["read", "write"],
        };
    }
    async getCapabilities() {
        return [
            {
                name: "notion.search_pages",
                description: "Search workspace documentation, onboarding guides, and policies.",
                inputSchema: { query: "string" },
                riskLevel: "low",
                requiresApproval: false,
                readOnly: true,
                requiredScopes: ["read"],
            },
            {
                name: "notion.create_page",
                description: "Create new documentation pages or product specs in Notion.",
                inputSchema: { parentId: "string", title: "string", contentMarkdown: "string" },
                riskLevel: "medium",
                requiresApproval: false,
                readOnly: false,
                requiredScopes: ["write"],
            },
        ];
    }
    async executeTool(input) {
        if (input.toolName === "notion.search_pages") {
            return {
                success: true,
                data: {
                    results: [
                        { id: "page_001", title: "Acme Engineering Architecture & Conventions", url: "https://notion.so/acme/arch" },
                        { id: "page_002", title: "Customer Support FAQs & Escalation Matrix", url: "https://notion.so/acme/support-faq" }
                    ]
                }
            };
        }
        if (input.toolName === "notion.create_page") {
            return {
                success: true,
                data: { pageId: "page_new_777", title: input.arguments.title, status: "CREATED" }
            };
        }
        throw new Error(`Unknown Notion tool: ${input.toolName}`);
    }
    async disconnect() { }
}
exports.NotionIntegrationProvider = NotionIntegrationProvider;
//# sourceMappingURL=notion.js.map