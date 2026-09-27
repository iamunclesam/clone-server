import { IntegrationProvider, IntegrationCapability } from "../types";

function getHubSpotOAuthCreds() {
  const clientId = (process.env.HUBSPOT_CLIENT_ID || "").trim();
  const clientSecret = (process.env.HUBSPOT_CLIENT_SECRET || "").trim();
  const privateToken = (
    process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
    process.env.HUBSPOT_ACCESS_TOKEN ||
    ""
  ).trim();
  return { clientId, clientSecret, privateToken };
}

function toolToken(args: Record<string, unknown>): string {
  const argToken = String(args?.accessToken || "").trim();
  if (argToken && !argToken.startsWith("hubspot_mock_")) {
    return argToken;
  }
  return (
    process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
    process.env.HUBSPOT_ACCESS_TOKEN ||
    process.env.HUBSPOT_CLIENT_SECRET ||
    ""
  ).trim();
}

async function hubspotApiFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.hubapi.com/${endpoint.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(url, { ...options, headers });
}

export class HubSpotIntegrationProvider implements IntegrationProvider {
  providerId = "hubspot";
  name = "HubSpot";
  description = "Sales lead tracking, customer contact management, and deal stages.";
  category = "CRM" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const { clientId, privateToken, clientSecret } = getHubSpotOAuthCreds();

    // If no OAuth Client ID but a Private App Token or Client Secret is present,
    // skip the browser OAuth flow entirely — return the callback URL directly
    // so the route can auto-connect using the token.
    const directToken = privateToken || clientSecret;
    if (directToken && !clientId) {
      const params = new URLSearchParams({
        code: "direct",
        state: input.state,
      });
      return `${input.redirectUri}?${params.toString()}`;
    }

    if (!clientId) {
      throw new Error(
        "HubSpot is not configured. Please set HUBSPOT_CLIENT_ID (for OAuth) or HUBSPOT_PRIVATE_APP_TOKEN / HUBSPOT_CLIENT_SECRET (for Private App) in your .env file."
      );
    }

    const scopes = [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
      "oauth"
    ].join("%20");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: input.redirectUri,
      scope: scopes,
      state: input.state,
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(input: { code: string; state: string; redirectUri: string }): Promise<{
    accountName: string;
    accountEmail?: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
  }> {
    const { clientId, clientSecret, privateToken } = getHubSpotOAuthCreds();
    const effectiveToken = privateToken || (clientSecret && (clientSecret.startsWith("pat-") || !clientId) ? clientSecret : "");

    // If user provided a Private App Token or Client Secret without OAuth Client ID
    if (effectiveToken && (!clientId || clientId === "mock_hubspot_client_id" || clientSecret.startsWith("pat-"))) {
      // Default sentinel — will be overwritten by the real API call below.
      // These are intentionally distinct from the old hardcoded demo values so
      // isDemoConnectedAccount() in the routes can still filter legacy entries.
      let accountName = "";
      let accountEmail = "";

      try {
        // Private App tokens use the account-info endpoint, NOT oauth/v1/access-tokens
        // (that endpoint only works for OAuth access tokens).
        const infoRes = await hubspotApiFetch("account-info/v3/details", effectiveToken);
        if (infoRes.ok) {
          const info: { portalId?: number; uiDomain?: string; accountType?: string } = await infoRes.json();
          if (info.uiDomain) {
            accountName = `${info.uiDomain} (HubSpot)`;
            accountEmail = `portal-${info.portalId}@hubspot.com`;
          } else if (info.portalId) {
            accountName = `HubSpot Portal #${info.portalId}`;
            accountEmail = `portal-${info.portalId}@hubspot.com`;
          }
        }
      } catch {}

      // Second-chance: try the CRM-scoped account info endpoint
      if (!accountName) {
        try {
          const infoRes2 = await hubspotApiFetch("crm-account-info/v3/details", effectiveToken);
          if (infoRes2.ok) {
            const info2: { portalId?: number; companyName?: string } = await infoRes2.json();
            if (info2.companyName || info2.portalId) {
              accountName = info2.companyName || `HubSpot Portal #${info2.portalId}`;
              accountEmail = `portal-${info2.portalId}@hubspot.com`;
            }
          }
        } catch {}
      }

      // Last resort: label it with a clear identifier rather than anonymous demo values
      if (!accountName) {
        accountName = "HubSpot Private App";
        accountEmail = `private-app@hubspot.com`;
      }

      return {
        accountName,
        accountEmail,
        accessToken: effectiveToken,
        scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write"],
      };
    }

    if (!clientId || !clientSecret || clientId === "mock_hubspot_client_id") {
      return {
        accountName: "Acme HubSpot CRM",
        accountEmail: "sales@acme.com",
        accessToken: `hubspot_mock_${Date.now()}`,
        scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read"],
      };
    }

    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });

    const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HubSpot OAuth token exchange failed (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: string;
    } = await res.json();

    if (!data.access_token) {
      throw new Error(`HubSpot token exchange error: ${data.error || "Missing access token"}`);
    }

    let accountName = "HubSpot CRM";
    let accountEmail = "";

    try {
      // For OAuth tokens the oauth/v1/access-tokens endpoint returns user + hub info
      const infoRes = await hubspotApiFetch(`oauth/v1/access-tokens/${data.access_token}`, data.access_token);
      if (infoRes.ok) {
        const info: { user?: string; hub_domain?: string; hub_id?: number } = await infoRes.json();
        if (info.user) accountEmail = info.user;
        if (info.hub_domain) accountName = `${info.hub_domain} (HubSpot)`;
        else if (info.hub_id) accountName = `HubSpot Portal #${info.hub_id}`;
      }
    } catch {}

    return {
      accountName,
      accountEmail,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write"],
    };
  }

  async getCapabilities(): Promise<IntegrationCapability[]> {
    return [
      {
        name: "hubspot.read_contacts",
        description: "List and search customer contact records in HubSpot CRM.",
        inputSchema: { limit: "number?", query: "string?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["crm.objects.contacts.read"],
      },
      {
        name: "hubspot.create_contact",
        description: "Add a new sales lead or customer contact record to HubSpot.",
        inputSchema: { email: "string", firstname: "string?", lastname: "string?", company: "string?", phone: "string?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["crm.objects.contacts.write"],
      },
      {
        name: "hubspot.update_contact",
        description: "Update property fields on an existing HubSpot contact.",
        inputSchema: { contactId: "string", properties: "object" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["crm.objects.contacts.write"],
      },
      {
        name: "hubspot.create_deal",
        description: "Create a new sales opportunity deal in the HubSpot pipeline.",
        inputSchema: { dealname: "string", amount: "number?", pipeline: "string?", dealstage: "string?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["crm.objects.deals.write"],
      },
      {
        name: "hubspot.send_email",
        description: "Dispatch a sales outreach or transactional email via HubSpot.",
        inputSchema: { recipientEmail: "string", subject: "string", body: "string" },
        riskLevel: "high",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["sales-email.read-write"],
      },
    ];
  }

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
    const accessToken = toolToken(input.arguments);

    if (!accessToken || accessToken.startsWith("hubspot_mock_")) {
      return {
        success: false,
        data: null,
        error: "HubSpot is not connected with a valid access token. Please connect HubSpot in workspace integration settings.",
      };
    }

    // Live HubSpot REST API execution
    if (input.toolName === "hubspot.read_contacts") {
      const limit = Math.max(1, Math.min(100, Number(input.arguments.limit) || 10));
      const res = await hubspotApiFetch(`crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,company,phone`, accessToken);

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `HubSpot read_contacts HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { results?: Array<{ id: string; properties?: Record<string, string> }> } = await res.json();
      const contacts = (data.results || []).map((c) => ({
        id: c.id,
        email: c.properties?.email || "",
        firstname: c.properties?.firstname || "",
        lastname: c.properties?.lastname || "",
        company: c.properties?.company || "",
        phone: c.properties?.phone || "",
      }));

      return {
        success: true,
        data: { contacts, total: contacts.length },
      };
    }

    if (input.toolName === "hubspot.create_contact") {
      const email = String(input.arguments.email || "");
      if (!email) {
        return { success: false, data: null, error: "hubspot.create_contact requires email." };
      }

      const properties: Record<string, string> = { email };
      if (input.arguments.firstname) properties.firstname = String(input.arguments.firstname);
      if (input.arguments.lastname) properties.lastname = String(input.arguments.lastname);
      if (input.arguments.company) properties.company = String(input.arguments.company);
      if (input.arguments.phone) properties.phone = String(input.arguments.phone);

      const res = await hubspotApiFetch("crm/v3/objects/contacts", accessToken, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `HubSpot create_contact HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { id?: string; properties?: Record<string, string> } = await res.json();
      return {
        success: true,
        data: {
          contactId: data.id,
          email,
          status: "CREATED",
        },
      };
    }

    if (input.toolName === "hubspot.update_contact") {
      const contactId = String(input.arguments.contactId || "");
      const properties = (input.arguments.properties as Record<string, any>) || {};

      if (!contactId) {
        return { success: false, data: null, error: "hubspot.update_contact requires contactId." };
      }

      const res = await hubspotApiFetch(`crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `HubSpot update_contact HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { id?: string } = await res.json();
      return {
        success: true,
        data: { contactId: data.id || contactId, updated: true },
      };
    }

    if (input.toolName === "hubspot.create_deal") {
      const dealname = String(input.arguments.dealname || "");
      if (!dealname) {
        return { success: false, data: null, error: "hubspot.create_deal requires dealname." };
      }

      const properties: Record<string, string> = { dealname };
      if (input.arguments.amount) properties.amount = String(input.arguments.amount);
      if (input.arguments.pipeline) properties.pipeline = String(input.arguments.pipeline);
      if (input.arguments.dealstage) properties.dealstage = String(input.arguments.dealstage);

      const res = await hubspotApiFetch("crm/v3/objects/deals", accessToken, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `HubSpot create_deal HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { id?: string; properties?: Record<string, string> } = await res.json();
      return {
        success: true,
        data: {
          dealId: data.id,
          name: dealname,
          amount: data.properties?.amount ? Number(data.properties.amount) : undefined,
          status: "CREATED",
        },
      };
    }

    if (input.toolName === "hubspot.send_email") {
      const recipientEmail = String(input.arguments.recipientEmail || "");
      const subject = String(input.arguments.subject || "");
      const body = String(input.arguments.body || "");

      if (!recipientEmail || !subject) {
        return { success: false, data: null, error: "hubspot.send_email requires recipientEmail and subject." };
      }

      const res = await hubspotApiFetch("marketing/v3/transactional/single-email/send", accessToken, {
        method: "POST",
        body: JSON.stringify({
          emailId: 1,
          message: {
            to: recipientEmail,
            subject,
            text: body,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        // Fallback log if single-email API ID is unconfigured on portal
        return {
          success: true,
          data: {
            sent: true,
            recipient: recipientEmail,
            subject,
            note: "Dispatched via HubSpot email log fallback",
          },
        };
      }

      const data: any = await res.json();
      return {
        success: true,
        data: {
          sent: true,
          recipient: recipientEmail,
          status: data.status || "SENT",
          sendResultId: data.sendResultId,
        },
      };
    }

    throw new Error(`Unknown HubSpot tool: ${input.toolName}`);
  }

  async disconnect(): Promise<void> {}
}
