import { IntegrationProvider, IntegrationCapability } from "../types";
export declare class NotionIntegrationProvider implements IntegrationProvider {
    providerId: string;
    name: string;
    description: string;
    category: "Productivity";
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
            results: {
                id: string;
                title: string;
                url: string;
            }[];
            pageId?: undefined;
            title?: undefined;
            status?: undefined;
        };
    } | {
        success: boolean;
        data: {
            pageId: string;
            title: unknown;
            status: string;
            results?: undefined;
        };
    }>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=notion.d.ts.map