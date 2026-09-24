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
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
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

function cloneSystemPrompt(clone: any): string {
  return `You are ${clone.name}, an autonomous AI employee with the role of "${clone.role}".
Personality: "${clone.personality || "Professional, concise, action-oriented"}".
Directives: "${clone.systemInstructions || "Fulfil company goals efficiently and communicate clearly with team members."}".
You are in a team channel. Respond focused, in-character, 1–3 sentences max. Do not say you are an AI.`;
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

    const { senderId, content, mentions, parentMessageId, createTaskIfRequested } = body.data;
    let messageType = body.data.messageType || "DISCUSSION";
    let taskId: any = null;

    // Detect task request / delegation pattern: "please review", "find keywords", "create", "@Clone"
    const lowerContent = content.toLowerCase();
    const isTaskOrDelegation =
      createTaskIfRequested ||
      messageType === "TASK_REQUEST" ||
      messageType === "DELEGATION" ||
      lowerContent.includes("please") ||
      lowerContent.includes("task #") ||
      lowerContent.includes("find ") ||
      lowerContent.includes("review ") ||
      lowerContent.includes("create ");

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

    // If mentioned clone exists, call Mistral AI for a real LLM-powered response
    if (mentions && mentions.length > 0) {
      const mentionedEmployeeId = mentions[0];
      const targetEmployee = await AIEmployeeModel.findById(mentionedEmployeeId);

      if (targetEmployee) {
        setTimeout(async () => {
          try {
            const systemPrompt = cloneSystemPrompt(targetEmployee);
            const userMsg = `Channel message from @${populatedMessage?.senderId?.name || "team"}: "${content}"`;
            const aiReply = await callMistral(
              targetEmployee,
              [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }]
            );
            const finalReply = aiReply || (
              messageType === "TASK_REQUEST"
                ? `Understood @${populatedMessage?.senderId?.name || "team"}. I've logged the task and will begin execution now.`
                : `Got it @${populatedMessage?.senderId?.name || "team"}. On it.`
            );

            await ChannelMessageModel.create({
              companyId, channelId,
              senderId: targetEmployee._id,
              content: finalReply,
              messageType: messageType === "TASK_REQUEST" ? "STATUS_UPDATE" : "DISCUSSION",
              mentions: [senderId],
              taskId: taskId || null,
              parentMessageId: message._id,
            });
          } catch (err) { console.error("LLM channel auto-reply error:", err); }
        }, 800);
      }
    } else {
      // No explicit mention — if this message is from a human (prefixed with "[Name]:"),
      // find the best available clone in the channel to respond
      const isHumanMessage = content.startsWith("[") && content.includes("]: ");
      if (isHumanMessage) {
        const channelDoc = await ChannelModel.findById(channelId);
        // Pick the first active employee in this company as the responding clone
        const respondingClone = await AIEmployeeModel.findOne({
          companyId,
          status: { $ne: "PAUSED" },
        });

        if (respondingClone) {
          setTimeout(async () => {
            try {
              const humanText = content.replace(/^\[[^\]]+\]:\s/, "");
              const aiReply = await callMistral(
                respondingClone,
                [{ role: "system", content: cloneSystemPrompt(respondingClone) }, { role: "user", content: humanText }]
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
