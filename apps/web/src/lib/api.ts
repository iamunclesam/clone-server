function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_API_URL;
  if (!envUrl) return "http://localhost:4000/api/v1";
  const trimmed = envUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

const API_BASE = getApiBaseUrl();

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  companySize?: string;
  companyType?: string;
  logoUrl?: string;
  employees?: AIEmployee[];
  _count?: {
    tasks?: number;
    integrations?: number;
    approvals?: number;
  };
}

export interface EmployeePermission {
  toolName: string;
  requiresApproval: boolean;
  writeAccess: boolean;
}

export interface AIEmployee {
  id: string;
  companyId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  shortDescription?: string;
  personality?: string;
  systemInstructions?: string;
  status: "ACTIVE" | "WORKING" | "IDLE" | "PAUSED";
  llmProvider?: string;
  llmModel?: string;
  maxMonthlySpend?: number;
  currentSpend?: number;
  connectedTools?: string[];
  permissions?: EmployeePermission[];
  team?: { id: string; name: string };
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  status: string;
}

export interface Team {
  id: string;
  companyId: string;
  name: string;
  description: string;
  instructions?: string;
  leadEmployeeId?: string;
  leadEmployee?: TeamMember;
  members: TeamMember[];
  memberCount: number;
  lead: string;
  status: string;
  createdAt?: string;
}

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description: string;
  naturalPrompt?: string;
  status: "PENDING" | "IN_PROGRESS" | "WAITING_FOR_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  approvalRequired?: boolean;
  assignedEmployee?: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  createdAt?: string;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  employeeId: string;
  taskId?: string;
  actionName: string;
  toolName: string;
  proposedParams?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskReason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  employee?: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  task?: {
    id: string;
    title: string;
  };
  createdAt?: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  employeeId?: string;
  actorName: string;
  action: string;
  resource?: string;
  details?: string;
  timestamp?: string;
  createdAt?: string;
  employee?: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
}

export interface ConnectedAccount {
  id: string;
  companyId: string;
  provider: string;
  accountName: string;
  accountEmail?: string;
  scopes?: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  connectedAt?: string;
  createdAt?: string;
}

export interface ConversationItem {
  id: string;
  companyId: string;
  employeeId: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessageItem {
  id?: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  model?: string;
  contextUsed?: string[];
  approvalRequired?: {
    approvalId: string;
    toolName: string;
    args: any;
    riskReason: string;
    status?: "PENDING" | "APPROVED" | "REJECTED";
  };
  actionExecuted?: { toolName: string; args: any; result: any };
}

export interface EmployeeSpeechResult {
  audioBase64: string;
  mimeType: string;
  model: string;
  provider: string;
  voicePreset: string;
}

export class ApiError extends Error {
  code: string;
  requestId?: string;
  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs: number = 180000): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      const errorMsg = json?.error?.message || response.statusText || "Request failed";
      const errorCode = json?.error?.code || `HTTP_${response.status}`;
      throw new ApiError(errorMsg, errorCode, json?.error?.requestId);
    }

    return json.data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new ApiError(`Request timed out after ${timeoutMs / 1000}s`, "TIMEOUT_ERROR");
    }
    throw err;
  }
}

export const api = {
  // Auth
  async login(credentials: { email: string; password: string }): Promise<{ user: User }> {
    return request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  async register(data: { email: string; password: string; fullName: string }): Promise<{ user: User }> {
    return request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  },

  async getSession(): Promise<{ user: User }> {
    return request<{ user: User }>("/auth/session");
  },

  // Companies / Workspaces
  async getCompanies(): Promise<{ companies: Company[] }> {
    return request<{ companies: Company[] }>("/companies");
  },

  async createCompany(data: { name: string; companySize?: string; companyType?: string }): Promise<{ company: Company }> {
    return request<{ company: Company }>("/companies", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCompany(companyId: string): Promise<{ company: Company }> {
    return request<{ company: Company }>(`/companies/${companyId}`);
  },

  // AI Employees
  async getEmployees(companyId: string): Promise<{ employees: AIEmployee[] }> {
    return request<{ employees: AIEmployee[] }>(`/companies/${companyId}/employees`);
  },

  async createEmployee(
    companyId: string,
    data: {
      name: string;
      role: string;
      shortDescription: string;
      personality: string;
      systemInstructions: string;
      teamId?: string;
      avatarUrl?: string;
      maxMonthlySpend?: number;
    }
  ): Promise<{ employee: AIEmployee }> {
    return request<{ employee: AIEmployee }>(`/companies/${companyId}/employees`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async pauseEmployee(companyId: string, employeeId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/companies/${companyId}/employees/${employeeId}/pause`, {
      method: "POST",
    });
  },

  async resumeEmployee(companyId: string, employeeId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/companies/${companyId}/employees/${employeeId}/resume`, {
      method: "POST",
    });
  },

  async updateEmployeePermissions(
    companyId: string,
    employeeId: string,
    permissions: EmployeePermission[]
  ): Promise<{ permissions: EmployeePermission[] }> {
    return request<{ permissions: EmployeePermission[] }>(`/companies/${companyId}/employees/${employeeId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
  },

  async chatWithEmployee(
    companyId: string,
    employeeId: string,
    message: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>,
    conversationId?: string
  ): Promise<{
    conversationId?: string;
    response: string;
    model: string;
    provider: string;
    contextUsed?: string[];
    actionExecuted?: { toolName: string; args: any; result: any };
    approvalRequired?: { approvalId: string; toolName: string; args: any; riskReason: string };
  }> {
    return request<{
      conversationId?: string;
      response: string;
      model: string;
      provider: string;
      contextUsed?: string[];
      actionExecuted?: { toolName: string; args: any; result: any };
      approvalRequired?: { approvalId: string; toolName: string; args: any; riskReason: string };
    }>(`/companies/${companyId}/employees/${employeeId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, history, conversationId }),
    });
  },

  async synthesizeEmployeeSpeech(
    companyId: string,
    employeeId: string,
    text: string,
    voicePreset?: string
  ): Promise<EmployeeSpeechResult> {
    const cleaned = text
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/[_#>-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const truncated = cleaned.slice(0, 600);
    return request<EmployeeSpeechResult>(`/companies/${companyId}/employees/${employeeId}/voice`, {
      method: "POST",
      body: JSON.stringify({ text: truncated, voicePreset }),
    });
  },

  async getConversations(companyId: string, employeeId: string): Promise<{ conversations: ConversationItem[] }> {
    return request<{ conversations: ConversationItem[] }>(`/companies/${companyId}/employees/${employeeId}/conversations`);
  },

  async createConversation(companyId: string, employeeId: string, title?: string): Promise<{ conversation: ConversationItem }> {
    return request<{ conversation: ConversationItem }>(`/companies/${companyId}/employees/${employeeId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async getConversationMessages(companyId: string, employeeId: string, conversationId: string): Promise<{ messages: ChatMessageItem[] }> {
    return request<{ messages: ChatMessageItem[] }>(`/companies/${companyId}/employees/${employeeId}/conversations/${conversationId}/messages`);
  },

  async deleteConversation(companyId: string, employeeId: string, conversationId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/companies/${companyId}/employees/${employeeId}/conversations/${conversationId}`, {
      method: "DELETE",
    });
  },

  // Tasks
  async getTasks(companyId: string, query: { status?: string; employeeId?: string } = {}): Promise<{ tasks: Task[] }> {
    const params = new URLSearchParams(query as Record<string, string>).toString();
    const qs = params ? `?${params}` : "";
    return request<{ tasks: Task[] }>(`/companies/${companyId}/tasks${qs}`);
  },

  async createTask(
    companyId: string,
    data: {
      title: string;
      description: string;
      naturalPrompt?: string;
      assignedEmployeeId?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      approvalRequired?: boolean;
    }
  ): Promise<{ task: Task }> {
    return request<{ task: Task }>(`/companies/${companyId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Approvals
  async getApprovals(companyId: string, status?: string): Promise<{ approvals: ApprovalRequest[] }> {
    const qs = status ? `?status=${status}` : "";
    return request<{ approvals: ApprovalRequest[] }>(`/companies/${companyId}/approvals${qs}`);
  },

  async approveAction(companyId: string, approvalId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/companies/${companyId}/approvals/${approvalId}/approve`, {
      method: "POST",
    });
  },

  async rejectAction(companyId: string, approvalId: string, reason: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/companies/${companyId}/approvals/${approvalId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // Activity
  async getActivity(companyId: string, limit: number = 50): Promise<{ activities: ActivityLog[] }> {
    return request<{ activities: ActivityLog[] }>(`/companies/${companyId}/activity?limit=${limit}`);
  },

  // Integrations
  async getIntegrations(companyId: string): Promise<{ connections: ConnectedAccount[] }> {
    return request<{ connections: ConnectedAccount[] }>(`/companies/${companyId}/integrations`);
  },

  async connectIntegration(companyId: string, provider: string): Promise<{ authorizationUrl: string }> {
    return request<{ authorizationUrl: string }>(`/companies/${companyId}/integrations/${provider}/connect`, {
      method: "POST",
    });
  },

  async disconnectIntegration(companyId: string, connectionId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/companies/${companyId}/integrations/${connectionId}/disconnect`, {
      method: "POST",
    });
  },

  // Teams
  async getTeams(companyId: string): Promise<{ teams: Team[] }> {
    return request<{ teams: Team[] }>(`/companies/${companyId}/teams`);
  },

  async createTeam(
    companyId: string,
    data: { name: string; description?: string; instructions?: string; leadEmployeeId?: string; memberIds?: string[] }
  ): Promise<{ team: Team }> {
    return request<{ team: Team }>(`/companies/${companyId}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getTeam(companyId: string, teamId: string): Promise<{ team: Team }> {
    return request<{ team: Team }>(`/companies/${companyId}/teams/${teamId}`);
  },

  async updateTeam(
    companyId: string,
    teamId: string,
    data: { name?: string; description?: string; instructions?: string; leadEmployeeId?: string }
  ): Promise<{ team: Team }> {
    return request<{ team: Team }>(`/companies/${companyId}/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async assignTeamMembers(companyId: string, teamId: string, employeeIds: string[]): Promise<{ message: string }> {
    return request<{ message: string }>(`/companies/${companyId}/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify({ employeeIds }),
    });
  },

  async removeTeamMember(companyId: string, teamId: string, employeeId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/companies/${companyId}/teams/${teamId}/members/${employeeId}`, {
      method: "DELETE",
    });
  },

  async setTeamLead(companyId: string, teamId: string, leadEmployeeId: string): Promise<{ team: Team }> {
    return request<{ team: Team }>(`/companies/${companyId}/teams/${teamId}/lead`, {
      method: "PATCH",
      body: JSON.stringify({ leadEmployeeId }),
    });
  },

  // Channels & Clone Communication
  async getChannels(companyId: string): Promise<{ channels: Channel[] }> {
    return request<{ channels: Channel[] }>(`/companies/${companyId}/channels`);
  },

  async createChannel(
    companyId: string,
    data: { name: string; type: "TEAM" | "DIRECT" | "CROSS_TEAM"; teamId?: string; topic?: string; memberIds?: string[] }
  ): Promise<{ channel: Channel }> {
    return request<{ channel: Channel }>(`/companies/${companyId}/channels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getChannelMessages(companyId: string, channelId: string): Promise<{ messages: ChannelMessage[] }> {
    return request<{ messages: ChannelMessage[] }>(`/companies/${companyId}/channels/${channelId}/messages`);
  },

  async sendMessage(
    companyId: string,
    channelId: string,
    data: {
      senderId: string;
      content: string;
      messageType?: "DISCUSSION" | "TASK_REQUEST" | "DELEGATION" | "DECISION" | "STATUS_UPDATE";
      mentions?: string[];
      parentMessageId?: string;
      createTaskIfRequested?: boolean;
    }
  ): Promise<{ message: ChannelMessage }> {
    return request<{ message: ChannelMessage }>(`/companies/${companyId}/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Workflows
  async getWorkflows(companyId: string): Promise<{ workflows: Workflow[] }> {
    return request<{ workflows: Workflow[] }>(`/companies/${companyId}/workflows`);
  },

  async getWorkflow(companyId: string, workflowId: string): Promise<{ workflow: Workflow }> {
    return request<{ workflow: Workflow }>(`/companies/${companyId}/workflows/${workflowId}`);
  },

  async createWorkflow(companyId: string, data: {
    name: string;
    description?: string;
    triggerType: Workflow["triggerType"];
    steps: Array<{ stepOrder: number; employeeId?: string; actionType: WorkflowStep["actionType"]; configJson: Record<string, unknown> }>;
    canvasJson?: Record<string, unknown>;
  }): Promise<{ workflow: Workflow }> {
    return request<{ workflow: Workflow }>(`/companies/${companyId}/workflows`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateWorkflow(companyId: string, workflowId: string, data: {
    name?: string; description?: string; triggerType?: Workflow["triggerType"]; isActive?: boolean; canvasJson?: Record<string, unknown>;
  }): Promise<{ workflow: Workflow }> {
    return request<{ workflow: Workflow }>(`/companies/${companyId}/workflows/${workflowId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteWorkflow(companyId: string, workflowId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/companies/${companyId}/workflows/${workflowId}`, { method: "DELETE" });
  },

  async saveWorkflowCanvas(companyId: string, workflowId: string, nodes: unknown[], edges: unknown[]): Promise<{ saved: boolean }> {
    return request<{ saved: boolean }>(`/companies/${companyId}/workflows/${workflowId}/canvas`, {
      method: "PUT",
      body: JSON.stringify({ nodes, edges }),
    });
  },

  async triggerWorkflow(companyId: string, workflowId: string, context?: Record<string, unknown>): Promise<{
    runId: string; workflowId: string; stepResults: Array<{ step: number; actionType: string; status: string; output: string }>; completedSteps: number;
  }> {
    return request<any>(`/companies/${companyId}/workflows/${workflowId}/trigger`, {
      method: "POST",
      body: JSON.stringify(context || {}),
    });
  },

  async duplicateWorkflow(companyId: string, workflowId: string): Promise<{ workflow: Workflow }> {
    return request<{ workflow: Workflow }>(`/companies/${companyId}/workflows/${workflowId}/duplicate`, { method: "POST" });
  },
};

export interface Channel {
  id: string;
  companyId: string;
  teamId?: { id: string; name: string } | string;
  name: string;
  type: "TEAM" | "DIRECT" | "CROSS_TEAM";
  topic?: string;
  members?: AIEmployee[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChannelMessage {
  id: string;
  companyId: string;
  channelId: string;
  senderId: AIEmployee;
  content: string;
  messageType: "DISCUSSION" | "TASK_REQUEST" | "DELEGATION" | "DECISION" | "STATUS_UPDATE";
  mentions?: AIEmployee[];
  taskId?: Task;
  parentMessageId?: string;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  employeeId?: string;
  actionType: "FETCH_CONTEXT" | "PLAN" | "EXECUTE_TOOL" | "HUMAN_APPROVAL" | "NOTIFY_SLACK" | "SEND_EMAIL";
  configJson?: string;
  status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED" | "WAITING_FOR_APPROVAL";
}

export interface Workflow {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  triggerType: "EMAIL" | "GITHUB_ISSUE" | "LINEAR_ISSUE" | "SLACK_MESSAGE" | "SCHEDULE" | "WEBHOOK" | "MANUAL";
  isActive: boolean;
  lastRunAt?: string;
  runCount?: number;
  canvasJson?: Record<string, unknown>;
  steps?: WorkflowStep[];
  createdAt?: string;
  updatedAt?: string;
}
