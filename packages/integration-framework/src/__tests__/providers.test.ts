import { describe, it, expect } from "vitest";
import { IntegrationRegistry } from "../registry";
import { SlackIntegrationProvider } from "../providers/slack";
import { NotionIntegrationProvider } from "../providers/notion";
import { HubSpotIntegrationProvider } from "../providers/hubspot";
import { GoogleCalendarIntegrationProvider } from "../providers/calendar";

describe("Slack, Notion, HubSpot, and Google Calendar Integration Providers", () => {
  const registry = IntegrationRegistry.getInstance();

  it("should have registered all 7 core providers in the registry", () => {
    const providers = registry.getAllProviders();
    const providerIds = providers.map((p) => p.providerId);
    expect(providerIds).toContain("github");
    expect(providerIds).toContain("slack");
    expect(providerIds).toContain("gmail");
    expect(providerIds).toContain("notion");
    expect(providerIds).toContain("linear");
    expect(providerIds).toContain("hubspot");
    expect(providerIds).toContain("calendar");
  });

  describe("Slack Integration Provider", () => {
    const slack = new SlackIntegrationProvider();

    it("should generate OAuth authorization URL", async () => {
      const url = await slack.getAuthorizationUrl({
        companyId: "comp_1",
        userId: "user_1",
        redirectUri: "http://localhost:4000/api/v1/integrations/slack/callback",
        state: "state_123",
      });
      expect(url).toContain("https://slack.com/oauth/v2/authorize");
      expect(url).toContain("state_123");
      expect(url).toContain("chat%3Awrite");
    });

    it("should handle OAuth callback and return token details", async () => {
      const res = await slack.handleCallback({
        code: "mock_code",
        state: "state_123",
        redirectUri: "http://localhost:4000/api/v1/integrations/slack/callback",
      });
      expect(res.accessToken).toBeDefined();
      expect(res.accountName).toContain("Workspace");
      expect(res.scopes.length).toBeGreaterThan(0);
    });

    it("should declare capabilities with risk levels", async () => {
      const caps = await slack.getCapabilities();
      expect(caps.map((c) => c.name)).toEqual([
        "slack.read_channel",
        "slack.send_message",
        "slack.send_dm",
        "slack.list_channels",
        "slack.create_channel",
      ]);
    });

    it("should execute slack.read_channel and slack.send_message tools", async () => {
      const readRes = await slack.executeTool({
        toolName: "slack.read_channel",
        arguments: { channelId: "C123" },
      });
      expect(readRes.success).toBe(true);
      expect((readRes.data as any).messages).toBeDefined();

      const sendRes = await slack.executeTool({
        toolName: "slack.send_message",
        arguments: { channel: "C123", text: "Hello from AI Clone!" },
      });
      expect(sendRes.success).toBe(true);
      expect((sendRes.data as any).posted).toBe(true);
    });
  });

  describe("Notion Integration Provider", () => {
    const notion = new NotionIntegrationProvider();

    it("should generate OAuth authorization URL", async () => {
      const url = await notion.getAuthorizationUrl({
        companyId: "comp_1",
        userId: "user_1",
        redirectUri: "http://localhost:4000/api/v1/integrations/notion/callback",
        state: "state_456",
      });
      expect(url).toContain("https://api.notion.com/v1/oauth/authorize");
      expect(url).toContain("state_456");
    });

    it("should declare search, read_page, create_page, update_page capabilities", async () => {
      const caps = await notion.getCapabilities();
      const capNames = caps.map((c) => c.name);
      expect(capNames).toContain("notion.search_pages");
      expect(capNames).toContain("notion.read_page");
      expect(capNames).toContain("notion.create_page");
      expect(capNames).toContain("notion.create_database_item");
    });

    it("should execute notion.search_pages and notion.create_page tools", async () => {
      const searchRes = await notion.executeTool({
        toolName: "notion.search_pages",
        arguments: { query: "Architecture" },
      });
      expect(searchRes.success).toBe(true);
      expect((searchRes.data as any).results.length).toBeGreaterThan(0);

      const createRes = await notion.executeTool({
        toolName: "notion.create_page",
        arguments: { parentId: "parent_123", title: "API Docs Guidelines" },
      });
      expect(createRes.success).toBe(true);
      expect((createRes.data as any).title).toBe("API Docs Guidelines");
    });
  });

  describe("HubSpot Integration Provider", () => {
    const hubspot = new HubSpotIntegrationProvider();

    it("should generate OAuth authorization URL with CRM scopes", async () => {
      const url = await hubspot.getAuthorizationUrl({
        companyId: "comp_1",
        userId: "user_1",
        redirectUri: "http://localhost:4000/api/v1/integrations/hubspot/callback",
        state: "state_789",
      });
      expect(url).toContain("https://app.hubspot.com/oauth/authorize");
      expect(url).toContain("crm.objects.contacts.read");
      expect(url).toContain("state_789");
    });

    it("should declare CRM capabilities", async () => {
      const caps = await hubspot.getCapabilities();
      const names = caps.map((c) => c.name);
      expect(names).toEqual([
        "hubspot.read_contacts",
        "hubspot.create_contact",
        "hubspot.update_contact",
        "hubspot.create_deal",
        "hubspot.send_email",
      ]);
    });

    it("should execute hubspot.read_contacts, hubspot.create_contact, and hubspot.create_deal", async () => {
      const readRes = await hubspot.executeTool({
        toolName: "hubspot.read_contacts",
        arguments: { limit: 5 },
      });
      expect(readRes.success).toBe(true);
      expect((readRes.data as any).contacts.length).toBeGreaterThan(0);

      const createContactRes = await hubspot.executeTool({
        toolName: "hubspot.create_contact",
        arguments: { email: "alex@enterprise.com", firstname: "Alex", lastname: "Vance", company: "Acme" },
      });
      expect(createContactRes.success).toBe(true);
      expect((createContactRes.data as any).email).toBe("alex@enterprise.com");

      const createDealRes = await hubspot.executeTool({
        toolName: "hubspot.create_deal",
        arguments: { dealname: "Enterprise SLA Contract", amount: 50000 },
      });
      expect(createDealRes.success).toBe(true);
      expect((createDealRes.data as any).name).toBe("Enterprise SLA Contract");
    });
  });

  describe("Google Calendar Integration Provider", () => {
    const calendar = new GoogleCalendarIntegrationProvider();

    it("should generate OAuth authorization URL with Calendar scopes", async () => {
      const url = await calendar.getAuthorizationUrl({
        companyId: "comp_1",
        userId: "user_1",
        redirectUri: "http://localhost:4000/api/v1/integrations/calendar/callback",
        state: "state_cal",
      });
      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("calendar");
      expect(url).toContain("state_cal");
    });

    it("should declare calendar capabilities", async () => {
      const caps = await calendar.getCapabilities();
      const names = caps.map((c) => c.name);
      expect(names).toEqual([
        "calendar.read_events",
        "calendar.create_event",
        "calendar.update_event",
        "calendar.delete_event",
      ]);
    });

    it("should execute calendar.read_events and calendar.create_event tools", async () => {
      const readRes = await calendar.executeTool({
        toolName: "calendar.read_events",
        arguments: { maxResults: 5 },
      });
      expect(readRes.success).toBe(true);
      expect((readRes.data as any).events.length).toBeGreaterThan(0);

      const createRes = await calendar.executeTool({
        toolName: "calendar.create_event",
        arguments: {
          summary: "Q4 Roadmap Strategy Sync",
          startTime: "2026-10-01T10:00:00Z",
          endTime: "2026-10-01T11:00:00Z",
        },
      });
      expect(createRes.success).toBe(true);
      expect((createRes.data as any).summary).toBe("Q4 Roadmap Strategy Sync");
    });
  });
});
