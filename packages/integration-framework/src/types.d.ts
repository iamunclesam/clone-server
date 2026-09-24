export type RiskLevel = "low" | "medium" | "high" | "critical";
export type IntegrationCapability = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    riskLevel: RiskLevel;
    requiresApproval: boolean;
    readOnly: boolean;
    requiredScopes: string[];
};
export type ConnectedAccount = {
    id: string;
    companyId: string;
    provider: string;
    accountName: string;
    accountEmail?: string;
    scopes: string[];
    status: "CONNECTED" | "DISCONNECTED" | "ERROR";
    connectedAt: Date;
};
export interface IntegrationProvider {
    providerId: string;
    name: string;
    description: string;
    category: "Communication" | "Engineering" | "Productivity" | "CRM" | "Finance" | "Storage" | "Analytics" | "Customer support" | "Project management" | "Cloud infrastructure";
    iconUrl?: string;
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
    getCapabilities(connectionId: string): Promise<IntegrationCapability[]>;
    executeTool(input: {
        connectionId: string;
        toolName: string;
        arguments: Record<string, unknown>;
        employeeId: string;
        companyId: string;
    }): Promise<{
        success: boolean;
        data: unknown;
        error?: string;
    }>;
    subscribeToEvents?(input: {
        connectionId: string;
        events: string[];
        webhookUrl: string;
    }): Promise<void>;
    disconnect(connectionId: string): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map