import { IntegrationProvider, IntegrationCapability } from "../types";

function getGitHubOAuthCreds() {
  const clientId = (process.env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || "").trim();
  if (!clientId || clientId.startsWith("mock_")) {
    throw new Error("GITHUB_CLIENT_ID is not configured. Create a GitHub OAuth App and set GITHUB_CLIENT_ID.");
  }
  if (!clientSecret || clientSecret.startsWith("mock_")) {
    throw new Error("GITHUB_CLIENT_SECRET is not configured. Set the GitHub OAuth App client secret.");
  }
  return { clientId, clientSecret };
}

const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Clone-AI-OS",
};

async function githubFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${GH_API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...GH_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function toolToken(args: Record<string, unknown>): string {
  return String(args?.accessToken || "").trim();
}

export class GitHubIntegrationProvider implements IntegrationProvider {
  providerId = "github";
  name = "GitHub";
  description = "Connect code repositories, issues, branches, and automated pull request capabilities.";
  category = "Engineering" as const;

  async getAuthorizationUrl(input: { companyId: string; userId: string; redirectUri: string; state: string }): Promise<string> {
    const { clientId } = getGitHubOAuthCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: "repo workflow read:user user:email read:org",
      allow_signup: "true",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(input: { code: string; state: string; redirectUri: string }): Promise<{
    accountName: string;
    accountEmail?: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
  }> {
    const { clientId, clientSecret } = getGitHubOAuthCreds();
    if (!input.code) {
      throw new Error("GitHub OAuth callback is missing the authorization code.");
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
        state: input.state,
      }),
    });

    const tokenBodyText = await tokenRes.text();
    let tokenData: { access_token?: string; scope?: string; token_type?: string; error?: string; error_description?: string };
    try {
      tokenData = JSON.parse(tokenBodyText);
    } catch {
      throw new Error(`GitHub token exchange returned a non-JSON response (${tokenRes.status}).`);
    }

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      const desc = tokenData.error_description || tokenData.error || tokenBodyText.slice(0, 240);
      throw new Error(`GitHub token exchange failed: ${desc}`);
    }

    const accessToken = tokenData.access_token;
    const userRes = await githubFetch("/user", accessToken);
    if (!userRes.ok) {
      const errText = await userRes.text();
      throw new Error(`GitHub profile fetch failed (${userRes.status}): ${errText.slice(0, 240)}`);
    }
    const user: { login?: string; name?: string; email?: string } = await userRes.json();

    let accountEmail = user.email || "";
    if (!accountEmail) {
      const emailsRes = await githubFetch("/user/emails", accessToken);
      if (emailsRes.ok) {
        const emails: Array<{ email: string; primary?: boolean; verified?: boolean }> = await emailsRes.json();
        const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified) || emails[0];
        accountEmail = primary?.email || "";
      }
    }

    let accountName = user.login || user.name || "GitHub Account";
    const orgsRes = await githubFetch("/user/orgs", accessToken);
    if (orgsRes.ok) {
      const orgs: Array<{ login?: string }> = await orgsRes.json();
      if (orgs[0]?.login) {
        accountName = `${user.login} (${orgs[0].login})`;
      }
    }

    const scopes = (tokenData.scope || "repo,workflow,read:user,user:email")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      accountName,
      accountEmail,
      accessToken,
      scopes,
    };
  }

  async getCapabilities(_connectionId?: string): Promise<IntegrationCapability[]> {
    return [
      {
        name: "github.list_repositories",
        description: "List repositories the connected GitHub account can access.",
        inputSchema: { perPage: "number?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["repo"],
      },
      {
        name: "github.read_repository",
        description: "Fetch file trees, directory contents, and commit histories from connected repos.",
        inputSchema: { owner: "string", repo: "string", path: "string?" },
        riskLevel: "low",
        requiresApproval: false,
        readOnly: true,
        requiredScopes: ["repo"],
      },
      {
        name: "github.create_branch",
        description: "Create a new Git branch for code updates or feature implementations.",
        inputSchema: { owner: "string", repo: "string", branchName: "string", baseBranch: "string?" },
        riskLevel: "medium",
        requiresApproval: false,
        readOnly: false,
        requiredScopes: ["repo"],
      },
      {
        name: "github.create_pull_request",
        description: "Open a GitHub Pull Request with structured title, body diff, and reviewers.",
        inputSchema: { owner: "string", repo: "string", headBranch: "string", baseBranch: "string", title: "string", body: "string" },
        riskLevel: "critical",
        requiresApproval: true,
        readOnly: false,
        requiredScopes: ["repo"],
      },
    ];
  }

  async executeTool(input: {
    connectionId?: string;
    toolName: string;
    arguments: Record<string, unknown>;
    employeeId?: string;
    companyId?: string;
  }) {
    const accessToken = toolToken(input.arguments);

    if (input.toolName === "github.list_repositories") {
      if (!accessToken) {
        return { success: false, data: null, error: "No GitHub access token. Reconnect GitHub in integrations." };
      }
      const perPage = Math.max(1, Math.min(30, Number(input.arguments.perPage) || 10));
      const res = await githubFetch(`/user/repos?per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`, accessToken);
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `GitHub list repos failed (${res.status}): ${errText.slice(0, 300)}` };
      }
      const repos: Array<{ full_name: string; private: boolean; html_url: string; description: string | null; default_branch: string }> = await res.json();
      return {
        success: true,
        data: {
          repositories: repos.map((r) => ({
            fullName: r.full_name,
            private: r.private,
            url: r.html_url,
            description: r.description,
            defaultBranch: r.default_branch,
          })),
        },
      };
    }

    if (input.toolName === "github.read_repository") {
      if (!accessToken) {
        return { success: false, data: null, error: "No GitHub access token. Reconnect GitHub in integrations." };
      }
      const owner = String(input.arguments.owner || "");
      const repo = String(input.arguments.repo || "");
      if (!owner || !repo) {
        return { success: false, data: null, error: "github.read_repository requires owner and repo." };
      }
      const path = String(input.arguments.path || "");
      const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`, accessToken);
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `GitHub read repository failed (${res.status}): ${errText.slice(0, 300)}` };
      }
      const body = await res.json();
      const files = Array.isArray(body)
        ? body.map((f: { path?: string; name?: string }) => f.path || f.name).filter(Boolean)
        : [body.path || body.name].filter(Boolean);
      return { success: true, data: { owner, repo, files, path: path || "/" } };
    }

    if (input.toolName === "github.create_branch") {
      if (!accessToken) {
        return { success: false, data: null, error: "No GitHub access token. Reconnect GitHub in integrations." };
      }
      const owner = String(input.arguments.owner || "");
      const repo = String(input.arguments.repo || "");
      const branchName = String(input.arguments.branchName || "");
      const baseBranch = String(input.arguments.baseBranch || "main");
      if (!owner || !repo || !branchName) {
        return { success: false, data: null, error: "github.create_branch requires owner, repo, and branchName." };
      }
      const refRes = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(baseBranch)}`, accessToken);
      if (!refRes.ok) {
        const errText = await refRes.text();
        return { success: false, data: null, error: `Could not read base branch ${baseBranch} (${refRes.status}): ${errText.slice(0, 240)}` };
      }
      const refData: { object?: { sha?: string } } = await refRes.json();
      const sha = refData.object?.sha;
      if (!sha) return { success: false, data: null, error: `Base branch ${baseBranch} has no SHA.` };

      const createRes = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        return { success: false, data: null, error: `GitHub create branch failed (${createRes.status}): ${errText.slice(0, 300)}` };
      }
      return { success: true, data: { branch: branchName, ref: `refs/heads/${branchName}`, created: true } };
    }

    if (input.toolName === "github.create_pull_request") {
      if (!accessToken) {
        return { success: false, data: null, error: "No GitHub access token. Reconnect GitHub in integrations." };
      }
      const owner = String(input.arguments.owner || "");
      const repo = String(input.arguments.repo || "");
      const headBranch = String(input.arguments.headBranch || "");
      const baseBranch = String(input.arguments.baseBranch || "main");
      const title = String(input.arguments.title || "Update");
      const body = String(input.arguments.body || "");
      if (!owner || !repo || !headBranch) {
        return { success: false, data: null, error: "github.create_pull_request requires owner, repo, and headBranch." };
      }
      const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, head: headBranch, base: baseBranch, body }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, data: null, error: `GitHub create pull request failed (${res.status}): ${errText.slice(0, 300)}` };
      }
      const pr: { number?: number; html_url?: string; state?: string } = await res.json();
      return {
        success: true,
        data: { prNumber: pr.number, url: pr.html_url, status: (pr.state || "open").toUpperCase() },
      };
    }

    throw new Error(`Unknown GitHub tool: ${input.toolName}`);
  }

  async disconnect(_connectionId?: string): Promise<void> {}
}
