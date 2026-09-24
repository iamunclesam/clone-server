/**
 * Memory Connector
 *
 * Bridges runtime execution results to persistent EmployeeMemory.
 *
 * After each execution completes, the runtime calls extractAndStore() to
 * determine what — if anything — deserves to be remembered permanently.
 *
 * What gets stored:
 *   DECISION   — a significant choice was made (deployed, delegated, escalated)
 *   EXPERIENCE — a task was completed or failed; the outcome is worth remembering
 *   PREFERENCE — a pattern emerged from how work was handled
 *   PROCEDURE  — a step-by-step approach that worked well
 *   FAILURE    — what went wrong and why (so it isn't repeated)
 *
 * What does NOT get stored:
 *   - Routine read operations with no meaningful outcome
 *   - Duplicate information already in memory
 *   - Intermediate planning steps
 *   - Transient tool call results
 *
 * Memory is scoped per Clone and per Company.
 * A Clone CANNOT read another Clone's memory without explicit permission.
 */
export type MemoryCategory = "DECISION" | "EXPERIENCE" | "PREFERENCE" | "PROCEDURE" | "FAILURE" | "COMMITMENT" | "RELATIONSHIP";
export type ExtractedMemory = {
    key: string;
    content: string;
    category: MemoryCategory;
    confidence: number;
    source: string;
};
export type MemoryStoreResult = {
    stored: number;
    skipped: number;
    memories: Array<{
        id: string;
        key: string;
        category: string;
    }>;
};
export declare class MemoryConnector {
    /**
     * Analyse a completed execution and persist noteworthy memories.
     */
    extractAndStore(input: {
        companyId: string;
        cloneId: string;
        executionId: string;
        triggerSource: string;
        status: string;
        result?: unknown;
        error?: string;
        stepLog?: any[];
        planText?: string;
    }): Promise<MemoryStoreResult>;
    /**
     * Extract candidate memories from an execution record.
     * This is deterministic rule-based extraction — not LLM-dependent.
     */
    private extractMemories;
    /**
     * Store a memory record directly (bypasses extraction logic).
     * Used for explicit "remember this" calls from the engine.
     */
    storeMemory(input: {
        companyId: string;
        cloneId: string;
        key: string;
        content: string;
        category: MemoryCategory;
        confidence?: number;
        source?: string;
    }): Promise<any>;
    /**
     * Load relevant memories for an execution context.
     * Searches by Clone + company; returns most recent records matching the query.
     */
    loadRelevantMemories(input: {
        companyId: string;
        cloneId: string;
        query: string;
        limit?: number;
    }): Promise<any[]>;
}
//# sourceMappingURL=memory-connector.d.ts.map