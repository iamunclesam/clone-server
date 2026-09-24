"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultCloneConfig = createDefaultCloneConfig;
exports.createDefaultTeamConfig = createDefaultTeamConfig;
/**
 * Creates a clean default Clone AI Employee object based on standard schema without demo data.
 */
function createDefaultCloneConfig(overrides) {
    const now = new Date().toISOString();
    return {
        id: overrides?.id || "",
        name: overrides?.name || "",
        role: overrides?.role || "",
        description: overrides?.description || "",
        identity: {
            personality: "",
            communication_style: "",
            values: [],
            expertise: [],
            instructions: [],
            ...overrides?.identity,
        },
        mission: {
            purpose: "",
            objectives: [],
            success_metrics: [],
            priorities: [],
            ...overrides?.mission,
        },
        scope: {
            responsibilities: [],
            allowed_tasks: [],
            restricted_tasks: [],
            ...overrides?.scope,
        },
        autonomy: {
            level: "supervised",
            can_plan: true,
            can_execute: true,
            can_delegate: true,
            can_make_decisions: true,
            approval_required_for: [],
            ...overrides?.autonomy,
        },
        tools: {
            enabled: [],
            permissions: {},
            credentials: [],
            ...overrides?.tools,
        },
        integrations: overrides?.integrations || [],
        memory: {
            short_term: true,
            long_term: true,
            knowledge_base: [],
            preferences: [],
            decisions: [],
            lessons_learned: [],
            ...overrides?.memory,
        },
        context: {
            company: {},
            product: {},
            customers: {},
            team: {},
            current_state: {},
            ...overrides?.context,
        },
        planning: {
            enabled: true,
            strategy: "hierarchical",
            max_steps: 20,
            replanning_enabled: true,
            ...overrides?.planning,
        },
        tasks: {
            active: [],
            completed: [],
            blocked: [],
            failed: [],
            ...overrides?.tasks,
        },
        delegation: {
            enabled: true,
            available_clones: [],
            delegation_rules: [],
            ...overrides?.delegation,
        },
        communication: {
            channels: [],
            can_send_external_messages: false,
            can_respond_to_users: true,
            ...overrides?.communication,
        },
        execution: {
            environment: {},
            max_runtime: 3600,
            max_cost: 10,
            retry_policy: {},
            ...overrides?.execution,
        },
        guardrails: {
            requires_approval_for: [
                "payments",
                "deletions",
                "production_changes",
                "external_publication",
            ],
            spending_limit: 0,
            data_access: [],
            blocked_actions: [],
            ...overrides?.guardrails,
        },
        progress: {
            current_task: null,
            completion_percentage: 0,
            milestones: [],
            artifacts: [],
            evidence: [],
            ...overrides?.progress,
        },
        observability: {
            activity_log: true,
            tool_logs: true,
            decision_logs: true,
            cost_tracking: true,
            performance_metrics: true,
            ...overrides?.observability,
        },
        model: {
            provider: "anthropic",
            model: "",
            temperature: 0.2,
            ...overrides?.model,
        },
        status: overrides?.status || "active",
        created_at: overrides?.created_at || now,
        updated_at: overrides?.updated_at || now,
    };
}
/**
 * Creates a clean default Clone AI Team object based on standard schema without demo data.
 */
function createDefaultTeamConfig(overrides) {
    const now = new Date().toISOString();
    return {
        id: overrides?.id || "",
        name: overrides?.name || "",
        description: overrides?.description || "",
        mission: {
            purpose: "",
            objectives: [],
            success_metrics: [],
            priorities: [],
            ...overrides?.mission,
        },
        members: overrides?.members || [],
        lead: {
            clone_id: "",
            ...overrides?.lead,
        },
        hierarchy: {
            enabled: true,
            manager: "",
            reporting_lines: [],
            ...overrides?.hierarchy,
        },
        responsibilities: overrides?.responsibilities || [],
        workflows: overrides?.workflows || [],
        communication: {
            enabled: true,
            channels: [],
            shared_context: true,
            cross_clone_messaging: true,
            ...overrides?.communication,
        },
        collaboration: {
            shared_memory: true,
            shared_tasks: true,
            shared_documents: true,
            delegation_enabled: true,
            ...overrides?.collaboration,
        },
        tasks: {
            active: [],
            completed: [],
            blocked: [],
            failed: [],
            ...overrides?.tasks,
        },
        integrations: overrides?.integrations || [],
        permissions: {
            shared: [],
            role_based: {},
            approval_required_for: [],
            ...overrides?.permissions,
        },
        memory: {
            shared: true,
            knowledge_base: [],
            decisions: [],
            lessons_learned: [],
            ...overrides?.memory,
        },
        progress: {
            completion_percentage: 0,
            milestones: [],
            metrics: [],
            artifacts: [],
            ...overrides?.progress,
        },
        guardrails: {
            spending_limit: 0,
            restricted_actions: [],
            requires_human_approval: [],
            ...overrides?.guardrails,
        },
        observability: {
            activity_log: true,
            decision_log: true,
            tool_logs: true,
            cost_tracking: true,
            ...overrides?.observability,
        },
        status: overrides?.status || "active",
        created_at: overrides?.created_at || now,
        updated_at: overrides?.updated_at || now,
    };
}
//# sourceMappingURL=cloneConfig.js.map