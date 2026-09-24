import { IntegrationProvider, IntegrationCapability } from "../types";
export declare class GmailIntegrationProvider implements IntegrationProvider {
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
    handleCallback(input: {
        code: string;
        state: string;
        redirectUri: string;
    }): Promise<{
        accountName: string;
        accountEmail: string;
        accessToken: string;
        refreshToken?: string;
        scopes: string[];
    }>;
    getCapabilities(): Promise<IntegrationCapability[]>;
    executeTool(input: {
        toolName: string;
        arguments: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        data: null;
        error: string;
    } | {
        success: boolean;
        data: {
            messages: {
                id: string;
                snippet: string;
                from: string;
                subject: string;
                date: string;
            }[];
            totalCount: number;
            freshToken: string | undefined;
            draftId?: undefined;
            status?: undefined;
            messageId?: undefined;
            sent?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            draftId: any;
            status: string;
            freshToken: string | undefined;
            messages?: undefined;
            totalCount?: undefined;
            messageId?: undefined;
            sent?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            messageId: any;
            sent: boolean;
            freshToken: string | undefined;
            messages?: undefined;
            totalCount?: undefined;
            draftId?: undefined;
            status?: undefined;
        };
        error?: undefined;
    }>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=gmail.d.ts.map