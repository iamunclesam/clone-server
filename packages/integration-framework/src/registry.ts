import { IntegrationProvider } from "./types";
import { GitHubIntegrationProvider } from "./providers/github";
import { SlackIntegrationProvider } from "./providers/slack";
import { GmailIntegrationProvider } from "./providers/gmail";
import { NotionIntegrationProvider } from "./providers/notion";
import { LinearIntegrationProvider } from "./providers/linear";
import { HubSpotIntegrationProvider } from "./providers/hubspot";
import { GoogleCalendarIntegrationProvider } from "./providers/calendar";

export class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private providers: Map<string, IntegrationProvider> = new Map();

  private constructor() {
    this.registerProvider(new GitHubIntegrationProvider());
    this.registerProvider(new SlackIntegrationProvider());
    this.registerProvider(new GmailIntegrationProvider());
    this.registerProvider(new NotionIntegrationProvider());
    this.registerProvider(new LinearIntegrationProvider());
    this.registerProvider(new HubSpotIntegrationProvider());
    this.registerProvider(new GoogleCalendarIntegrationProvider());
  }

  public static getInstance(): IntegrationRegistry {
    if (!IntegrationRegistry.instance) {
      IntegrationRegistry.instance = new IntegrationRegistry();
    }
    return IntegrationRegistry.instance;
  }

  public registerProvider(provider: IntegrationProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  public getProvider(providerId: string): IntegrationProvider | undefined {
    return this.providers.get(providerId);
  }

  public getAllProviders(): IntegrationProvider[] {
    return Array.from(this.providers.values());
  }
}
