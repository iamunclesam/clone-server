import { WorkspaceProvider, Workspace, CommandResult, TestResult } from "./types";

export * from "./types";

export class MockCloudWorkspaceProvider implements WorkspaceProvider {
  private activeWorkspaces: Map<string, Workspace> = new Map();

  async create(input: { companyId: string; projectId: string; repository: string; branch: string }): Promise<Workspace> {
    const ws: Workspace = {
      id: `ws_${Math.random().toString(36).substring(2, 9)}`,
      companyId: input.companyId,
      projectId: input.projectId,
      provider: "codespaces",
      repository: input.repository,
      branch: input.branch,
      status: "RUNNING",
      createdAt: new Date(),
    };
    this.activeWorkspaces.set(ws.id, ws);
    return ws;
  }

  async execute(input: { workspaceId: string; command: string; timeoutMs: number }): Promise<CommandResult> {
    return {
      exitCode: 0,
      stdout: `[Mock Workspace execution] Executed: ${input.command}\nResult: Command completed successfully in isolated container sandbox.`,
      stderr: "",
      executionTimeMs: 420,
    };
  }

  async readFile(input: { workspaceId: string; path: string }): Promise<string> {
    return `// Mock file content from container workspace path: ${input.path}\nexport const featureFlags = { enableV2Launch: true };`;
  }

  async writeFile(input: { workspaceId: string; path: string; content: string }): Promise<void> {}

  async runTests(workspaceId: string): Promise<TestResult> {
    return {
      passed: true,
      totalTests: 18,
      passedTests: 18,
      failedTests: 0,
      rawOutput: "PASS  tests/auth.test.ts (1.2s)\nPASS  tests/security.test.ts (0.8s)\nTest Suites: 2 passed, 2 total\nTests: 18 passed, 18 total",
    };
  }

  async stop(workspaceId: string): Promise<void> {
    const ws = this.activeWorkspaces.get(workspaceId);
    if (ws) ws.status = "STOPPED";
  }

  async destroy(workspaceId: string): Promise<void> {
    this.activeWorkspaces.delete(workspaceId);
  }
}
