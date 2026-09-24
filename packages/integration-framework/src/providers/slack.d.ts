import { IntegrationProvider, IntegrationCapability } from "../types";
export declare class SlackIntegrationProvider implements IntegrationProvider {
    providerId: string;
    name: string;
    description: string;
    category: "Communication";
    getAuthorizationUrl(input: {
        companyId: string;
        userId: string;
        redirectUri: string;
        state: string;
    }): Promise<string>;
    handleCallback(): Promise<{
        accountName: string;
        accountEmail: string;
        accessToken: string;
        scopes: string[];
    }>;
    getCapabilities(): Promise<IntegrationCapability[]>;
    executeTool(input: {
        toolName: string;
        arguments: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        data: {
            channel: unknown;
            messages: {
                user: string;
                text: string;
                ts: string;
            }[];
            posted?: undefined;
            ts?: undefined;
        };
    } | {
        success: boolean;
        data: {
            posted: boolean;
            ts: string;
            channel: unknown;
            messages?: undefined;
        };
    }>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=slack.d.ts.map