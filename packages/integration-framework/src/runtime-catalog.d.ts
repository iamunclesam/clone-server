/**
 * Integration Capability Registry
 *
 * Each provider declares its events and actions independently of any Clone.
 * The RuntimeCompiler combines this with Clone identity + permissions to derive
 * what a specific Clone should actually react to and what it can do.
 *
 * Rule: nothing here is Clone-specific. This is pure capability declaration.
 */
export type RuntimeTriggerKind = "EVENT" | "CRON" | "INTERVAL" | "DEADLINE" | "CONDITION" | "MANUAL";
export type RuntimeActionDef = {
    /** Unique dotted ID: "provider.action_name" */
    id: string;
    provider: string;
    name: string;
    description: string;
    /** true = modifies state (create, update, send, deploy, delete) */
    write: boolean;
    /** true = requires human approval before execution */
    requiresApproval: boolean;
    /** Optional risk classification */
    riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    /** Roles/keywords for which this action is typically relevant */
    relevance?: string[];
};
export type RuntimeEventDef = {
    /** Unique dotted ID: "provider.event_name" */
    id: string;
    provider: string;
    name: string;
    description: string;
    /**
     * Keywords matched against Clone identity (role + name + responsibilities).
     * If empty, ALL Clones with the integration receive this event.
     */
    relevance: string[];
    /** Optional severity hint */
    severity?: "INFO" | "WARNING" | "CRITICAL";
};
export type RuntimeIntegrationManifest = {
    provider: string;
    name: string;
    description: string;
    category: "engineering" | "communication" | "productivity" | "monitoring" | "deployment" | "design" | "crm" | "finance";
    events: RuntimeEventDef[];
    actions: RuntimeActionDef[];
};
export declare const RUNTIME_INTEGRATIONS: RuntimeIntegrationManifest[];
export declare function getRuntimeManifest(provider: string): RuntimeIntegrationManifest | undefined;
export declare function listRuntimeActions(provider: string): RuntimeActionDef[];
export declare function listRuntimeEvents(provider: string): RuntimeEventDef[];
export declare function findRuntimeEvent(eventId: string): RuntimeEventDef | undefined;
export declare function findRuntimeAction(actionId: string): RuntimeActionDef | undefined;
/** All unique providers that have registered events */
export declare function getAllProviders(): string[];
/**
 * Find all events that could be relevant to a given identity string.
 * The identity string is: role + name + responsibilities lowercased and joined.
 * This is used for "broad" initial matching before permission checks.
 */
export declare function findRelevantEvents(providers: string[], identityText: string): RuntimeEventDef[];
/**
 * Find all actions available for a given set of providers.
 * Permission checks (read-only vs write) happen in the RuntimeCompiler.
 */
export declare function findAvailableActions(providers: string[]): RuntimeActionDef[];
/**
 * Get all CRITICAL-severity events across all providers.
 * Used for escalation routing.
 */
export declare function getCriticalEvents(): RuntimeEventDef[];
//# sourceMappingURL=runtime-catalog.d.ts.map