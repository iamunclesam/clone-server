import {
  connectToDatabase,
  UserModel,
  CompanyModel,
  MembershipModel,
  TeamModel,
  ConnectedAccountModel,
  AIEmployeeModel,
  TaskModel,
  ApprovalRequestModel,
  EmployeeMemoryModel,
  ActivityLogModel,
  ChannelModel,
  ChannelMessageModel,
  Role,
  EmployeeStatus,
  TaskStatus,
  TaskPriority,
  RiskLevel,
  ApprovalStatus,
} from "./index";

async function main() {
  console.log("🌱 Starting Clone AI OS Database Seed (MongoDB)...");
  await connectToDatabase();

  // 1. Create Founder User
  let founder = await UserModel.findOne({ email: "founder@acme.com" });
  if (!founder) {
    founder = await UserModel.create({
      email: "founder@acme.com",
      passwordHash: "$2b$10$abcdef1234567890abcdef1234567890abcdef1234567890",
      fullName: "Jane Doe",
      isEmailVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
    });
  }

  // 2. Create Company Acme Corp
  let company = await CompanyModel.findOne({ slug: "acme" });
  if (!company) {
    company = await CompanyModel.create({
      name: "Acme Corp",
      slug: "acme",
      companySize: "1-10",
      companyType: "SaaS Platform",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=250",
    });
  }

  // 3. Create Membership
  let membership = await MembershipModel.findOne({ userId: founder._id, companyId: company._id });
  if (!membership) {
    membership = await MembershipModel.create({
      userId: founder._id,
      companyId: company._id,
      role: Role.OWNER,
    });
  }

  // 4. Create Teams
  const engTeam = await TeamModel.create({
    companyId: company._id,
    name: "Engineering & Product",
    description: "Core software engineering, architecture, and deployment management.",
    instructions: "Maintain 99.9% uptime, strictly enforce code review before merging PRs.",
  });

  const opsTeam = await TeamModel.create({
    companyId: company._id,
    name: "Operations & Support",
    description: "Customer success, documentation, and executive coordination.",
    instructions: "Respond to customer support emails within 15 minutes.",
  });

  // 5. Do not seed fake OAuth connections — GitHub/Slack must be linked via real OAuth.
  await ConnectedAccountModel.updateMany(
    {
      $or: [
        { encryptedToken: { $in: ["enc_github_token_sample", "enc_slack_token_sample"] } },
        { accountName: { $in: ["Acme-Org", "Acme-GitHub-Org", "Acme Workspace"] } },
        { accountEmail: { $in: ["devops@acme.com", "bot@acme.slack.com"] } },
      ],
    },
    { $set: { status: "DISCONNECTED" } }
  );

  // 6. Create AI Employees
  const cto = await AIEmployeeModel.create({
    companyId: company._id,
    teamId: engTeam._id,
    name: "Alex Vance",
    role: "AI CTO",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=250",
    shortDescription: "Technical architect & system strategist leading engineering initiatives.",
    personality: "Pragmatic, analytical, high security standards, focused on clean architecture.",
    systemInstructions: "You are the AI CTO of Acme Corp. Analyze repositories, create task blueprints, enforce architectural standards.",
    status: EmployeeStatus.ACTIVE,
    maxMonthlySpend: 1000.0,
    currentSpend: 142.5,
  });

  const support = await AIEmployeeModel.create({
    companyId: company._id,
    teamId: opsTeam._id,
    name: "Sarah Jenkins",
    role: "AI Customer Support Agent",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250",
    shortDescription: "Customer care specialist handling tier-1 email queries and docs.",
    personality: "Empathetic, clear, solution-oriented, fast responder.",
    systemInstructions: "Answer support tickets, search Notion docs for accurate context.",
    status: EmployeeStatus.WORKING,
    maxMonthlySpend: 400.0,
    currentSpend: 38.1,
  });

  // 7. Seed Tasks
  const task1 = await TaskModel.create({
    companyId: company._id,
    teamId: engTeam._id,
    assignedEmployeeId: cto._id,
    title: "Prepare architectural rollout for V2 launch",
    description: "Review main repository structure, verify security limits, and create Linear issues.",
    naturalPrompt: "Review the V2 launch plan and set up our engineering tasks in Linear.",
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    approvalRequired: true,
  });

  const task2 = await TaskModel.create({
    companyId: company._id,
    teamId: opsTeam._id,
    assignedEmployeeId: support._id,
    title: "Draft customer launch update & reply to priority queue",
    description: "Review unanswered support emails from yesterday and draft replies.",
    naturalPrompt: "Review all unanswered support emails from yesterday and prepare draft replies.",
    status: TaskStatus.WAITING_FOR_APPROVAL,
    priority: TaskPriority.MEDIUM,
    approvalRequired: true,
  });

  // 8. Seed Approvals
  await ApprovalRequestModel.create({
    companyId: company._id,
    employeeId: support._id,
    taskId: task2._id,
    actionName: "Send Customer Launch Email Broadcast",
    toolName: "gmail.send_message",
    proposedParams: JSON.stringify({ to: "beta-users@acme-list.com", subject: "Acme V2 Feature Preview" }, null, 2),
    riskLevel: RiskLevel.HIGH,
    riskReason: "Mass outbound email sending requires founder sign-off.",
    status: ApprovalStatus.PENDING,
  });

  await ApprovalRequestModel.create({
    companyId: company._id,
    employeeId: cto._id,
    taskId: task1._id,
    actionName: "Deploy Security Patch to Production",
    toolName: "github.create_pull_request",
    proposedParams: JSON.stringify({ repo: "Acme/api-core", branch: "fix/security" }, null, 2),
    riskLevel: RiskLevel.CRITICAL,
    riskReason: "Direct modification to main production repository requires architectural review.",
    status: ApprovalStatus.PENDING,
  });

  // 9. Seed Shared Memories
  await EmployeeMemoryModel.create({
    companyId: company._id,
    employeeId: cto._id,
    scope: "COMPANY",
    key: "architecture_principles",
    content: "Acme Corp uses modular TypeScript, MongoDB Mongoose models, and multi-tenant isolation.",
    confidence: 1.0,
    source: "founder_onboarding_doc",
    vectorEmbedding: [0.12, -0.45, 0.88, 0.33, 0.05],
  });

  // 11. Seed Channels & Messages
  const engChannel = await ChannelModel.create({
    companyId: company._id,
    teamId: engTeam._id,
    name: "engineering",
    type: "TEAM",
    topic: "Engineering architecture, code reviews & PR discussions",
    members: [cto._id],
  });

  const crossTeamChannel = await ChannelModel.create({
    companyId: company._id,
    name: "cross-team-general",
    type: "CROSS_TEAM",
    topic: "Inter-department coordination & dependency alignment",
    members: [cto._id, support._id],
  });

  await ChannelMessageModel.create({
    companyId: company._id,
    channelId: engChannel._id,
    senderId: cto._id,
    content: "Initiating architectural rollout for V2 launch. Enforcing Mistral AI reasoning for code safety.",
    messageType: "STATUS_UPDATE",
    taskId: task1._id,
  });

  await ChannelMessageModel.create({
    companyId: company._id,
    channelId: crossTeamChannel._id,
    senderId: support._id,
    content: "@Alex Vance, customer support requires API status updates for the launch update email.",
    messageType: "TASK_REQUEST",
    mentions: [cto._id],
    taskId: task2._id,
  });

  console.log("✅ Seed complete! Acme Corp created in MongoDB with founder@acme.com, 2 AI Employees, Teams, Channels, Tasks, and Approvals. Connect GitHub via OAuth on the integrations page.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
