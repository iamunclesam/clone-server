import { IntegrationProvider, IntegrationCapability } from "../types";

function getSlackOAuthCreds() {
  const clientId = (process.env.SLACK_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SLACK_CLIENT_SECRET || "").trim();
  return { clientId, clientSecret };
}

function toolToken(args: Record<string, unknown>): string {
  return String(args?.accessToken || process.env.SLACK_BOT_TOKEN || "").trim();
}

async function slackApiFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://slack.com/api/${endpoint}`;
  const isPostJson = options.method === "POST" && options.body && typeof options.body === "string";
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(isPostJson ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });
  return response;
}

export class SlackIntegrationProvider implements IntegrationProvider {
  providerId = "slack";
  name = "Slack";
  description = "Send team updates, read channel threads, and notify team members of progress.";
  category = "Communication" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const { clientId } = getSlackOAuthCreds();
    const effectiveClientId = clientId || "mock_slack_client_id";
    
    const botScopes = [
      "chat:write",
      "channels:read",
      "channels:history",
      "groups:read",
      "users:read",
      "users:read.email",
      "im:read",
      "im:write"
    ].join(",");

    const params = new URLSearchParams({
      client_id: effectiveClientId,
      scope: botScopes,
      redirect_uri: input.redirectUri,
      state: input.state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleCallback(input: { code: string; state: string; redirectUri: string }): Promise<{
    accountName: string;
    accountEmail?: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
  }> {
    const { clientId, clientSecret } = getSlackOAuthCreds();

    if (!clientId || !clientSecret || clientId === "mock_slack_client_id") {
      return {
        accountName: "Acme Workspace",
        accountEmail: "bot@acme.slack.com",
        accessToken: `xoxb_mock_${Date.now()}`,
        scopes: ["chat:write", "channels:read", "channels:history", "users:read"],
      };
    }

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    });

    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Slack OAuth token exchange HTTP failure (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data: {
      ok?: boolean;
      error?: string;
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      bot_user_id?: string;
      team?: { id?: string; name?: string };
      authed_user?: { id?: string; access_token?: string };
    } = await res.json();

    if (!data.ok || !data.access_token) {
      throw new Error(`Slack OAuth token exchange failed: ${data.error || "Unknown OAuth error"}`);
    }

    const accountName = data.team?.name ? `${data.team.name} Workspace` : "Slack Workspace";
    let accountEmail = `bot@${(data.team?.name || "slack").toLowerCase().replace(/[^a-z0-0]/g, "")}.com`;

    // Try fetching bot user details for email if available
    try {
      const authTestRes = await slackApiFetch("auth.test", data.access_token, { method: "POST" });
      if (authTestRes.ok) {
        const authData: { user?: string; user_id?: string } = await authTestRes.json();
        if (authData.user) {
          accountEmail = `${authData.user}@slack.com`;
        }
      }
    } catch {}

    const scopes = (data.scope || "chat:write,channels:read")
      .split(/[\s,]+/)
      .filter(Boolean);

    return {
      accountName,
      accountEmail,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scopes,
    };
  }

  async getCapabilities(): Promise<IntegrationCapability[]> {
    return [
      {
        name: "slack.read_channel",
        description: "Read recent messages and discussion context from a Slack channel.",
        inputSchema: { channelId: "string", limit: "number?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["channels:history", "channels:read"],
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
      {
        name: "slack.send_dm",
        description: "Send a direct message to a specific Slack user.",
        inputSchema: { userId: "string", text: "string" },
        riskLevel: "medium",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["chat:write", "im:write"],
      },
      {
        name: "slack.list_channels",
        description: "List available public and private channels in the Slack workspace.",
        inputSchema: { types: "string?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["channels:read"],
      },
      {
        name: "slack.create_channel",
        description: "Create a new Slack channel for team projects or incidents.",
        inputSchema: { name: "string", isPrivate: "boolean?" },
        riskLevel: "medium",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["channels:manage", "groups:write"],
      },
    ];
  }

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
    const accessToken = toolToken(input.arguments);

    if (!accessToken || accessToken.startsWith("xoxb_mock_")) {
      return {
        success: false,
        data: null,
        error: "Slack is not connected with a valid access token. Please connect Slack in workspace integration settings.",
      };
    }

    // Live Slack API execution
    if (input.toolName === "slack.read_channel") {
      const channelId = String(input.arguments.channelId || input.arguments.channel || "");
      if (!channelId) {
        return { success: false, data: null, error: "slack.read_channel requires channelId." };
      }
      const limit = Math.max(1, Math.min(50, Number(input.arguments.limit) || 10));
      const res = await slackApiFetch(`conversations.history?channel=${encodeURIComponent(channelId)}&limit=${limit}`, accessToken);
      
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Slack read_channel HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }
      const data: { ok?: boolean; error?: string; messages?: Array<{ user?: string; text?: string; ts?: string; thread_ts?: string }> } = await res.json();
      if (!data.ok) {
        return { success: false, data: null, error: `Slack API error: ${data.error || "Failed to fetch channel history"}` };
      }
      return {
        success: true,
        data: {
          channel: channelId,
          messages: (data.messages || []).map((m) => ({
            user: m.user || "Unknown",
            text: m.text || "",
            ts: m.ts || "",
            threadTs: m.thread_ts,
          })),
        },
      };
    }

    if (input.toolName === "slack.send_message") {
      const channel = String(input.arguments.channel || "");
      const text = String(input.arguments.text || "");
      const threadTs = input.arguments.threadTs ? String(input.arguments.threadTs) : undefined;
      if (!channel || !text) {
        return { success: false, data: null, error: "slack.send_message requires channel and text." };
      }

      const res = await slackApiFetch("chat.postMessage", accessToken, {
        method: "POST",
        body: JSON.stringify({ channel, text, thread_ts: threadTs }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Slack send_message HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }
      const data: { ok?: boolean; error?: string; ts?: string; channel?: string } = await res.json();
      if (!data.ok) {
        return { success: false, data: null, error: `Slack API error: ${data.error || "Failed to send message"}` };
      }
      return {
        success: true,
        data: {
          posted: true,
          ts: data.ts,
          channel: data.channel || channel,
        },
      };
    }

    if (input.toolName === "slack.send_dm") {
      const userId = String(input.arguments.userId || "");
      const text = String(input.arguments.text || "");
      if (!userId || !text) {
        return { success: false, data: null, error: "slack.send_dm requires userId and text." };
      }

      // Open DM channel
      const openRes = await slackApiFetch("conversations.open", accessToken, {
        method: "POST",
        body: JSON.stringify({ users: userId }),
      });

      if (!openRes.ok) {
        const errText = await openRes.text();
        return { success: false, data: null, error: `Slack conversations.open HTTP error (${openRes.status}): ${errText.slice(0, 300)}` };
      }
      const openData: { ok?: boolean; error?: string; channel?: { id?: string } } = await openRes.json();
      if (!openData.ok || !openData.channel?.id) {
        return { success: false, data: null, error: `Slack API error opening DM: ${openData.error || "Could not open DM channel"}` };
      }

      const channelId = openData.channel.id;
      const sendRes = await slackApiFetch("chat.postMessage", accessToken, {
        method: "POST",
        body: JSON.stringify({ channel: channelId, text }),
      });
      const sendData: { ok?: boolean; error?: string; ts?: string } = await sendRes.json();
      if (!sendData.ok) {
        return { success: false, data: null, error: `Slack API error sending DM: ${sendData.error || "Failed to send DM"}` };
      }

      return {
        success: true,
        data: {
          posted: true,
          recipient: userId,
          channelId,
          ts: sendData.ts,
        },
      };
    }

    if (input.toolName === "slack.list_channels") {
      const types = String(input.arguments.types || "public_channel,private_channel");
      const res = await slackApiFetch(`conversations.list?types=${encodeURIComponent(types)}&limit=100`, accessToken);
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Slack list_channels HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }
      const data: { ok?: boolean; error?: string; channels?: Array<{ id: string; name: string; is_private?: boolean; num_members?: number }> } = await res.json();
      if (!data.ok) {
        return { success: false, data: null, error: `Slack API error: ${data.error || "Failed to list channels"}` };
      }
      return {
        success: true,
        data: {
          channels: (data.channels || []).map((c) => ({
            id: c.id,
            name: c.name,
            isPrivate: Boolean(c.is_private),
            numMembers: c.num_members || 0,
          })),
        },
      };
    }

    if (input.toolName === "slack.create_channel") {
      const name = String(input.arguments.name || "");
      const isPrivate = Boolean(input.arguments.isPrivate);
      if (!name) {
        return { success: false, data: null, error: "slack.create_channel requires channel name." };
      }

      const res = await slackApiFetch("conversations.create", accessToken, {
        method: "POST",
        body: JSON.stringify({ name, is_private: isPrivate }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Slack create_channel HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }
      const data: { ok?: boolean; error?: string; channel?: { id?: string; name?: string } } = await res.json();
      if (!data.ok || !data.channel?.id) {
        return { success: false, data: null, error: `Slack API error creating channel: ${data.error || "Failed to create channel"}` };
      }
      return {
        success: true,
        data: {
          created: true,
          channelId: data.channel.id,
          name: data.channel.name || name,
        },
      };
    }

    throw new Error(`Unknown Slack tool: ${input.toolName}`);
  }

  async disconnect(): Promise<void> {}
}
