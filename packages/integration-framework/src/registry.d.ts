import { IntegrationProvider } from "./types";
export declare class IntegrationRegistry {
    private static instance;
    private providers;
    private constructor();
    static getInstance(): IntegrationRegistry;
    registerProvider(provider: IntegrationProvider): void;
    getProvider(providerId: string): IntegrationProvider | undefined;
    getAllProviders(): IntegrationProvider[];
}
//# sourceMappingURL=registry.d.ts.map