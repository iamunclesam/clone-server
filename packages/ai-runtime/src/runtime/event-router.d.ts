/**
 * Event Router
 *
 * Receives inbound runtime events (from webhooks, polling, or internal signals)
 * and routes them to the relevant Clones based on:
 *   1. Is the integration connected to this company?
 *   2. Does the Clone have this provider assigned?
 *   3. Does the Clone's compiled runtime list this event as relevant?
 *   4. Is the event deduplicated?
 *
 * Rule: do NOT wake every Clone for every company event.
 * Only wake Clones for whom the event is provably relevant.
 *
 * Flow:
 *   inbound event
 *     → validate
 *     → deduplicate (deduplicationKey in DB)
 *     → find company's connected providers
 *     → find all Clones with compiled runtimes
 *     → filter by relevance
 *     → for each relevant Clone: create RuntimeExecution (QUEUED)
 *     → mark RuntimeEvent as processed
 *     → return list of queued executions
 */
export type InboundEvent = {
    companyId: string;
    source: string;
    eventType: string;
    payload: Record<string, unknown>;
    /** Optional deduplication key — prevents processing the same event twice */
    deduplicationKey?: string;
};
export type RoutedExecution = {
    cloneId: string;
    cloneName: string;
    cloneRole: string;
    executionId: string;
    eventId: string;
    reason: string;
};
export type RouteResult = {
    eventId: string;
    deduplicated: boolean;
    routedTo: RoutedExecution[];
    skippedClones: number;
};
export declare class EventRouter {
    /**
     * Route an inbound event through the full pipeline.
     * Returns the list of executions that were created and queued.
     */
    routeEvent(inbound: InboundEvent): Promise<RouteResult>;
    /**
     * Determine whether a specific Clone should react to an event.
     * Used for single-clone relevance checks without routing the full event.
     */
    isRelevantForClone(cloneId: string, companyId: string, canonicalEventId: string): Promise<{
        relevant: boolean;
        reason: string;
    }>;
    /**
     * Get unprocessed events for a company (useful for catch-up processing).
     */
    getPendingEvents(companyId: string, limit?: number): Promise<any[]>;
}
//# sourceMappingURL=event-router.d.ts.map