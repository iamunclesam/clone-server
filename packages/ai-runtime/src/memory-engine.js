"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryEngine = void 0;
class MemoryEngine {
    inMemoryStore = [
        {
            id: "mem_1",
            companyId: "acme",
            scope: "COMPANY",
            key: "company_mission",
            content: "Acme Corp builds enterprise SaaS products with 99.9% uptime SLA.",
            confidence: 1.0,
            source: "onboarding",
            createdAt: new Date(),
        },
        {
            id: "mem_2",
            companyId: "acme",
            scope: "EMPLOYEE",
            key: "cto_standards",
            content: "All PRs must include unit tests and receive explicit founder approval before merging.",
            confidence: 0.95,
            source: "founder_guideline",
            createdAt: new Date(),
        },
    ];
    async searchMemories(query) {
        return this.inMemoryStore.filter((m) => {
            if (m.companyId !== query.companyId)
                return false;
            if (query.scope && m.scope !== query.scope)
                return false;
            if (query.employeeId && m.employeeId && m.employeeId !== query.employeeId)
                return false;
            return true;
        }).slice(0, query.limit || 5);
    }
    async storeMemory(record) {
        const newRecord = {
            ...record,
            id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            createdAt: new Date(),
        };
        this.inMemoryStore.push(newRecord);
        return newRecord;
    }
    async deleteMemory(memoryId, companyId) {
        const idx = this.inMemoryStore.findIndex((m) => m.id === memoryId && m.companyId === companyId);
        if (idx !== -1) {
            this.inMemoryStore.splice(idx, 1);
            return true;
        }
        return false;
    }
}
exports.MemoryEngine = MemoryEngine;
//# sourceMappingURL=memory-engine.js.map