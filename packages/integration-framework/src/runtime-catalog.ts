/**
 * Integration Capability Registry
 *
 * Each provider declares its events and actions independently of any Clone.
 * The RuntimeCompiler combines this with Clone identity + permissions to derive
 * what a specific Clone should actually react to and what it can do.
 *
 * Rule: nothing here is Clone-specific. This is pure capability declaration.
 */

export type RuntimeTriggerKind =
  | "EVENT"
  | "CRON"
  | "INTERVAL"
  | "DEADLINE"
  | "CONDITION"
  | "MANUAL";

// ─── Action Definition ────────────────────────────────────────────────────────

export type RuntimeActionDef = {
  /** Unique dotted ID: "provider.action_name" */
  id: string;
  provider: string;
  name: string;
  description: string;
  /** true = modifies state (create, update, send, deploy, delete) */
  write: boolean;
  /** true = requires human approval before execution */
  requiresApproval: boolean;
  /** Optional risk classification */
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Roles/keywords for which this action is typically relevant */
  relevance?: string[];
};

// ─── Event Definition ─────────────────────────────────────────────────────────

export type RuntimeEventDef = {
  /** Unique dotted ID: "provider.event_name" */
  id: string;
  provider: string;
  name: string;
  description: string;
  /**
   * Keywords matched against Clone identity (role + name + responsibilities).
   * If empty, ALL Clones with the integration receive this event.
   */
  relevance: string[];
  /** Optional severity hint */
  severity?: "INFO" | "WARNING" | "CRITICAL";
};

// ─── Integration Manifest ─────────────────────────────────────────────────────

export type RuntimeIntegrationManifest = {
  provider: string;
  name: string;
  description: string;
  category: "engineering" | "communication" | "productivity" | "monitoring" | "deployment" | "design" | "crm" | "finance";
  events: RuntimeEventDef[];
  actions: RuntimeActionDef[];
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const RUNTIME_INTEGRATIONS: RuntimeIntegrationManifest[] = [
  // ── GitHub ──────────────────────────────────────────────────────────────────
  {
    provider: "github",
    name: "GitHub",
    description: "Source control, pull requests, issues, and CI/CD",
    category: "engineering",
    events: [
      {
        id: "github.pr_opened",
        provider: "github",
        name: "Pull request opened",
        description: "A pull request was opened in any connected repository.",
        relevance: ["cto", "architect", "engineer", "backend", "frontend", "devops", "qa", "developer", "tech lead"],
      },
      {
        id: "github.pr_review_requested",
        provider: "github",
        name: "PR review requested",
        description: "A review was requested on a pull request.",
        relevance: ["cto", "architect", "engineer", "backend", "frontend", "qa", "tech lead"],
      },
      {
        id: "github.pr_merged",
        provider: "github",
        name: "Pull request merged",
        description: "A pull request was merged into the base branch.",
        relevance: ["cto", "devops", "engineer", "backend", "frontend", "qa", "release"],
      },
      {
        id: "github.issue_created",
        provider: "github",
        name: "Issue created",
        description: "A repository issue was created.",
        relevance: ["cto", "engineer", "backend", "product", "qa"],
      },
      {
        id: "github.issue_assigned",
        provider: "github",
        name: "Issue assigned",
        description: "An issue was assigned to a team member.",
        relevance: ["engineer", "backend", "frontend", "qa"],
      },
      {
        id: "github.ci_failed",
        provider: "github",
        name: "CI failed",
        description: "A GitHub Actions workflow check failed.",
        relevance: ["cto", "devops", "engineer", "backend", "sre"],
        severity: "WARNING",
      },
      {
        id: "github.workflow_failed",
        provider: "github",
        name: "Workflow failed",
        description: "A GitHub Actions workflow run failed.",
        relevance: ["cto", "devops", "engineer", "sre"],
        severity: "WARNING",
      },
    ],
    actions: [
      { id: "github.list_repositories", provider: "github", name: "List repositories", description: "List all accessible repositories.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "github.read_repository", provider: "github", name: "Read repository", description: "Read files, commits, and history.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "github.create_issue", provider: "github", name: "Create issue", description: "Open a GitHub issue.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "github.comment", provider: "github", name: "Comment on issue/PR", description: "Add a comment to an issue or pull request.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "github.create_branch", provider: "github", name: "Create branch", description: "Create a git branch.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "github.create_pull_request", provider: "github", name: "Open pull request", description: "Open a pull request from a branch.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "github.review_pull_request", provider: "github", name: "Review PR", description: "Submit an approval or change-request review.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "github.merge_pull_request", provider: "github", name: "Merge PR", description: "Merge an approved pull request.", write: true, requiresApproval: true, riskLevel: "HIGH" },
      { id: "github.close_issue", provider: "github", name: "Close issue", description: "Close a GitHub issue.", write: true, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── Linear ───────────────────────────────────────────────────────────────────
  {
    provider: "linear",
    name: "Linear",
    description: "Project management, issue tracking, and engineering roadmaps",
    category: "engineering",
    events: [
      {
        id: "linear.issue_created",
        provider: "linear",
        name: "Issue created",
        description: "A Linear issue was created.",
        relevance: ["cto", "engineer", "product", "qa", "backend", "frontend"],
      },
      {
        id: "linear.issue_updated",
        provider: "linear",
        name: "Issue updated",
        description: "A Linear issue status or details were changed.",
        relevance: ["cto", "engineer", "product", "backend", "frontend"],
      },
      {
        id: "linear.issue_completed",
        provider: "linear",
        name: "Issue completed",
        description: "A Linear issue was moved to completed state.",
        relevance: ["cto", "engineer", "product", "qa"],
      },
      {
        id: "linear.issue_overdue",
        provider: "linear",
        name: "Issue overdue",
        description: "A Linear issue passed its due date without being completed.",
        relevance: ["cto", "engineer", "product", "qa"],
        severity: "WARNING",
      },
      {
        id: "linear.cycle_started",
        provider: "linear",
        name: "Cycle started",
        description: "A new sprint/cycle has started.",
        relevance: ["cto", "engineer", "product", "tech lead"],
      },
    ],
    actions: [
      { id: "linear.create_issue", provider: "linear", name: "Create issue", description: "Create a Linear issue.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "linear.update_issue", provider: "linear", name: "Update issue", description: "Update issue status, priority, or assignee.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "linear.assign_issue", provider: "linear", name: "Assign issue", description: "Assign a Linear issue to a team member.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "linear.comment_issue", provider: "linear", name: "Comment on issue", description: "Add a comment to a Linear issue.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "linear.list_issues", provider: "linear", name: "List issues", description: "Query and list Linear issues.", write: false, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── Sentry ───────────────────────────────────────────────────────────────────
  {
    provider: "sentry",
    name: "Sentry",
    description: "Error monitoring, incident tracking, and performance alerts",
    category: "monitoring",
    events: [
      {
        id: "sentry.incident_created",
        provider: "sentry",
        name: "Incident created",
        description: "A Sentry incident was created due to error rate crossing a threshold.",
        relevance: ["cto", "devops", "backend", "engineer", "sre", "support"],
        severity: "CRITICAL",
      },
      {
        id: "sentry.error_rate_increased",
        provider: "sentry",
        name: "Error rate spike",
        description: "Error rate spiked above the configured threshold.",
        relevance: ["cto", "devops", "backend", "sre"],
        severity: "WARNING",
      },
      {
        id: "sentry.issue_assigned",
        provider: "sentry",
        name: "Issue assigned",
        description: "A Sentry issue was assigned to a team member.",
        relevance: ["backend", "engineer", "sre"],
      },
      {
        id: "sentry.issue_resolved",
        provider: "sentry",
        name: "Issue resolved",
        description: "A Sentry issue was marked resolved.",
        relevance: ["cto", "backend", "engineer", "sre"],
      },
    ],
    actions: [
      { id: "sentry.get_issue", provider: "sentry", name: "Get issue details", description: "Fetch full details for a Sentry issue.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "sentry.get_event", provider: "sentry", name: "Get event details", description: "Fetch a specific error event from Sentry.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "sentry.list_issues", provider: "sentry", name: "List issues", description: "List open Sentry issues.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "sentry.resolve_issue", provider: "sentry", name: "Resolve issue", description: "Mark a Sentry issue as resolved.", write: true, requiresApproval: false, riskLevel: "MEDIUM" },
      { id: "sentry.assign_issue", provider: "sentry", name: "Assign issue", description: "Assign a Sentry issue to a team member.", write: true, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── Slack ────────────────────────────────────────────────────────────────────
  {
    provider: "slack",
    name: "Slack",
    description: "Team messaging, channels, and notifications",
    category: "communication",
    events: [
      {
        id: "slack.message_received",
        provider: "slack",
        name: "Message received",
        description: "A message mentioning this Clone or its channel arrived.",
        relevance: ["cto", "cmo", "support", "ops", "growth", "executive", "sales"],
      },
      {
        id: "slack.channel_joined",
        provider: "slack",
        name: "Channel joined",
        description: "The Clone was added to a Slack channel.",
        relevance: ["cto", "cmo", "ops"],
      },
    ],
    actions: [
      { id: "slack.read_channel", provider: "slack", name: "Read channel", description: "Read message history from a Slack channel.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "slack.send_message", provider: "slack", name: "Send message", description: "Post a message to a Slack channel.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "slack.send_dm", provider: "slack", name: "Send direct message", description: "Send a direct message to a Slack user.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "slack.create_channel", provider: "slack", name: "Create channel", description: "Create a new Slack channel.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
    ],
  },

  // ── Gmail ────────────────────────────────────────────────────────────────────
  {
    provider: "gmail",
    name: "Gmail",
    description: "Email — inbox, drafts, and outbound communication",
    category: "communication",
    events: [
      {
        id: "gmail.message_received",
        provider: "gmail",
        name: "Email received",
        description: "A new email arrived in the connected inbox.",
        relevance: ["support", "cmo", "ops", "sdr", "sales", "executive", "cto"],
      },
    ],
    actions: [
      { id: "gmail.read_message", provider: "gmail", name: "Read email", description: "Read inbox messages and threads.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "gmail.draft_message", provider: "gmail", name: "Draft email", description: "Create an email draft (not sent).", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "gmail.send_message", provider: "gmail", name: "Send email", description: "Send an email to a recipient.", write: true, requiresApproval: true, riskLevel: "HIGH" },
      { id: "gmail.label_message", provider: "gmail", name: "Label email", description: "Apply a label to an email thread.", write: true, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── Google Calendar ───────────────────────────────────────────────────────────
  {
    provider: "calendar",
    name: "Google Calendar",
    description: "Meetings, scheduling, and time blocking",
    category: "productivity",
    events: [
      {
        id: "calendar.event_starting",
        provider: "calendar",
        name: "Event starting soon",
        description: "A calendar event is starting in the next 15 minutes.",
        relevance: ["cto", "cmo", "ops", "executive", "engineer", "sales"],
      },
      {
        id: "calendar.event_created",
        provider: "calendar",
        name: "Event created",
        description: "A new calendar event was added.",
        relevance: ["cto", "cmo", "ops", "executive"],
      },
    ],
    actions: [
      { id: "calendar.read_events", provider: "calendar", name: "Read events", description: "Read upcoming calendar events.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "calendar.create_event", provider: "calendar", name: "Create event", description: "Create a new calendar event.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "calendar.update_event", provider: "calendar", name: "Update event", description: "Update an existing calendar event.", write: true, requiresApproval: true, riskLevel: "MEDIUM" },
      { id: "calendar.delete_event", provider: "calendar", name: "Delete event", description: "Delete a calendar event.", write: true, requiresApproval: true, riskLevel: "HIGH" },
    ],
  },

  // ── Notion ────────────────────────────────────────────────────────────────────
  {
    provider: "notion",
    name: "Notion",
    description: "Docs, wikis, knowledge bases, and databases",
    category: "productivity",
    events: [
      {
        id: "notion.page_updated",
        provider: "notion",
        name: "Page updated",
        description: "A Notion page in a connected workspace was updated.",
        relevance: ["cto", "product", "engineer", "ops", "cmo"],
      },
      {
        id: "notion.database_item_created",
        provider: "notion",
        name: "Database item created",
        description: "A new item was added to a Notion database.",
        relevance: ["product", "ops", "cmo", "cto"],
      },
    ],
    actions: [
      { id: "notion.read_page", provider: "notion", name: "Read page", description: "Read content from a Notion page.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "notion.create_page", provider: "notion", name: "Create page", description: "Create a new Notion page.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "notion.update_page", provider: "notion", name: "Update page", description: "Update content in a Notion page.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "notion.search", provider: "notion", name: "Search Notion", description: "Search across connected Notion workspace.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "notion.create_database_item", provider: "notion", name: "Create database item", description: "Add a row to a Notion database.", write: true, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── Vercel ────────────────────────────────────────────────────────────────────
  {
    provider: "vercel",
    name: "Vercel",
    description: "Frontend deployments, preview environments, and production releases",
    category: "deployment",
    events: [
      {
        id: "vercel.deployment_failed",
        provider: "vercel",
        name: "Deployment failed",
        description: "A Vercel deployment failed.",
        relevance: ["cto", "devops", "frontend", "engineer", "sre"],
        severity: "CRITICAL",
      },
      {
        id: "vercel.deployment_succeeded",
        provider: "vercel",
        name: "Deployment succeeded",
        description: "A Vercel deployment completed successfully.",
        relevance: ["cto", "devops", "frontend", "engineer"],
      },
      {
        id: "vercel.deployment_created",
        provider: "vercel",
        name: "Deployment created",
        description: "A new Vercel deployment was triggered.",
        relevance: ["cto", "devops", "frontend", "engineer"],
      },
    ],
    actions: [
      { id: "vercel.list_deployments", provider: "vercel", name: "List deployments", description: "List recent Vercel deployments.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "vercel.get_deployment", provider: "vercel", name: "Get deployment", description: "Get details for a specific deployment.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "vercel.create_deployment", provider: "vercel", name: "Create deployment", description: "Trigger a new production deployment.", write: true, requiresApproval: true, riskLevel: "CRITICAL" },
      { id: "vercel.rollback_deployment", provider: "vercel", name: "Rollback deployment", description: "Roll back to a previous deployment.", write: true, requiresApproval: true, riskLevel: "CRITICAL" },
      { id: "vercel.cancel_deployment", provider: "vercel", name: "Cancel deployment", description: "Cancel an in-progress deployment.", write: true, requiresApproval: true, riskLevel: "HIGH" },
      { id: "vercel.get_project", provider: "vercel", name: "Get project", description: "Get Vercel project details and settings.", write: false, requiresApproval: false, riskLevel: "LOW" },
    ],
  },

  // ── HubSpot ───────────────────────────────────────────────────────────────────
  {
    provider: "hubspot",
    name: "HubSpot",
    description: "CRM, contacts, deals, and marketing automation",
    category: "crm",
    events: [
      {
        id: "hubspot.contact_created",
        provider: "hubspot",
        name: "Contact created",
        description: "A new contact was added to HubSpot.",
        relevance: ["cmo", "sdr", "sales", "growth", "ops"],
      },
      {
        id: "hubspot.deal_stage_changed",
        provider: "hubspot",
        name: "Deal stage changed",
        description: "A deal was moved to a new stage in the pipeline.",
        relevance: ["cmo", "sdr", "sales", "growth"],
      },
    ],
    actions: [
      { id: "hubspot.read_contacts", provider: "hubspot", name: "Read contacts", description: "List and search HubSpot contacts.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "hubspot.create_contact", provider: "hubspot", name: "Create contact", description: "Add a new contact to HubSpot.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "hubspot.update_contact", provider: "hubspot", name: "Update contact", description: "Update a HubSpot contact record.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "hubspot.create_deal", provider: "hubspot", name: "Create deal", description: "Create a new deal in HubSpot.", write: true, requiresApproval: false, riskLevel: "LOW" },
      { id: "hubspot.send_email", provider: "hubspot", name: "Send email", description: "Send a marketing or transactional email.", write: true, requiresApproval: true, riskLevel: "HIGH" },
    ],
  },

  // ── Stripe ────────────────────────────────────────────────────────────────────
  {
    provider: "stripe",
    name: "Stripe",
    description: "Payments, subscriptions, and billing",
    category: "finance",
    events: [
      {
        id: "stripe.payment_failed",
        provider: "stripe",
        name: "Payment failed",
        description: "A payment charge failed.",
        relevance: ["cto", "cfo", "ops", "support", "growth"],
        severity: "WARNING",
      },
      {
        id: "stripe.subscription_cancelled",
        provider: "stripe",
        name: "Subscription cancelled",
        description: "A subscription was cancelled.",
        relevance: ["cmo", "growth", "ops", "support"],
        severity: "WARNING",
      },
      {
        id: "stripe.subscription_created",
        provider: "stripe",
        name: "Subscription created",
        description: "A new subscription was created.",
        relevance: ["cmo", "growth", "ops"],
      },
    ],
    actions: [
      { id: "stripe.read_customers", provider: "stripe", name: "Read customers", description: "List and search Stripe customers.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "stripe.read_invoices", provider: "stripe", name: "Read invoices", description: "Read invoice data from Stripe.", write: false, requiresApproval: false, riskLevel: "LOW" },
      { id: "stripe.create_payment_link", provider: "stripe", name: "Create payment link", description: "Create a Stripe payment link.", write: true, requiresApproval: true, riskLevel: "HIGH" },
      { id: "stripe.issue_refund", provider: "stripe", name: "Issue refund", description: "Refund a payment.", write: true, requiresApproval: true, riskLevel: "CRITICAL" },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getRuntimeManifest(provider: string): RuntimeIntegrationManifest | undefined {
  return RUNTIME_INTEGRATIONS.find((m) => m.provider === provider);
}

export function listRuntimeActions(provider: string): RuntimeActionDef[] {
  return getRuntimeManifest(provider)?.actions ?? [];
}

export function listRuntimeEvents(provider: string): RuntimeEventDef[] {
  return getRuntimeManifest(provider)?.events ?? [];
}

export function findRuntimeEvent(eventId: string): RuntimeEventDef | undefined {
  for (const m of RUNTIME_INTEGRATIONS) {
    const found = m.events.find((e) => e.id === eventId);
    if (found) return found;
  }
  return undefined;
}

export function findRuntimeAction(actionId: string): RuntimeActionDef | undefined {
  for (const m of RUNTIME_INTEGRATIONS) {
    const found = m.actions.find((a) => a.id === actionId);
    if (found) return found;
  }
  return undefined;
}

/** All unique providers that have registered events */
export function getAllProviders(): string[] {
  return RUNTIME_INTEGRATIONS.map((m) => m.provider);
}

/**
 * Find all events that could be relevant to a given identity string.
 * The identity string is: role + name + responsibilities lowercased and joined.
 * This is used for "broad" initial matching before permission checks.
 */
export function findRelevantEvents(providers: string[], identityText: string): RuntimeEventDef[] {
  const results: RuntimeEventDef[] = [];
  for (const provider of providers) {
    for (const event of listRuntimeEvents(provider)) {
      if (
        event.relevance.length === 0 ||
        event.relevance.some((keyword) => identityText.includes(keyword))
      ) {
        results.push(event);
      }
    }
  }
  return results;
}

/**
 * Find all actions available for a given set of providers.
 * Permission checks (read-only vs write) happen in the RuntimeCompiler.
 */
export function findAvailableActions(providers: string[]): RuntimeActionDef[] {
  const results: RuntimeActionDef[] = [];
  for (const provider of providers) {
    results.push(...listRuntimeActions(provider));
  }
  return results;
}

/**
 * Get all CRITICAL-severity events across all providers.
 * Used for escalation routing.
 */
export function getCriticalEvents(): RuntimeEventDef[] {
  return RUNTIME_INTEGRATIONS.flatMap((m) =>
    m.events.filter((e) => e.severity === "CRITICAL")
  );
}
