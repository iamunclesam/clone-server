import { IntegrationProvider, IntegrationCapability } from "../types";

interface ParsedGoogleCreds {
  clientId: string;
  clientSecret: string;
  source: "env" | "client_secret_json";
}

function parseGoogleCalendarOAuthCreds(): ParsedGoogleCreds {
  const rawClientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON || process.env.GOOGLE_CLIENT_SECRET_JSON || "";
  if (rawClientJson) {
    try {
      const json = JSON.parse(rawClientJson);
      const web = json.web || json.installed || json.desktop;
      if (web && web.client_id && web.client_secret) {
        return {
          clientId: String(web.client_id),
          clientSecret: String(web.client_secret),
          source: "client_secret_json",
        };
      }
    } catch {}
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return { clientId, clientSecret, source: "env" };
}

function toolToken(args: Record<string, unknown>): string {
  return String(args?.accessToken || process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || "").trim();
}

async function calendarApiFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://www.googleapis.com/calendar/v3/${endpoint.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(url, { ...options, headers });
}

export class GoogleCalendarIntegrationProvider implements IntegrationProvider {
  providerId = "calendar";
  name = "Google Calendar";
  description = "Executive meeting scheduling, calendar sync, and availability checking.";
  category = "Productivity" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const creds = parseGoogleCalendarOAuthCreds();
    const effectiveClientId = creds.clientId || "mock_google_calendar_client_id";

    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    const params = new URLSearchParams({
      client_id: effectiveClientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: scopes,
      state: input.state,
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(input: { code: string; state: string; redirectUri: string }): Promise<{
    accountName: string;
    accountEmail?: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
  }> {
    const creds = parseGoogleCalendarOAuthCreds();

    if (!creds.clientId || creds.clientId === "mock_google_calendar_client_id") {
      return {
        accountName: "Google Calendar Workspace",
        accountEmail: "calendar@acme.com",
        accessToken: `calendar_mock_${Date.now()}`,
        scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
      };
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Google Calendar token exchange failed (${tokenRes.status}): ${errBody.slice(0, 300)}`);
    }

    const tokenData: { access_token: string; refresh_token?: string; scope?: string } = await tokenRes.json();

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let accountName = "Google Calendar";
    let accountEmail = "calendar@google.com";

    if (profileRes.ok) {
      const profile: { name?: string; email?: string } = await profileRes.json();
      accountName = profile.name ? `${profile.name}'s Calendar` : accountName;
      accountEmail = profile.email || accountEmail;
    }

    return {
      accountName,
      accountEmail,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      scopes: (tokenData.scope || "https://www.googleapis.com/auth/calendar").split(" ").filter(Boolean),
    };
  }

  async getCapabilities(): Promise<IntegrationCapability[]> {
    return [
      {
        name: "calendar.read_events",
        description: "Read upcoming calendar events and executive availability.",
        inputSchema: { calendarId: "string?", maxResults: "number?", timeMin: "string?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/calendar"],
      },
      {
        name: "calendar.create_event",
        description: "Schedule a new meeting or event on Google Calendar.",
        inputSchema: { summary: "string", startTime: "string", endTime: "string", description: "string?", attendees: "array?" },
        riskLevel: "medium",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
      },
      {
        name: "calendar.update_event",
        description: "Update details or time of an existing Google Calendar event.",
        inputSchema: { eventId: "string", summary: "string?", startTime: "string?", endTime: "string?", description: "string?" },
        riskLevel: "medium",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
      },
      {
        name: "calendar.delete_event",
        description: "Remove or cancel an event from Google Calendar.",
        inputSchema: { eventId: "string", calendarId: "string?" },
        riskLevel: "high",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
      },
    ];
  }

  async executeTool(input: { toolName: string; arguments: Record<string, unknown> }) {
    const accessToken = toolToken(input.arguments);

    if (!accessToken || accessToken.startsWith("calendar_mock_")) {
      return {
        success: false,
        data: null,
        error: "Google Calendar is not connected with a valid access token. Please connect Google Calendar in workspace integration settings.",
      };
    }

    // Live Google Calendar API v3 execution
    const calendarId = String(input.arguments.calendarId || "primary");

    if (input.toolName === "calendar.read_events") {
      const maxResults = Math.max(1, Math.min(50, Number(input.arguments.maxResults) || 10));
      const timeMin = input.arguments.timeMin ? String(input.arguments.timeMin) : new Date().toISOString();

      const res = await calendarApiFetch(
        `calendars/${encodeURIComponent(calendarId)}/events?maxResults=${maxResults}&timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime`,
        accessToken
      );

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Google Calendar read_events HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: { items?: Array<any> } = await res.json();
      const events = (data.items || []).map((e) => ({
        id: e.id,
        summary: e.summary || "(No Title)",
        description: e.description || "",
        location: e.location || "",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        attendees: (e.attendees || []).map((a: any) => a.email).filter(Boolean),
        htmlLink: e.htmlLink,
      }));

      return {
        success: true,
        data: { events, totalCount: events.length },
      };
    }

    if (input.toolName === "calendar.create_event") {
      const summary = String(input.arguments.summary || "New Meeting");
      const startTime = String(input.arguments.startTime || new Date().toISOString());
      const endTime = String(input.arguments.endTime || new Date(Date.now() + 1800000).toISOString());
      const description = input.arguments.description ? String(input.arguments.description) : undefined;
      const attendeesList = Array.isArray(input.arguments.attendees) ? input.arguments.attendees : [];

      const body: Record<string, any> = {
        summary,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: attendeesList.map((email: string) => ({ email })),
      };

      const res = await calendarApiFetch(`calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Google Calendar create_event HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: any = await res.json();
      return {
        success: true,
        data: {
          eventId: data.id,
          summary: data.summary,
          status: data.status,
          htmlLink: data.htmlLink,
        },
      };
    }

    if (input.toolName === "calendar.update_event") {
      const eventId = String(input.arguments.eventId || "");
      if (!eventId) {
        return { success: false, data: null, error: "calendar.update_event requires eventId." };
      }

      const body: Record<string, any> = {};
      if (input.arguments.summary) body.summary = String(input.arguments.summary);
      if (input.arguments.description) body.description = String(input.arguments.description);
      if (input.arguments.startTime) body.start = { dateTime: String(input.arguments.startTime) };
      if (input.arguments.endTime) body.end = { dateTime: String(input.arguments.endTime) };

      const res = await calendarApiFetch(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `Google Calendar update_event HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      const data: any = await res.json();
      return {
        success: true,
        data: { eventId: data.id, updated: true, htmlLink: data.htmlLink },
      };
    }

    if (input.toolName === "calendar.delete_event") {
      const eventId = String(input.arguments.eventId || "");
      if (!eventId) {
        return { success: false, data: null, error: "calendar.delete_event requires eventId." };
      }

      const res = await calendarApiFetch(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, accessToken, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        return { success: false, data: null, error: `Google Calendar delete_event HTTP error (${res.status}): ${errText.slice(0, 300)}` };
      }

      return {
        success: true,
        data: { eventId, deleted: true },
      };
    }

    throw new Error(`Unknown Google Calendar tool: ${input.toolName}`);
  }

  async disconnect(): Promise<void> {}
}
