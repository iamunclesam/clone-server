export interface Workspace {
  id: string;
  companyId: string;
  projectId: string;
  provider: "codespaces" | "daytona" | "e2b" | "coder";
  repository: string;
  branch: string;
  status: "RUNNING" | "STOPPED" | "DESTROYED";
  createdAt: Date;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
}

export interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  rawOutput: string;
}

export interface WorkspaceProvider {
  create(input: {
    companyId: string;
    projectId: string;
    repository: string;
    branch: string;
  }): Promise<Workspace>;

  execute(input: {
    workspaceId: string;
    command: string;
    timeoutMs: number;
  }): Promise<CommandResult>;

  readFile(input: {
    workspaceId: string;
    path: string;
  }): Promise<string>;

  writeFile(input: {
    workspaceId: string;
    path: string;
    content: string;
  }): Promise<void>;

  runTests(workspaceId: string): Promise<TestResult>;

  stop(workspaceId: string): Promise<void>;

  destroy(workspaceId: string): Promise<void>;
}
