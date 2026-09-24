import { IntegrationProvider, IntegrationCapability } from "../types";
export declare class LinearIntegrationProvider implements IntegrationProvider {
    providerId: string;
    name: string;
    description: string;
    category: "Project management";
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
            issueId: string;
            identifier: string;
            url: string;
            title: unknown;
            status?: undefined;
            updated?: undefined;
        };
    } | {
        success: boolean;
        data: {
            issueId: unknown;
            status: unknown;
            updated: boolean;
            identifier?: undefined;
            url?: undefined;
            title?: undefined;
        };
    }>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=linear.d.ts.map