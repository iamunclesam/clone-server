import { MemoryScope } from "@prisma/client";
export interface MemoryQuery {
    companyId: string;
    employeeId?: string;
    scope?: MemoryScope;
    scopeId?: string;
    query: string;
    limit?: number;
}
export interface MemoryRecord {
    id: string;
    companyId: string;
    employeeId?: string;
    scope: MemoryScope;
    key: string;
    content: string;
    confidence: number;
    source: string;
    createdAt: Date;
}
export declare class MemoryEngine {
    private inMemoryStore;
    searchMemories(query: MemoryQuery): Promise<MemoryRecord[]>;
    storeMemory(record: Omit<MemoryRecord, "id" | "createdAt">): Promise<MemoryRecord>;
    deleteMemory(memoryId: string, companyId: string): Promise<boolean>;
}
//# sourceMappingURL=memory-engine.d.ts.map