export interface AIEmployeeIdentity {
    personality?: string;
    communication_style?: string;
    values?: string[];
    expertise?: string[];
    instructions?: string[];
}
export interface AIEmployeeMission {
    purpose?: string;
    objectives?: string[];
    success_metrics?: string[];
    priorities?: string[];
}
export interface AIEmployeeScope {
    responsibilities?: string[];
    allowed_tasks?: string[];
    restricted_tasks?: string[];
}
export interface AIEmployeeAutonomy {
    level?: string;
    can_plan?: boolean;
    can_execute?: boolean;
    can_delegate?: boolean;
    can_make_decisions?: boolean;
    approval_required_for?: string[];
}
export interface AIEmployeeToolsConfig {
    enabled?: string[];
    permissions?: Record<string, any>;
    credentials?: any[];
}
export interface AIEmployeeMemoryConfig {
    short_term?: boolean;
    long_term?: boolean;
    knowledge_base?: any[];
    preferences?: any[];
    decisions?: any[];
    lessons_learned?: any[];
}
export interface AIEmployeeContextConfig {
    company?: Record<string, any>;
    product?: Record<string, any>;
    customers?: Record<string, any>;
    team?: Record<string, any>;
    current_state?: Record<string, any>;
}
export interface AIEmployeePlanningConfig {
    enabled?: boolean;
    strategy?: string;
    max_steps?: number;
    replanning_enabled?: boolean;
}
export interface AIEmployeeTasksConfig {
    active?: any[];
    completed?: any[];
    blocked?: any[];
    failed?: any[];
}
export interface AIEmployeeDelegationConfig {
    enabled?: boolean;
    available_clones?: string[];
    delegation_rules?: any[];
}
export interface AIEmployeeCommunicationConfig {
    channels?: string[];
    can_send_external_messages?: boolean;
    can_respond_to_users?: boolean;
}
export interface AIEmployeeExecutionConfig {
    environment?: Record<string, any>;
    max_runtime?: number;
    max_cost?: number;
    retry_policy?: Record<string, any>;
}
export interface AIEmployeeGuardrailsConfig {
    requires_approval_for?: string[];
    spending_limit?: number;
    data_access?: string[];
    blocked_actions?: string[];
}
export interface AIEmployeeProgressConfig {
    current_task?: string | null;
    completion_percentage?: number;
    milestones?: any[];
    artifacts?: any[];
    evidence?: any[];
}
export interface AIEmployeeObservabilityConfig {
    activity_log?: boolean;
    tool_logs?: boolean;
    decision_logs?: boolean;
    cost_tracking?: boolean;
    performance_metrics?: boolean;
}
export interface AIEmployeeModelConfig {
    provider?: string;
    model?: string;
    temperature?: number;
}
/**
 * Standard Clone AI Employee JSON Document Structure
 */
export interface CloneAIEmployeeConfig {
    id: string;
    name: string;
    role: string;
    description: string;
    identity: AIEmployeeIdentity;
    mission: AIEmployeeMission;
    scope: AIEmployeeScope;
    autonomy: AIEmployeeAutonomy;
    tools: AIEmployeeToolsConfig;
    integrations: any[];
    memory: AIEmployeeMemoryConfig;
    context: AIEmployeeContextConfig;
    planning: AIEmployeePlanningConfig;
    tasks: AIEmployeeTasksConfig;
    delegation: AIEmployeeDelegationConfig;
    communication: AIEmployeeCommunicationConfig;
    execution: AIEmployeeExecutionConfig;
    guardrails: AIEmployeeGuardrailsConfig;
    progress: AIEmployeeProgressConfig;
    observability: AIEmployeeObservabilityConfig;
    model: AIEmployeeModelConfig;
    status: string;
    created_at: string;
    updated_at: string;
}
/**
 * Creates a clean default Clone AI Employee object based on standard schema without demo data.
 */
export declare function createDefaultCloneConfig(overrides?: Partial<CloneAIEmployeeConfig>): CloneAIEmployeeConfig;
export interface TeamMemberConfig {
    clone_id: string;
    role: string;
    position: string;
}
export interface TeamLeadConfig {
    clone_id: string;
}
export interface TeamHierarchyConfig {
    enabled?: boolean;
    manager?: string;
    reporting_lines?: any[];
}
export interface TeamWorkflowConfig {
    name: string;
    steps: string[];
}
export interface TeamCommunicationConfig {
    enabled?: boolean;
    channels?: string[];
    shared_context?: boolean;
    cross_clone_messaging?: boolean;
}
export interface TeamCollaborationConfig {
    shared_memory?: boolean;
    shared_tasks?: boolean;
    shared_documents?: boolean;
    delegation_enabled?: boolean;
}
export interface TeamPermissionsConfig {
    shared?: string[];
    role_based?: Record<string, any>;
    approval_required_for?: string[];
}
export interface TeamMemoryConfig {
    shared?: boolean;
    knowledge_base?: any[];
    decisions?: any[];
    lessons_learned?: any[];
}
export interface TeamProgressConfig {
    completion_percentage?: number;
    milestones?: any[];
    metrics?: any[];
    artifacts?: any[];
}
export interface TeamGuardrailsConfig {
    spending_limit?: number;
    restricted_actions?: string[];
    requires_human_approval?: string[];
}
export interface TeamObservabilityConfig {
    activity_log?: boolean;
    decision_log?: boolean;
    tool_logs?: boolean;
    cost_tracking?: boolean;
}
/**
 * Standard Clone AI Team JSON Document Structure
 */
export interface CloneAITeamConfig {
    id: string;
    name: string;
    description: string;
    mission: AIEmployeeMission;
    members: TeamMemberConfig[];
    lead: TeamLeadConfig;
    hierarchy: TeamHierarchyConfig;
    responsibilities: string[];
    workflows: TeamWorkflowConfig[];
    communication: TeamCommunicationConfig;
    collaboration: TeamCollaborationConfig;
    tasks: AIEmployeeTasksConfig;
    integrations: any[];
    permissions: TeamPermissionsConfig;
    memory: TeamMemoryConfig;
    progress: TeamProgressConfig;
    guardrails: TeamGuardrailsConfig;
    observability: TeamObservabilityConfig;
    status: string;
    created_at: string;
    updated_at: string;
}
/**
 * Creates a clean default Clone AI Team object based on standard schema without demo data.
 */
export declare function createDefaultTeamConfig(overrides?: Partial<CloneAITeamConfig>): CloneAITeamConfig;
//# sourceMappingURL=cloneConfig.d.ts.map