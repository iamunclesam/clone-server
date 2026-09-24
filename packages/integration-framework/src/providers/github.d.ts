import { IntegrationProvider, IntegrationCapability } from "../types";
export declare class GitHubIntegrationProvider implements IntegrationProvider {
    providerId: string;
    name: string;
    description: string;
    category: "Engineering";
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
        accountEmail?: string;
        accessToken: string;
        refreshToken?: string;
        scopes: string[];
    }>;
    getCapabilities(_connectionId?: string): Promise<IntegrationCapability[]>;
    executeTool(input: {
        connectionId?: string;
        toolName: string;
        arguments: Record<string, unknown>;
        employeeId?: string;
        companyId?: string;
    }): Promise<{
        success: boolean;
        data: null;
        error: string;
    } | {
        success: boolean;
        data: {
            repositories: {
                fullName: string;
                private: boolean;
                url: string;
                description: string | null;
                defaultBranch: string;
            }[];
            owner?: undefined;
            repo?: undefined;
            files?: undefined;
            path?: undefined;
            branch?: undefined;
            ref?: undefined;
            created?: undefined;
            prNumber?: undefined;
            url?: undefined;
            status?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            owner: string;
            repo: string;
            files: any[];
            path: string;
            repositories?: undefined;
            branch?: undefined;
            ref?: undefined;
            created?: undefined;
            prNumber?: undefined;
            url?: undefined;
            status?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            branch: string;
            ref: string;
            created: boolean;
            repositories?: undefined;
            owner?: undefined;
            repo?: undefined;
            files?: undefined;
            path?: undefined;
            prNumber?: undefined;
            url?: undefined;
            status?: undefined;
        };
        error?: undefined;
    } | {
        success: boolean;
        data: {
            prNumber: number | undefined;
            url: string | undefined;
            status: string;
            repositories?: undefined;
            owner?: undefined;
            repo?: undefined;
            files?: undefined;
            path?: undefined;
            branch?: undefined;
            ref?: undefined;
            created?: undefined;
        };
        error?: undefined;
    }>;
    disconnect(_connectionId?: string): Promise<void>;
}
//# sourceMappingURL=github.d.ts.map