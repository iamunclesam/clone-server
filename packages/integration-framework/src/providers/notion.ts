import { IntegrationProvider, IntegrationCapability } from "../types";

export class NotionIntegrationProvider implements IntegrationProvider {
  providerId = "notion";
  name = "Notion";
  description = "Search organizational knowledge bases, index internal docs, and create wiki pages.";
  category = "Productivity" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
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

  async getCapabilities(): Promise<IntegrationCapability[]> {
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

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
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

  async disconnect(): Promise<void> {}
}
