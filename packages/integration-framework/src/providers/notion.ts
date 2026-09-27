import { IntegrationProvider, IntegrationCapability } from "../types";

function getNotionOAuthCreds() {
  const clientId = (process.env.NOTION_CLIENT_ID || "").trim();
  const clientSecret = (process.env.NOTION_CLIENT_SECRET || "").trim();
  return { clientId, clientSecret };
}

function toolToken(args: Record<string, unknown>): string {
  return String(args?.accessToken || process.env.NOTION_API_KEY || "").trim();
}

async function notionApiFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.notion.com/v1/${endpoint.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(url, { ...options, headers });
}

export class NotionIntegrationProvider implements IntegrationProvider {
  providerId = "notion";
  name = "Notion";
  description = "Search organizational knowledge bases, index internal docs, and create wiki pages.";
  category = "Productivity" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const { clientId } = getNotionOAuthCreds();
    const effectiveClientId = clientId || "mock_notion_client_id";

    const params = new URLSearchParams({
      client_id: effectiveClientId,
      response_type: "code",
      owner: "user",
      redirect_uri: input.redirectUri,
      state: input.state,
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(input: { code: string; state: string; redirectUri: string }): Promise<{
    accountName: string;
    accountEmail?: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
  }> {
    const { clientId, clientSecret } = getNotionOAuthCreds();

    if (!clientId || !clientSecret || clientId === "mock_notion_client_id") {
      return {
        accountName: "Acme Knowledge Workspace",
        accountEmail: "docs@acme.com",
        accessToken: `secret_notion_mock_${Date.now()}`,
        scopes: ["read", "write"],
      };
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion OAuth token exchange failed (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data: {
      access_token?: string;
      workspace_name?: string;
      workspace_icon?: string;
      workspace_id?: string;
      bot_id?: string;
      owner?: { user?: { person?: { email?: string }; name?: string } };
      error?: string;
    } = await res.json();

    if (!data.access_token) {
      throw new Error(`Notion token exchange error: ${data.error || "Missing access token"}`);
    }

    const accountName = data.workspace_name ? `${data.workspace_name} (Notion)` : "Notion Workspace";
    const accountEmail = data.owner?.user?.person?.email || "docs@notion.so";

    return {
      accountName,
      accountEmail,
      accessToken: data.access_token,
      scopes: ["read", "write"],
    };
  }

  async getCapabilities(): Promise<IntegrationCapability[]> {
    return [
      {
        name: "notion.search_pages",
        description: "Search workspace documentation, onboarding guides, and policies.",
        inputSchema: { query: "string", filter: "object?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["read"],
      },
      {
        name: "notion.read_page",
        description: "Read page content, properties, and child block structures.",
        inputSchema: { pageId: "string" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["read"],
      },
      {
        name: "notion.create_page",
        description: "Create new documentation pages or product specs in Notion.",
        inputSchema: { parentId: "string", title: "string", contentMarkdown: "string?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["write"],
      },
      {
        name: "notion.update_page",
        description: "Update existing Notion page titles or property fields.",
        inputSchema: { pageId: "string", title: "string?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["write"],
      },
      {
        name: "notion.create_database_item",
        description: "Add a structured entry/row to a Notion database.",
        inputSchema: { databaseId: "string", title: "string", properties: "object?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["write"],
      },
    ];
  }

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
    const accessToken = toolToken(input.arguments);

    // Support both notion.search and notion.search_pages
    const normalizedTool = input.toolName === "notion.search" ? "notion.search_pages" : input.toolName;

    if (!accessToken || accessToken.startsWith("secret_notion_mock_")) {
      return {
        success: false,
        data: null,
        error: "Notion is not connected with a valid access token. Please connect Notion in workspace integration settings.",
      };
    }

    // Live Notion API execution
    if (normalizedTool === "notion.search_pages") {
      const query = String(input.arguments.query || "");
      const res = await notionApiFetch("search", accessToken, {
        method: "POST",
        body: JSON.stringify({ query, page_size: 10 }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Notion search HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { results?: Array<{ id: string; url?: string; properties?: Record<string, any> }> } = await res.json();
      const formatted = (data.results || []).map((r) => {
        let title = "Untitled";
        if (r.properties) {
          const titleProp = Object.values(r.properties).find((p: any) => p.type === "title");
          if (titleProp?.title && titleProp.title.length > 0) {
            title = titleProp.title.map((t: any) => t.plain_text).join("");
          }
        }
        return { id: r.id, title, url: r.url };
      });

      return {
        success: true,
        data: { results: formatted },
      };
    }

    if (normalizedTool === "notion.read_page") {
      const pageId = String(input.arguments.pageId || "");
      if (!pageId) {
        return { success: false, data: null, error: "notion.read_page requires pageId." };
      }

      const pageRes = await notionApiFetch(`pages/${pageId}`, accessToken);
      if (!pageRes.ok) {
        const errText = await pageRes.text();
        return { success: false, data: null, error: `Notion read_page HTTP error (${pageRes.status}): ${errText.slice(0, 300)}` };
      }
      const pageData: any = await pageRes.json();

      const blocksRes = await notionApiFetch(`blocks/${pageId}/children?page_size=50`, accessToken);
      let blocks: any[] = [];
      if (blocksRes.ok) {
        const blocksData: any = await blocksRes.json();
        blocks = blocksData.results || [];
      }

      let title = "Untitled";
      if (pageData.properties) {
        const titleProp = Object.values(pageData.properties).find((p: any) => p?.type === "title") as any;
        if (titleProp?.title?.length) {
          title = titleProp.title.map((t: any) => t.plain_text).join("");
        }
      }

      return {
        success: true,
        data: {
          id: pageData.id,
          title,
          url: pageData.url,
          createdTime: pageData.created_time,
          blocksCount: blocks.length,
        },
      };
    }

    if (normalizedTool === "notion.create_page") {
      const parentId = String(input.arguments.parentId || "");
      const title = String(input.arguments.title || "Untitled Page");
      const contentMarkdown = input.arguments.contentMarkdown ? String(input.arguments.contentMarkdown) : undefined;

      if (!parentId) {
        return { success: false, data: null, error: "notion.create_page requires parentId (page_id or database_id)." };
      }

      const parentPayload = parentId.includes("-") || parentId.length === 32
        ? { page_id: parentId }
        : { database_id: parentId };

      const children = contentMarkdown ? [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: contentMarkdown } }],
          },
        },
      ] : [];

      const res = await notionApiFetch("pages", accessToken, {
        method: "POST",
        body: JSON.stringify({
          parent: parentPayload,
          properties: {
            title: {
              title: [{ type: "text", text: { content: title } }],
            },
          },
          children,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Notion create_page HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const pageData: any = await res.json();
      return {
        success: true,
        data: {
          pageId: pageData.id,
          title,
          url: pageData.url,
          status: "CREATED",
        },
      };
    }

    if (normalizedTool === "notion.update_page") {
      const pageId = String(input.arguments.pageId || "");
      const title = input.arguments.title ? String(input.arguments.title) : undefined;
      if (!pageId) {
        return { success: false, data: null, error: "notion.update_page requires pageId." };
      }

      const properties: Record<string, any> = {};
      if (title) {
        properties.title = {
          title: [{ type: "text", text: { content: title } }],
        };
      }

      const res = await notionApiFetch(`pages/${pageId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Notion update_page HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const pageData: any = await res.json();
      return {
        success: true,
        data: { pageId: pageData.id, updated: true, url: pageData.url },
      };
    }

    if (normalizedTool === "notion.create_database_item") {
      const databaseId = String(input.arguments.databaseId || "");
      const title = String(input.arguments.title || "New Row");
      const customProps = (input.arguments.properties as Record<string, any>) || {};

      if (!databaseId) {
        return { success: false, data: null, error: "notion.create_database_item requires databaseId." };
      }

      const properties: Record<string, any> = {
        Name: {
          title: [{ type: "text", text: { content: title } }],
        },
        ...customProps,
      };

      const res = await notionApiFetch("pages", accessToken, {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Notion create_database_item HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const itemData: any = await res.json();
      return {
        success: true,
        data: { itemId: itemData.id, databaseId, url: itemData.url, status: "CREATED" },
      };
    }

    throw new Error(`Unknown Notion tool: ${input.toolName}`);
  }

  async disconnect(): Promise<void> {}
}
