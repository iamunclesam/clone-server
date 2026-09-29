import { FastifyInstance } from "fastify";
import { prisma, ChannelModel, ChannelMessageModel, AIEmployeeModel, TaskModel } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";

// ── Shared LLM caller for clone replies ───────────────────────────────────────
async function callMistral(
  clone: any,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 200
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return "";

  const models = [clone.llmModel || "mistral-small-latest", "mistral-small-latest", "open-mistral-7b"];
  for (const model of [...new Set(models)]) {
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch { /* try next */ }
  }
  return "";
}

function cloneSystemPrompt(clone: any, channelType?: string): string {
  const channelScope = channelType === "CROSS_TEAM"
    ? "You are in a Cross-Team Coordination Channel collaborating with teammates across departments."
    : "You are in your Team Channel chatting with your direct team members.";

  return `You are ${clone.name}, a real team member with the role of "${clone.role}".
Your Personality: "${clone.personality || 'Friendly, sharp, direct, and conversational'}".
Your System Directives: "${clone.systemInstructions || 'Fulfill company goals efficiently and support your teammates.'}".

Channel Context: ${channelScope}

STRICT COMMUNICATION & TRUTHFULNESS RULES:
1. Speak naturally like a real coworker in Slack/Teams (1-3 sentences max). Adapt tone to your Personality.
2. ABSOLUTELY NO HALLUCINATIONS: NEVER invent fake meetings, fake Q3 roadmap syncs, fake metric numbers, fake PRs, or fake deployments under any circumstances.
3. Only respond directly and accurately to what was asked in the channel. If no live data is provided, state simply and transparently how you can help or that you're on it.
4. Do NOT output unprompted "Team Update:" blocks or fake executive meeting agendas.`;
}

function discernMessageType(content: string, mentions?: string[]): "DISCUSSION" | "TASK_REQUEST" | "DELEGATION" | "DECISION" | "STATUS_UPDATE" {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("decided") || lowerContent.includes("decision:") || lowerContent.includes("we agreed") || lowerContent.includes("approved")) {
    return "DECISION";
  }
  if (lowerContent.includes("status update") || lowerContent.includes("progress report") || lowerContent.includes("here's an update") || lowerContent.includes("update:")) {
    return "STATUS_UPDATE";
  }
  if (lowerContent.includes("delegate") || lowerContent.includes("assigning to") || lowerContent.includes("reassign")) {
    return "DELEGATION";
  }
  if (
    lowerContent.includes("please") || lowerContent.includes("can you") || lowerContent.includes("need you to") ||
    lowerContent.includes("task #") || lowerContent.includes("find ") || lowerContent.includes("review ") ||
    lowerContent.includes("create ") || lowerContent.includes("fix ") || lowerContent.includes("build ") ||
    lowerContent.includes("handle ") || lowerContent.includes("todo")
  ) {
    return "TASK_REQUEST";
  }
  return "DISCUSSION";
}

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) {
    reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } });
    return null;
  }
  return m;
}

const createChannelSchema = z.object({
  name: z.string().min(2).max(50),
  type: z.enum(["TEAM", "DIRECT", "CROSS_TEAM"]),
  teamId: z.string().optional(),
  topic: z.string().max(200).optional(),
  memberIds: z.array(z.string()).optional(),
});

const sendMessageSchema = z.object({
  senderId: z.string(),
  content: z.string().min(1),
  messageType: z.enum(["DISCUSSION", "TASK_REQUEST", "DELEGATION", "DECISION", "STATUS_UPDATE"]).optional(),
  mentions: z.array(z.string()).optional(),
  parentMessageId: z.string().optional(),
  createTaskIfRequested: z.boolean().optional(),
});

export async function channelsRoutes(app: FastifyInstance) {
  // GET /companies/:companyId/channels — list channels for workspace
  app.get("/:companyId/channels", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!(await guardCompanyAccess(companyId, request.user!.userId, reply, request.id))) return;

    let channels = await ChannelModel.find({ companyId })
      .populate("teamId", "name")
      .populate("members", "name role avatarUrl status")
      .sort({ updatedAt: -1 });

    // Auto-create default channels if none exist yet
    if (channels.length === 0) {
      const defaultTeamChannel = await ChannelModel.create({
        companyId,
        name: "general-team",
        type: "TEAM",
        topic: "Shared communication channel for team clones",
      });

      const defaultCrossTeamChannel = await ChannelModel.create({
        companyId,
        name: "cross-team-general",
        type: "CROSS_TEAM",
        topic: "Cross-department coordination and inter-clone dependencies",
      });

      channels = [defaultTeamChannel, defaultCrossTeamChannel];
    }

    return reply.send({ success: true, data: { channels }, requestId: request.id });
  });

  // POST /companies/:companyId/channels — create a channel
  app.post("/:companyId/channels", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!(await guardCompanyAccess(companyId, request.user!.userId, reply, request.id))) return;

    const body = createChannelSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid channel payload", requestId: request.id } });
    }

    const channel = await ChannelModel.create({
      companyId,
      ...body.data,
    });

    return reply.status(201).send({ success: true, data: { channel }, requestId: request.id });
  });

  // GET /companies/:companyId/channels/:channelId/messages — fetch channel messages
  app.get("/:companyId/channels/:channelId/messages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, channelId } = request.params as { companyId: string; channelId: string };
    if (!(await guardCompanyAccess(companyId, request.user!.userId, reply, request.id))) return;

    const messages = await ChannelMessageModel.find({ companyId, channelId })
      .populate("senderId", "name role avatarUrl status llmModel llmProvider")
      .populate("mentions", "name role avatarUrl")
      .populate("taskId", "title status priority assignedEmployeeId")
      .sort({ createdAt: 1 });

    return reply.send({ success: true, data: { messages }, requestId: request.id });
  });

  // POST /companies/:companyId/channels/:channelId/messages — send message (with automatic task creation if requested/detected)
  app.post("/:companyId/channels/:channelId/messages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, channelId } = request.params as { companyId: string; channelId: string };
    if (!(await guardCompanyAccess(companyId, request.user!.userId, reply, request.id))) return;

    const body = sendMessageSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid message payload", requestId: request.id } });
    }

    const { senderId, content, parentMessageId, createTaskIfRequested } = body.data;
    let mentions = body.data.mentions || [];

    // Extract @mentions from text if not explicitly passed
    if (mentions.length === 0) {
      const allEmployees = await AIEmployeeModel.find({ companyId });
      for (const emp of allEmployees) {
        if (content.toLowerCase().includes(`@${emp.name.toLowerCase()}`)) {
          mentions.push(emp._id.toString());
        }
      }
    }

    // Discern message intent automatically if not explicitly provided
    let messageType = body.data.messageType || discernMessageType(content, mentions);
    let taskId: any = null;

    const channelDoc = await ChannelModel.findById(channelId);

    const isTaskOrDelegation =
      createTaskIfRequested ||
      messageType === "TASK_REQUEST" ||
      messageType === "DELEGATION";

    if (isTaskOrDelegation && mentions && mentions.length > 0) {
      messageType = "TASK_REQUEST";
      const targetEmployeeId = mentions[0];

      // Automatically convert to linked Task object
      const createdTask = await TaskModel.create({
        companyId,
        title: content.length > 60 ? content.substring(0, 57) + "..." : content,
        description: `Requested via Channel Communication by Clone ${senderId}`,
        naturalPrompt: content,
        assignedEmployeeId: targetEmployeeId,
        status: "PENDING",
        priority: "MEDIUM",
        approvalRequired: false,
      });

      taskId = createdTask._id;
    }

    const message = await ChannelMessageModel.create({
      companyId,
      channelId,
      senderId,
      content,
      messageType,
      mentions: mentions || [],
      taskId,
      parentMessageId: parentMessageId || null,
    });

    // Touch channel updatedAt timestamp
    await ChannelModel.findByIdAndUpdate(channelId, { updatedAt: new Date() });

    const populatedMessage = await ChannelMessageModel.findById(message._id)
      .populate("senderId", "name role avatarUrl status llmModel llmProvider")
      .populate("mentions", "name role avatarUrl")
      .populate("taskId", "title status priority assignedEmployeeId");

    // Fetch recent channel messages for LLM conversational context
    const recentMessages = await ChannelMessageModel.find({ companyId, channelId })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("senderId", "name role");

    const historyContext = recentMessages
      .reverse()
      .map((m: any) => {
        const rawContent = typeof m.content === "string" ? m.content : "";
        const isH = rawContent.startsWith("[") && rawContent.includes("]: ");
        const hName = isH ? rawContent.match(/^\[([^\]]+)\]/)?.[1] : null;
        const senderName = hName ? `${hName} (Human)` : ((m.senderId as any)?.name || "Teammate");
        const cleanText = isH ? rawContent.replace(/^\[[^\]]+\]:\s/, "") : rawContent;
        return `${senderName}: ${cleanText}`;
      })
      .join("\n");

    // If mentioned clone exists, call LLM for a persona-styled response
    if (mentions && mentions.length > 0) {
      const mentionedEmployeeId = mentions[0];
      const targetEmployee = await AIEmployeeModel.findById(mentionedEmployeeId);

      if (targetEmployee) {
        // Enforce team scoping: if TEAM channel and clone is not in this team, redirect to cross-team channel
        const isTeamChannel = channelDoc?.type === "TEAM";
        const cloneTeamId = targetEmployee.teamId ? targetEmployee.teamId.toString() : null;
        const channelTeamId = channelDoc?.teamId ? channelDoc.teamId.toString() : null;
        const isMemberOfTeam = !isTeamChannel || !channelTeamId || cloneTeamId === channelTeamId;

        setTimeout(async () => {
          try {
            let finalReply = "";

            if (!isMemberOfTeam) {
              finalReply = `Hey @${populatedMessage?.senderId?.name || "team"}! I'm assigned to a different team. For cross-department requests, catch me in the cross-team channel!`;
            } else {
              const systemPrompt = cloneSystemPrompt(targetEmployee, channelDoc?.type);
              const rawContent = typeof content === "string" ? content : "";
              const isH = rawContent.startsWith("[") && rawContent.includes("]: ");
              const hName = isH ? rawContent.match(/^\[([^\]]+)\]/)?.[1] : null;
              const senderDisplayName = hName || (populatedMessage?.senderId as any)?.name || "Teammate";
              const cleanUserText = isH ? rawContent.replace(/^\[[^\]]+\]:\s/, "") : rawContent;

              const userMsg = `Channel conversation history:\n${historyContext}\n\n${senderDisplayName} said to you (@${targetEmployee.name}): "${cleanUserText}"\n\nReply directly to ${senderDisplayName} as ${targetEmployee.name} (${targetEmployee.role}). Be natural, direct, and brief (1-2 sentences):`;

              const aiReply = await callMistral(
                targetEmployee,
                [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }]
              );
              finalReply = aiReply || (
                messageType === "TASK_REQUEST"
                  ? `On it @${senderDisplayName}. I'll get this handled right away.`
                  : `Hey @${senderDisplayName}, how's it going? What can I help with?`
              );
            }

            await ChannelMessageModel.create({
              companyId, channelId,
              senderId: targetEmployee._id,
              content: finalReply,
              messageType: messageType === "TASK_REQUEST" ? "STATUS_UPDATE" : "DISCUSSION",
              mentions: [],
              taskId: messageType === "TASK_REQUEST" ? taskId : null,
              parentMessageId: message._id,
            });
          } catch (err) { console.error("LLM channel auto-reply error:", err); }
        }, 800);
      }
    } else {
      // No explicit mention — if message is from a human, find a clone belonging to THIS team (or cross-team channel)
      const isHumanMessage = content.startsWith("[") && content.includes("]: ");
      if (isHumanMessage) {
        const isTeamChannel = channelDoc?.type === "TEAM";
        const channelTeamId = channelDoc?.teamId ? channelDoc.teamId.toString() : null;

        // Query active clones belonging strictly to this team if it's a TEAM channel
        const queryFilter: any = { companyId, status: { $ne: "PAUSED" } };
        if (isTeamChannel && channelTeamId) {
          queryFilter.teamId = channelTeamId;
        }

        let respondingClone = await AIEmployeeModel.findOne(queryFilter);
        // Fallback to any active clone if cross-team channel
        if (!respondingClone && !isTeamChannel) {
          respondingClone = await AIEmployeeModel.findOne({ companyId, status: { $ne: "PAUSED" } });
        }

        if (respondingClone) {
          setTimeout(async () => {
            try {
              const humanText = content.replace(/^\[[^\]]+\]:\s/, "");
              const systemPrompt = cloneSystemPrompt(respondingClone, channelDoc?.type);
              const userMsg = `Channel conversation history:\n${historyContext}\n\nLatest human message: "${humanText}"\n\nReply directly as ${respondingClone.name}:`;
              const aiReply = await callMistral(
                respondingClone,
                [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }]
              );
              if (aiReply) {
                await ChannelMessageModel.create({
                  companyId, channelId,
                  senderId: respondingClone._id,
                  content: aiReply,
                  messageType: "DISCUSSION",
                  mentions: [],
                  parentMessageId: message._id,
                });
              }
            } catch (err) { console.error("LLM human-reply error:", err); }
          }, 900);
        }
      }
    }

    return reply.status(201).send({ success: true, data: { message: populatedMessage }, requestId: request.id });
  });
}

