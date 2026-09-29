import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { IntegrationRegistry } from "@clone/integration-framework";
import { createDecipheriv, createCipheriv, randomBytes } from "crypto";
import { execFile } from "child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";

const ENCRYPTION_KEY = Buffer.from(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "0".repeat(64), "hex");
const BARK_MODEL_ID = process.env.BARK_MODEL_ID || "suno/bark";
const DEFAULT_BARK_VOICE_PRESET = process.env.BARK_VOICE_PRESET || "v2/en_speaker_6";
const MAX_TTS_INPUT_LENGTH = 600;
const MAX_TTS_RAW_INPUT_LENGTH = 8000;
const TTS_PRIMARY_TIMEOUT_MS = 120_000;
const TTS_PROBE_TIMEOUT_MS = 2_500;
const TTS_LOCAL_TIMEOUT_MS = 15_000;
const TTS_MAX_RETRIES = 2;
const TTS_FALLBACK_MODELS = [
  "suno/bark-small",
  "facebook/mms-tts-eng",
  "suno/bark",
];
const TTS_INFERENCE_ENDPOINTS = [
  "https://api-inference.huggingface.co/models",
  "https://router.huggingface.co/hf-inference/models",
  "https://inference.huggingface.co/models",
];

const TTS_PROVIDER_PREFERENCE = (process.env.TTS_PROVIDERS || "local_say,local_http,huggingface")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const LOCAL_SAY_VOICE = process.env.LOCAL_SAY_VOICE || "Samantha";
const LOCAL_HTTP_TTS_URL = process.env.LOCAL_HTTP_TTS_URL || "";
const LOCAL_HTTP_TTS_TIMEOUT_MS = parseInt(process.env.LOCAL_HTTP_TTS_TIMEOUT_MS || "60000", 10);

const TTS_LOCAL_CACHE_DIR = join(tmpdir(), "clone-tts-cache");
try { if (!existsSync(TTS_LOCAL_CACHE_DIR)) mkdirSync(TTS_LOCAL_CACHE_DIR, { recursive: true }); } catch {}
const TTS_LOCAL_CACHE_MAX = 128;
const _ttsLocalCache: Array<{ key: string; audioBase64: string; mimeType: string; model: string; voicePreset: string }> = [];
function cacheKey(prefix: string, text: string, extra: string) {
  let h = 0;
  const s = `${prefix}|${text}|${extra}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `${prefix}-${h.toString(16).padStart(8, "0")}-${s.length}`;
}
function cacheGet(key: string) { return _ttsLocalCache.find((c) => c.key === key); }
function cachePut(item: typeof _ttsLocalCache[number]) {
  const idx = _ttsLocalCache.findIndex((c) => c.key === item.key);
  if (idx >= 0) _ttsLocalCache.splice(idx, 1);
  _ttsLocalCache.unshift(item);
  while (_ttsLocalCache.length > TTS_LOCAL_CACHE_MAX) _ttsLocalCache.pop();
}

let _ttsEndpointAvailabilityCache: { endpoint: string | null; checkedAt: number } | null = null;
const TTS_ENDPOINT_CACHE_TTL_MS = 60_000;

function decryptToken(encryptedBase64: string): string {
  try {
    const buf = Buffer.from(encryptedBase64, "base64");
    const iv = buf.subarray(0, 16);
    const tag = buf.subarray(16, 32);
    const encrypted = buf.subarray(32);
    const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (err) {
    return "";
  }
}

const createEmployeeSchema = z.object({
  name: z.string().min(2).max(80),
  role: z.string().min(2).max(60),
  shortDescription: z.string().min(10).max(300),
  personality: z.string().min(10).max(500),
  systemInstructions: z.string().min(20).max(8000),
  teamId: z.string().optional(),
  avatarUrl: z.string().url().max(512).optional(),
  workingHours: z.string().max(80).optional(),
  communicationStyle: z.string().max(200).optional(),
  maxMonthlySpend: z.number().min(0).max(100000).optional(),
  permissions: z.array(
    z.object({
      toolName: z.string().min(1).max(80),
      requiresApproval: z.boolean().optional(),
      writeAccess: z.boolean().optional(),
    })
  ).optional(),
});

const synthesizeSpeechSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_RAW_INPUT_LENGTH),
  voicePreset: z.string().trim().max(80).optional(),
});

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

function permissionList(employee: any): Array<{ toolName: string; requiresApproval?: boolean; writeAccess?: boolean }> {
  return Array.isArray(employee?.permissions) ? employee.permissions : [];
}

function hasCapability(permissions: Array<{ toolName: string }>, toolName: string): boolean {
  return permissions.some((p) => p.toolName === toolName);
}

function isProviderAssigned(permissions: Array<{ toolName: string }>, provider: string): boolean {
  const prefix = String(provider || "").toLowerCase();
  if (!prefix) return false;
  return permissions.some((p) => {
    const name = String(p.toolName || "").toLowerCase();
    return name === prefix || name.startsWith(`${prefix}.`);
  });
}

function assignedProviders(permissions: Array<{ toolName: string }>): string[] {
  const providers = new Set<string>();
  for (const p of permissions) {
    const name = String(p.toolName || "");
    if (!name) continue;
    providers.add(name.includes(".") ? name.split(".")[0] : name);
  }
  return Array.from(providers);
}

function withConnectedTools(employee: any) {
  const permissions = permissionList(employee);
  return {
    ...employee,
    permissions,
    connectedTools: assignedProviders(permissions),
  };
}

function prepareTextForSpeech(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function probeTtsEndpoint(endpoint: string, huggingFaceApiKey: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_PROBE_TIMEOUT_MS);
  try {
    const url = `${endpoint}/${encodeURIComponent("facebook")}/${encodeURIComponent("mms-tts-eng")}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${huggingFaceApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: ".", options: { wait_for_model: false } }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status !== 0 && (res.ok || res.status === 503 || res.status === 400 || res.status === 422);
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

async function getFirstAvailableTtsEndpoint(huggingFaceApiKey: string): Promise<string | null> {
  const now = Date.now();
  if (_ttsEndpointAvailabilityCache && (now - _ttsEndpointAvailabilityCache.checkedAt) < TTS_ENDPOINT_CACHE_TTL_MS) {
    return _ttsEndpointAvailabilityCache.endpoint;
  }
  for (const ep of TTS_INFERENCE_ENDPOINTS) {
    if (await probeTtsEndpoint(ep, huggingFaceApiKey)) {
      _ttsEndpointAvailabilityCache = { endpoint: ep, checkedAt: now };
      return ep;
    }
  }
  _ttsEndpointAvailabilityCache = { endpoint: null, checkedAt: now };
  return null;
}

function execFileP(
  file: string,
  args: string[],
  opts: { timeoutMs: number; cwd?: string }
): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`Command timed out after ${opts.timeoutMs}ms: ${file} ${args.join(" ")}`));
    }, opts.timeoutMs);
    try {
      execFile(file, args, { timeout: opts.timeoutMs, maxBuffer: 10 * 1024 * 1024, cwd: opts.cwd, encoding: "buffer" as any }, (err, stdout, stderr) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve({ stdout: stdout as Buffer, stderr: stderr as Buffer });
      });
    } catch (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function synthesizeWithLocalSay(input: { text: string; voicePreset?: string }) {
  const voice = input.voicePreset && /^[A-Za-z0-9 _-]{1,40}$/.test(input.voicePreset)
    ? input.voicePreset
    : LOCAL_SAY_VOICE;

  const k = cacheKey("say", input.text, voice);
  const cached = cacheGet(k);
  if (cached) return cached;

  let dir: string | null = null;
  try {
    dir = mkdtempSync(join(tmpdir(), "clone-say-"));
    const aiff = join(dir, "out.aiff");
    const wav = join(dir, "out.wav");
    await execFileP("say", ["-v", voice, "-o", aiff, input.text], { timeoutMs: TTS_LOCAL_TIMEOUT_MS });
    if (!existsSync(aiff) || readFileSync(aiff).length < 200) throw new Error("say produced empty output");
    await execFileP("ffmpeg", [
      "-y", "-i", aiff, "-ar", "22050", "-ac", "1", "-acodec", "pcm_s16le", wav, "-loglevel", "error",
    ], { timeoutMs: TTS_LOCAL_TIMEOUT_MS });
    const wavBuf = readFileSync(wav);
    if (wavBuf.length < 200) throw new Error("ffmpeg produced empty wav");
    const result = {
      audioBase64: wavBuf.toString("base64"),
      mimeType: "audio/wav",
      model: "macos-say",
      voicePreset: voice,
    };
    cachePut({ key: k, ...result });
    return result;
  } finally {
    if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function synthesizeWithLocalHttp(input: { text: string; voicePreset?: string }) {
  if (!LOCAL_HTTP_TTS_URL) throw new Error("LOCAL_HTTP_TTS_URL is not set");
  const k = cacheKey("http", input.text, LOCAL_HTTP_TTS_URL + "|" + (input.voicePreset || ""));
  const cached = cacheGet(k);
  if (cached) return cached;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), LOCAL_HTTP_TTS_TIMEOUT_MS);
  try {
    const payload: any = { text: input.text, voice_preset: input.voicePreset || DEFAULT_BARK_VOICE_PRESET };
    const res = await fetch(LOCAL_HTTP_TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "audio/wav,audio/flac,audio/*,application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Local HTTP TTS failed (${res.status}): ${t.slice(0, 300)}`);
    }
    const ct = res.headers.get("content-type") || "";
    let audioBase64: string;
    let mimeType = "audio/wav";
    if (ct.includes("application/json")) {
      const data = await res.json() as any;
      audioBase64 = data?.audioBase64 || data?.audio_base64 || data?.data?.audioBase64 || "";
      if (data?.mimeType || data?.mime_type) mimeType = data.mimeType || data.mime_type;
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error("Local HTTP TTS returned tiny audio");
      audioBase64 = buf.toString("base64");
      mimeType = ct.includes("audio/") ? ct : "audio/wav";
    }
    if (!audioBase64) throw new Error("Local HTTP TTS returned no audio");
    const result = { audioBase64, mimeType, model: "local_http", voicePreset: input.voicePreset || "default" };
    cachePut({ key: k, ...result });
    return result;
  } finally {
    clearTimeout(tid);
  }
}

async function synthesizeSpeech(input: { text: string; voicePreset?: string }) {
  const errors: string[] = [];
  const providers = TTS_PROVIDER_PREFERENCE;

  for (const provider of providers) {
    try {
      if (provider === "local_say") {
        return await synthesizeWithLocalSay(input);
      }
      if (provider === "local_http") {
        return await synthesizeWithLocalHttp(input);
      }
      if (provider === "huggingface") {
        return await synthesizeWithBark(input);
      }
    } catch (e: any) {
      errors.push(`${provider}: ${e?.message || String(e)}`);
    }
  }

  const summary = errors.join(" || ");
  const setupHint = "Quick fix: leave TTS_PROVIDERS default (macOS 'say' works now). For Bark locally: run a Python server on localhost and set LOCAL_HTTP_TTS_URL, or enable DNS/egress to api-inference.huggingface.co for the API server.";
  throw new Error(`No TTS provider succeeded. ${setupHint} Errors: ${summary.slice(0, 600)}`);
}

async function synthesizeWithBark(input: { text: string; voicePreset?: string }) {
  const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!huggingFaceApiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured");
  }

  const baseEndpoint = await getFirstAvailableTtsEndpoint(huggingFaceApiKey);
  if (!baseEndpoint) {
    throw new Error("HuggingFace Inference API is unreachable from this server (DNS/network blocked). Enable network access or use browser Web Speech fallback.");
  }

  const voicePreset = input.voicePreset || DEFAULT_BARK_VOICE_PRESET;
  const candidateModels = Array.from(new Set([BARK_MODEL_ID, ...TTS_FALLBACK_MODELS].filter(Boolean)));

  let lastError: Error | null = null;
  let lastModelTried = "";

  for (const modelId of candidateModels) {
    lastModelTried = modelId;
    for (let attempt = 1; attempt <= TTS_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TTS_PRIMARY_TIMEOUT_MS);
      try {
        const bodyPayload: any = {
          inputs: input.text,
          options: {
            wait_for_model: true,
            use_cache: true,
          },
        };
        if (modelId.toLowerCase().includes("bark")) {
          bodyPayload.parameters = { voice_preset: voicePreset };
        }

        const [modelOrg, modelName] = modelId.split("/");
        const modelPath = modelOrg && modelName
          ? `${encodeURIComponent(modelOrg)}/${encodeURIComponent(modelName)}`
          : encodeURIComponent(modelId);
        const response = await fetch(
          `${baseEndpoint}/${modelPath}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${huggingFaceApiKey}`,
              "Content-Type": "application/json",
              "Accept": "audio/wav,audio/flac,audio/*",
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          }
        );

        if (response.status === 503 || response.status === 429) {
          const waitTime = Math.min(5000 * attempt, 15000);
          const retryHeader = response.headers.get("Retry-After");
          const retryAfter = retryHeader ? parseInt(retryHeader, 10) * 1000 : waitTime;
          if (attempt < TTS_MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, retryAfter));
            continue;
          }
        }

        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const errorDetails = contentType.includes("application/json")
            ? JSON.stringify(await response.json())
            : await response.text();
          throw new Error(`TTS request failed for ${modelId} (${response.status}): ${errorDetails.slice(0, 400)}`);
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        if (audioBuffer.length < 100) {
          throw new Error(`TTS returned empty audio for model ${modelId}`);
        }

        clearTimeout(timeoutId);
        return {
          audioBase64: audioBuffer.toString("base64"),
          mimeType: response.headers.get("content-type") || "audio/wav",
          model: modelId,
          voicePreset,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === "AbortError") {
          lastError = new Error(`TTS request timed out for ${modelId} after ${TTS_PRIMARY_TIMEOUT_MS / 1000}s`);
        } else if (err?.message?.includes("fetch failed")) {
          lastError = new Error(`TTS network error for ${modelId}: ${err?.cause?.message || err.message}`);
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
        if (attempt < TTS_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
  }

  throw new Error(`All TTS models failed. Last error (${lastModelTried}): ${lastError?.message || "Unknown error"}`);
}

export async function employeesRoutes(app: FastifyInstance) {
  const registry = IntegrationRegistry.getInstance();

  // GET /companies/:companyId/employees
  app.get("/:companyId/employees", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const employees = await prisma.aIEmployee.findMany({
      where: { companyId },
      include: {
        team: { select: { id: true, name: true } },
        _count: { select: { tasksAssigned: true, aiExecutions: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({
      success: true,
      data: { employees: (employees || []).map(withConnectedTools) },
      requestId: request.id,
    });
  });

  // POST /companies/:companyId/employees
  app.post("/:companyId/employees", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (m.role === "VIEWER") return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Viewers cannot create AI employees", requestId: request.id } });

    const body = createEmployeeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid employee data", requestId: request.id } });

    const employee = await prisma.aIEmployee.create({
      data: {
        companyId,
        ...body.data,
        permissions: body.data.permissions || [],
      },
    });

    // Audit log
    await prisma.activityLog.create({ data: { companyId, employeeId: employee.id, actorName: request.user!.email, action: "EMPLOYEE_CREATED", resource: employee.name } });

    return reply.status(201).send({ success: true, data: { employee }, requestId: request.id });
  });

  // GET /companies/:companyId/employees/:employeeId
  app.get("/:companyId/employees/:employeeId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const employee = await prisma.aIEmployee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        team: true,
        instructions: true,
        permissions: true,
        tasksAssigned: { orderBy: { createdAt: "desc" }, take: 10 },
        aiExecutions: { orderBy: { startedAt: "desc" }, take: 5 },
        activities: { orderBy: { timestamp: "desc" }, take: 20 },
      },
    });
    if (!employee) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Employee not found", requestId: request.id } });
    return reply.send({ success: true, data: { employee: withConnectedTools(employee) }, requestId: request.id });
  });

  // PATCH /companies/:companyId/employees/:employeeId
  app.patch("/:companyId/employees/:employeeId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (m.role === "VIEWER") return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Viewers cannot edit employees", requestId: request.id } });

    const allowedFields = z.object({
      name: z.string().min(2).max(80).optional(),
      systemInstructions: z.string().max(8000).optional(),
      personality: z.string().max(500).optional(),
      maxMonthlySpend: z.number().min(0).max(100000).optional(),
      avatarUrl: z.string().url().max(1024).optional().nullable(),
    });
    const body = allowedFields.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid fields", requestId: request.id } });

    const employee = await prisma.aIEmployee.updateMany({ where: { id: employeeId, companyId }, data: body.data });
    return reply.send({ success: true, data: { updated: employee.count > 0 }, requestId: request.id });
  });

  // POST /companies/:companyId/employees/:employeeId/pause
  app.post("/:companyId/employees/:employeeId/pause", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;
    await prisma.aIEmployee.updateMany({ where: { id: employeeId, companyId }, data: { status: "PAUSED" } });
    await prisma.activityLog.create({ data: { companyId, employeeId, actorName: request.user!.email, action: "EMPLOYEE_PAUSED", resource: employeeId } });
    return reply.send({ success: true, data: { status: "PAUSED" }, requestId: request.id });
  });

  // POST /companies/:companyId/employees/:employeeId/resume
  app.post("/:companyId/employees/:employeeId/resume", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;
    await prisma.aIEmployee.updateMany({ where: { id: employeeId, companyId }, data: { status: "ACTIVE" } });
    await prisma.activityLog.create({ data: { companyId, employeeId, actorName: request.user!.email, action: "EMPLOYEE_RESUMED", resource: employeeId } });
    return reply.send({ success: true, data: { status: "ACTIVE" }, requestId: request.id });
  });

  // PUT /companies/:companyId/employees/:employeeId/permissions — update assigned integration permissions
  app.put("/:companyId/employees/:employeeId/permissions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (m.role === "VIEWER") return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Viewers cannot update employee permissions", requestId: request.id } });

    const schema = z.object({
      permissions: z.array(
        z.object({
          toolName: z.string(),
          requiresApproval: z.boolean().default(false),
          writeAccess: z.boolean().default(false),
        })
      ),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid permissions structure", requestId: request.id } });

    await prisma.aIEmployee.updateMany({
      where: { id: employeeId, companyId },
      data: { permissions: parsed.data.permissions },
    });

    await prisma.activityLog.create({
      data: {
        companyId,
        employeeId,
        actorName: request.user!.email,
        action: "EMPLOYEE_PERMISSIONS_UPDATED",
        resource: `${parsed.data.permissions.length} tool permissions assigned`,
      },
    });

    return reply.send({ success: true, data: { permissions: parsed.data.permissions }, requestId: request.id });
  });

  // POST /companies/:companyId/employees/:employeeId/chat — query employee with Mistral AI grounded in connected apps
  app.post("/:companyId/employees/:employeeId/chat", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { message, history } = (request.body || {}) as {
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return reply.status(400).send({ success: false, error: { code: "INVALID_PROMPT", message: "Message text is required", requestId: request.id } });
    }

    const employee = await prisma.aIEmployee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Employee not found", requestId: request.id } });

    // Fetch active connected accounts for company
    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: { companyId, status: "CONNECTED" },
    });

    // Fetch employee stored long-term memory facts
    const storedMemories = await prisma.employeeMemory.findMany({
      where: { companyId, employeeId: employee.id },
    }).catch(() => []);

    const memoryFacts = storedMemories.map((m: any) => `- ${m.key}: ${m.content}`).join("\n");

    const assignedPermissions: Array<{ toolName: string; requiresApproval?: boolean; writeAccess?: boolean }> = permissionList(employee);
    const assignedToolNames = assignedPermissions.map((p) => p.toolName);

    // Build context snippets from connected applications the employee is explicitly assigned
    const contextSnippets: string[] = [];
    const contextUsed: string[] = [];
    let gmailAccessToken = "";
    let gmailRefreshToken = "";
    let gmailConnectionId = "";
    let gmailAccountEmail = "";

    for (const acc of connectedAccounts) {
      if (!isProviderAssigned(assignedPermissions, acc.provider)) continue;

      contextUsed.push(`${acc.provider.toUpperCase()} (${acc.accountEmail || acc.accountName})`);
      const decryptedAccessToken = decryptToken(acc.encryptedToken);

      if (acc.provider === "gmail" && decryptedAccessToken) {
        if (!hasCapability(assignedPermissions, "gmail.read_message")) {
          contextSnippets.push(`[ASSIGNED APP: GMAIL (${acc.accountEmail || acc.accountName})]\nInbox read is not enabled for this employee.`);
          continue;
        }
        gmailAccessToken = decryptedAccessToken;
        gmailRefreshToken = acc.refreshToken ? decryptToken(acc.refreshToken) : "";
        gmailConnectionId = acc.id;
        gmailAccountEmail = acc.accountEmail;
          const provider = registry.getProvider("gmail");
          if (provider) {
            try {
              const res = await provider.executeTool({
                connectionId: acc.id,
                toolName: "gmail.read_message",
                arguments: { accessToken: decryptedAccessToken, refreshToken: gmailRefreshToken, query: "" },
                employeeId: employee.id,
                companyId,
              });

              // Refresh token in DB if upstream returned a fresh access token
              if ((res as any)?.data?.freshToken && (res as any).data.freshToken !== decryptedAccessToken) {
                try { await prisma.connectedAccount.update({ where: { id: acc.id }, data: { encryptedToken: encryptToken(String((res as any).data.freshToken)) } }); } catch {}
                gmailAccessToken = String((res as any).data.freshToken);
              }

              const resData: any = res?.data || {};
              const msgs: Array<{ id: string; snippet: string; from: string; subject: string; date: string }> = resData.messages || [];
              if (msgs.length > 0) {
                const formatted = msgs.map((m, i) => `${i + 1}. [From: ${m.from}] Subject: "${m.subject}" — Snippet: "${m.snippet}"`).join("\n");
                contextSnippets.push(`[REAL CONNECTED APP: GMAIL (${acc.accountEmail || acc.accountName})]\nReal Live Messages:\n${formatted}`);
              } else if (res?.success === false) {
                contextSnippets.push(`[CONNECTED APP: GMAIL (${acc.accountEmail})]\n⚠️ Status: Connected but Gmail API read failed: ${(res as any).error}`);
              } else {
                contextSnippets.push(`[REAL CONNECTED APP: GMAIL (${acc.accountEmail || acc.accountName})]\nInbox Status: Active connection verified. 0 recent messages in feed.`);
              }
            } catch (err: any) {
              console.warn("Failed to read real Gmail messages:", err);
              contextSnippets.push(`[CONNECTED APP: GMAIL (${acc.accountEmail})]\nStatus: Authorized. Reading recent messages threw an error.`);
            }
          }
        } else if (acc.provider === "github") {
          const provider = registry.getProvider("github");
          if (provider && decryptedAccessToken) {
            try {
              const res = await provider.executeTool({
                connectionId: acc.id,
                toolName: "github.list_repositories",
                arguments: { accessToken: decryptedAccessToken, perPage: 8 },
                employeeId: employee.id,
                companyId,
              });
              const repos: Array<{ fullName: string; private: boolean; url: string }> = (res as any)?.data?.repositories || [];
              if (repos.length > 0) {
                const formatted = repos.map((r, i) => `${i + 1}. ${r.fullName}${r.private ? " (private)" : ""} — ${r.url}`).join("\n");
                contextSnippets.push(`[REAL CONNECTED APP: GITHUB (${acc.accountName}${acc.accountEmail ? ` / ${acc.accountEmail}` : ""})]\nRepositories:\n${formatted}`);
              } else if (res?.success === false) {
                contextSnippets.push(`[CONNECTED APP: GITHUB (${acc.accountName})]\n⚠️ LIVE API ERROR: ${res.error}`);
              } else {
                contextSnippets.push(`[REAL CONNECTED APP: GITHUB (${acc.accountName})]\nActive connection verified. No repositories returned.`);
              }
            } catch (err: any) {
              contextSnippets.push(`[CONNECTED APP: GITHUB (${acc.accountName})]\n⚠️ LIVE API ERROR: ${err?.message || "Execution failed"}`);
            }
          }
        } else if (acc.provider === "hubspot") {
          const provider = registry.getProvider("hubspot");
          if (provider && decryptedAccessToken) {
            try {
              const res = await provider.executeTool({
                connectionId: acc.id,
                toolName: "hubspot.read_contacts",
                arguments: { accessToken: decryptedAccessToken, limit: 10 },
                employeeId: employee.id,
                companyId,
              });
              if (res?.success && (res.data as any)?.contacts) {
                const contacts: Array<any> = (res.data as any).contacts;
                if (contacts.length > 0) {
                  const formatted = contacts.map((c, i) => `${i + 1}. ${c.firstname || ""} ${c.lastname || ""} <${c.email}> (${c.company || "No Company"})`).join("\n");
                  contextSnippets.push(`[REAL CONNECTED APP: HUBSPOT (${acc.accountName})]\nLive CRM Contacts (${contacts.length}):\n${formatted}`);
                } else {
                  contextSnippets.push(`[REAL CONNECTED APP: HUBSPOT (${acc.accountName})]\nLive CRM connection active. 0 contact records found.`);
                }
              } else {
                contextSnippets.push(`[CONNECTED APP: HUBSPOT (${acc.accountName})]\n⚠️ LIVE API ERROR: ${res?.error || "Failed to fetch HubSpot contacts"}`);
              }
            } catch (err: any) {
              contextSnippets.push(`[CONNECTED APP: HUBSPOT (${acc.accountName})]\n⚠️ LIVE API ERROR: ${err?.message || "HubSpot fetch failed"}`);
            }
          }
        } else if (acc.provider === "calendar") {
          const provider = registry.getProvider("calendar");
          if (provider && decryptedAccessToken) {
            try {
              const res = await provider.executeTool({
                connectionId: acc.id,
                toolName: "calendar.read_events",
                arguments: { accessToken: decryptedAccessToken },
                employeeId: employee.id,
                companyId,
              });
              if (res?.success && (res.data as any)?.events) {
                const events: Array<any> = (res.data as any).events;
                if (events.length > 0) {
                  const formatted = events.map((e, i) => `${i + 1}. "${e.summary}" at ${e.start} (${e.location || "No location"})`).join("\n");
                  contextSnippets.push(`[REAL CONNECTED APP: GOOGLE CALENDAR (${acc.accountName})]\nUpcoming Events:\n${formatted}`);
                } else {
                  contextSnippets.push(`[REAL CONNECTED APP: GOOGLE CALENDAR (${acc.accountName})]\nCalendar active. 0 upcoming events.`);
                }
              } else {
                contextSnippets.push(`[CONNECTED APP: GOOGLE CALENDAR (${acc.accountName})]\n⚠️ LIVE API ERROR: ${res?.error || "Failed to fetch Calendar events"}`);
              }
            } catch (err: any) {
              contextSnippets.push(`[CONNECTED APP: GOOGLE CALENDAR (${acc.accountName})]\n⚠️ LIVE API ERROR: ${err?.message || "Calendar fetch failed"}`);
            }
          }
        } else if (acc.provider === "notion") {
          const provider = registry.getProvider("notion");
          if (provider && decryptedAccessToken) {
            try {
              const res = await provider.executeTool({
                connectionId: acc.id,
                toolName: "notion.search_pages",
                arguments: { accessToken: decryptedAccessToken, query: "" },
                employeeId: employee.id,
                companyId,
              });
              if (res?.success && (res.data as any)?.results) {
                const pages: Array<any> = (res.data as any).results;
                if (pages.length > 0) {
                  const formatted = pages.map((p, i) => `${i + 1}. ${p.title} (${p.url || p.id})`).join("\n");
                  contextSnippets.push(`[REAL CONNECTED APP: NOTION (${acc.accountName})]\nPages:\n${formatted}`);
                } else {
                  contextSnippets.push(`[REAL CONNECTED APP: NOTION (${acc.accountName})]\nNotion workspace active. 0 pages returned.`);
                }
              } else {
                contextSnippets.push(`[CONNECTED APP: NOTION (${acc.accountName})]\n⚠️ LIVE API ERROR: ${res?.error || "Failed to search Notion pages"}`);
              }
            } catch (err: any) {
              contextSnippets.push(`[CONNECTED APP: NOTION (${acc.accountName})]\n⚠️ LIVE API ERROR: ${err?.message || "Notion search failed"}`);
            }
          }
        } else {
          contextSnippets.push(`[CONNECTED APP: ${acc.provider.toUpperCase()} (${acc.accountName})]\nStatus: Active connection.`);
        }
      }

    const systemPrompt = `You are ${employee.name}, an autonomous AI employee with the role of "${employee.role}".
Your personality: "${employee.personality || 'Professional, concise, and helpful'}".
Communication Style: Concise, direct, structured.
Your system directives:
"${employee.systemInstructions || 'Fulfill company goals efficiently.'}"

Assigned Integrated Tools: ${assignedToolNames.length > 0 ? assignedToolNames.join(", ") : "All connected enterprise apps"}

RECALLED FACT MEMORY:
${memoryFacts || "No prior facts stored."}

REAL CONNECTED APPLICATIONS DATA CONTEXT:
${contextSnippets.length > 0 ? contextSnippets.join("\n\n") : "No active integration context currently loaded."}

CRITICAL ACCURACY & TRUTHFULNESS DIRECTIVES:
1. NEVER invent, generate, assume, or output demo, mock, or fake data under any circumstances.
2. If the user asks for data (e.g. contacts, deals, emails, repos, issues, events), answer STRICTLY using the REAL CONNECTED APPLICATIONS DATA CONTEXT provided above.
3. If live integration data could not be retrieved, or if an app returned an error (e.g., status 403, scope missing, or API error in the context above), state the EXACT error and failure reason clearly to the user in a natural, helpful conversational tone (e.g., "I attempted to fetch your HubSpot contacts, but the integration returned an error: [error details]. Please verify your integration setup.").
4. Do NOT pretend a failed request succeeded or make up fake numbers/names. Be 100% transparent.`;

    // Format conversation history for Mistral multi-turn memory
    const formattedHistory = Array.isArray(history)
      ? history.slice(-10).map((h) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: String(h.content || ""),
        }))
      : [];

    const mistralMessages = [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
      { role: "user", content: message },
    ];

    let responseText = "";
    let actualModelUsed = employee.llmModel || "mistral-small-latest";
    let actionExecuted: { toolName: string; args: any; result: any } | undefined;
    let approvalRequired: { approvalId: string; toolName: string; args: any; riskReason: string } | undefined;

    const mistralApiKey = process.env.MISTRAL_API_KEY;

    if (!mistralApiKey) {
      return reply.status(500).send({
        success: false,
        error: { code: "CONFIG_ERROR", message: "MISTRAL_API_KEY is not configured", requestId: request.id },
      });
    }

    const candidateModels = [
      employee.llmModel || "mistral-small-latest",
      "mistral-small-latest",
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "codestral-latest",
    ];
    const modelsToTry = Array.from(new Set(candidateModels.filter(Boolean)));

    let lastErrorMsg = "";
    for (const modelCandidate of modelsToTry) {
      try {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mistralApiKey}`,
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: mistralMessages,
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          responseText = data.choices?.[0]?.message?.content || "";
          if (responseText) {
            actualModelUsed = modelCandidate;
            break;
          }
        }

        const errText = await res.text();
        lastErrorMsg = `(${res.status}): ${errText}`;
        console.warn(`Mistral model "${modelCandidate}" unavailable on key tier: ${errText}. Attempting next model...`);
      } catch (e: any) {
        lastErrorMsg = e?.message || "Fetch network failure";
      }
    }

    if (!responseText) {
      return reply.status(502).send({
        success: false,
        error: { code: "LLM_ERROR", message: `Mistral AI request failed for available models. ${lastErrorMsg}`, requestId: request.id },
      });
    }

    const combinedText = [...formattedHistory.map(h => h.content), message].join("\n");
    const fullThreadText = combinedText.toLowerCase();

    const getConnectedAccount = (providerName: string) => {
      const acc = connectedAccounts.find((a: any) => a.provider === providerName);
      if (!acc) return null;
      const accessToken = decryptToken(acc.encryptedToken);
      const refreshToken = acc.refreshToken ? decryptToken(acc.refreshToken) : "";
      return { acc, accessToken, refreshToken };
    };

    const createApproval = async (opts: {
      actionName: string;
      toolName: string;
      params: Record<string, any>;
      riskLevel: "LOW" | "MEDIUM" | "HIGH";
      riskReason: string;
    }) => {
      return prisma.approvalRequest.create({
        data: {
          companyId,
          employeeId: employee.id,
          actionName: opts.actionName,
          toolName: opts.toolName,
          proposedParams: JSON.stringify(opts.params),
          riskLevel: opts.riskLevel,
          riskReason: opts.riskReason,
          status: "PENDING",
        },
      });
    };

    const extractBetween = (text: string, startMarker: string, endMarker?: string): string | null => {
      const startIdx = text.toLowerCase().indexOf(startMarker.toLowerCase());
      if (startIdx === -1) return null;
      let content = text.slice(startIdx + startMarker.length);
      if (endMarker) {
        const endIdx = content.toLowerCase().indexOf(endMarker.toLowerCase());
        if (endIdx !== -1) content = content.slice(0, endIdx);
      } else {
        content = content.split("\n")[0];
      }
      return content.replace(/^[:\s"'`]+|[:\s"'`,]+$/g, "").trim() || null;
    };

    // ─── GOOGLE CALENDAR ACTIONS ───────────────────────────────────────────────
    const isCalendarCreate = fullThreadText.match(/(create|schedule|book|set up|add)\s+(a|an)?\s*(calendar\s*)?(event|meeting|appointment)/i) ||
                             (fullThreadText.includes("calendar") && (fullThreadText.includes("create") || fullThreadText.includes("schedule")));
    const isCalendarUpdate = fullThreadText.match(/(update|change|modify|reschedule|edit)\s+(a|an)?\s*(calendar\s*)?(event|meeting|appointment)/i);
    const isCalendarDelete = fullThreadText.match(/(delete|remove|cancel)\s+(a|an)?\s*(calendar\s*)?(event|meeting|appointment)/i);

    if ((isCalendarCreate || isCalendarUpdate || isCalendarDelete) && isProviderAssigned(assignedPermissions, "calendar")) {
      const conn = getConnectedAccount("calendar");
      if (conn && conn.accessToken && !conn.accessToken.startsWith("calendar_mock_")) {
        const provider = registry.getProvider("calendar");
        const hasWrite = hasCapability(assignedPermissions, "calendar.create_event") ||
                         hasCapability(assignedPermissions, "calendar.update_event") ||
                         hasCapability(assignedPermissions, "calendar.delete_event");

        if (provider && hasWrite) {
          if (isCalendarCreate) {
            const summary = extractBetween(combinedText, "summary:", "at") ||
                            extractBetween(combinedText, "title:", "at") ||
                            extractBetween(combinedText, "event called") ||
                            extractBetween(combinedText, "meeting for") ||
                            extractBetween(combinedText, "about") ||
                            `Meeting scheduled by ${employee.name}`;

            const now = new Date();
            let startTime = new Date(now.getTime() + 3600_000);
            let endTime = new Date(now.getTime() + 5400_000);
            const attendeesMatch = combinedText.match(/with\s+((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[,\s]*)+)/i);
            const attendees: string[] = [];
            if (attendeesMatch) {
              const emails = attendeesMatch[1].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
              attendees.push(...emails);
            }

            const description = extractBetween(combinedText, "description:") ||
                                extractBetween(combinedText, "details:") ||
                                `Scheduled via Clone AI employee: ${employee.name}`;

            const args: Record<string, any> = {
              accessToken: conn.accessToken,
              summary,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              description,
            };
            if (attendees.length > 0) args.attendees = attendees;

            const perm = assignedPermissions.find(p => p.toolName === "calendar.create_event");
            if (perm?.requiresApproval) {
              const approval = await createApproval({
                actionName: "CALENDAR_CREATE_EVENT",
                toolName: "calendar.create_event",
                params: args,
                riskLevel: "MEDIUM",
                riskReason: `Creating calendar event "${summary}" requires authorization.`,
              });
              approvalRequired = {
                approvalId: approval.id,
                toolName: "calendar.create_event",
                args,
                riskReason: `Creating calendar event "${summary}" requires authorization.`,
              };
              responseText += `\n\n🔒 **Action Triggered**: Calendar event **"${summary}"** prepared. **Approval Request** created.`;
            } else {
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "calendar.create_event",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "calendar.create_event", args, result: res.data };
                const link = (res.data as any)?.htmlLink ? `[Open in Calendar](${(res.data as any).htmlLink})` : "saved to Google Calendar";
                responseText += `\n\n✅ **Action Executed**: Created calendar event **"${summary}"** — ${link}.`;
              } else {
                responseText += `\n\n⚠️ **Calendar Failed**: Could not create event. ${res?.error || 'Unknown error'}`;
              }
            }
          } else if (isCalendarUpdate) {
            const eventId = extractBetween(combinedText, "eventId:") || extractBetween(combinedText, "event id:") ||
                           combinedText.match(/[A-Za-z0-9_-]{20,}/)?.[0] || "";
            const summary = extractBetween(combinedText, "summary:") || extractBetween(combinedText, "new title:");
            if (eventId) {
              const args: Record<string, any> = { accessToken: conn.accessToken, eventId };
              if (summary) args.summary = summary;
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "calendar.update_event",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "calendar.update_event", args, result: res.data };
                responseText += `\n\n✅ **Action Executed**: Updated calendar event **${eventId}** in Google Calendar.`;
              } else {
                responseText += `\n\n⚠️ **Calendar Update Failed**: ${res?.error || 'Unknown error'}`;
              }
            }
          } else if (isCalendarDelete) {
            const eventId = extractBetween(combinedText, "eventId:") || extractBetween(combinedText, "event id:") ||
                           combinedText.match(/[A-Za-z0-9_-]{20,}/)?.[0] || "";
            if (eventId) {
              const approval = await createApproval({
                actionName: "CALENDAR_DELETE_EVENT",
                toolName: "calendar.delete_event",
                params: { accessToken: conn.accessToken, eventId },
                riskLevel: "HIGH",
                riskReason: `Deleting calendar event ${eventId} requires approval.`,
              });
              approvalRequired = {
                approvalId: approval.id,
                toolName: "calendar.delete_event",
                args: { eventId },
                riskReason: "Calendar event deletion requires approval.",
              };
              responseText += `\n\n🔒 **Action Triggered**: Calendar deletion for **${eventId}** prepared — **Approval Request** created.`;
            }
          }
        }
      } else if (!conn) {
        responseText += "\n\n⚠️ **Not Connected**: Google Calendar is not connected. Please connect it in Integrations settings.";
      }
    }

    // ─── NOTION ACTIONS ────────────────────────────────────────────────────────
    const isNotionCreatePage = fullThreadText.match(/(create|make|add|write)\s+(a|an)?\s*(notion\s*)?(page|doc|document|note|wiki)/i) ||
                               (fullThreadText.includes("notion") && (fullThreadText.includes("create page") || fullThreadText.includes("new page")));
    const isNotionCreateDbItem = fullThreadText.match(/(add|create)\s+(a|an)?\s*(notion\s*)?(database\s*)?(item|row|entry|record)/i) ||
                                  (fullThreadText.includes("notion") && fullThreadText.includes("database"));
    const isNotionUpdate = fullThreadText.match(/(update|edit|modify)\s+(a|an)?\s*(notion\s*)?(page|doc)/i);

    if ((isNotionCreatePage || isNotionCreateDbItem || isNotionUpdate) && isProviderAssigned(assignedPermissions, "notion")) {
      const conn = getConnectedAccount("notion");
      if (conn && conn.accessToken && !conn.accessToken.startsWith("secret_notion_mock_")) {
        const provider = registry.getProvider("notion");
        if (provider) {
          if (isNotionCreatePage) {
            const parentId = extractBetween(combinedText, "parentId:") || extractBetween(combinedText, "parent id:") ||
                             extractBetween(combinedText, "in page") || extractBetween(combinedText, "under") ||
                             combinedText.match(/[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}/i)?.[0] || "";
            const title = extractBetween(combinedText, "title:") || extractBetween(combinedText, "page called") ||
                          extractBetween(combinedText, "note on") || extractBetween(combinedText, "document about") ||
                          extractBetween(combinedText, "named") || `Note from ${employee.name}`;
            const contentMarkdown = extractBetween(combinedText, "content:") || extractBetween(combinedText, "body:") ||
                                    extractBetween(combinedText, "that says") || message.replace(/.*create\s*(a|an)?\s*(notion\s*)?(page|doc|note)\s*/i, "").trim() ||
                                    `Created by Clone AI employee: ${employee.name}`;

            if (parentId) {
              const args = { accessToken: conn.accessToken, parentId, title: title.substring(0, 180), contentMarkdown };
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "notion.create_page",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "notion.create_page", args, result: res.data };
                const link = (res.data as any)?.url ? `[Open in Notion](${(res.data as any).url})` : "saved to workspace";
                responseText += `\n\n✅ **Action Executed**: Created Notion page **"${title}"** — ${link}.`;
              } else {
                responseText += `\n\n⚠️ **Notion Failed**: Could not create page. ${res?.error || 'Please provide a valid parentId.'}`;
              }
            } else {
              responseText += "\n\n⚠️ **Needs parentId**: To create a Notion page, specify the parent page/database ID.";
            }
          } else if (isNotionCreateDbItem) {
            const databaseId = extractBetween(combinedText, "databaseId:") || extractBetween(combinedText, "database id:") ||
                               combinedText.match(/[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}/i)?.[0] || "";
            const title = extractBetween(combinedText, "title:") || extractBetween(combinedText, "row for") || extractBetween(combinedText, "called") || "New Item";
            if (databaseId) {
              const args = { accessToken: conn.accessToken, databaseId, title: title.substring(0, 180) };
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "notion.create_database_item",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "notion.create_database_item", args, result: res.data };
                responseText += `\n\n✅ **Action Executed**: Added Notion database item **"${title}"**.`;
              } else {
                responseText += `\n\n⚠️ **Notion DB Failed**: Could not add item. ${res?.error || 'Unknown error'}`;
              }
            }
          } else if (isNotionUpdate) {
            const pageId = extractBetween(combinedText, "pageId:") || extractBetween(combinedText, "page id:") ||
                           combinedText.match(/[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}/i)?.[0] || "";
            const title = extractBetween(combinedText, "title:") || extractBetween(combinedText, "new title:");
            if (pageId && title) {
              const args = { accessToken: conn.accessToken, pageId, title };
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "notion.update_page",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "notion.update_page", args, result: res.data };
                responseText += `\n\n✅ **Action Executed**: Updated Notion page to **"${title}"**.`;
              } else {
                responseText += `\n\n⚠️ **Notion Update Failed**: ${res?.error || 'Unknown error'}`;
              }
            }
          }
        }
      } else if (!conn) {
        responseText += "\n\n⚠️ **Not Connected**: Notion is not connected. Please connect it in Integrations settings.";
      }
    }

    // ─── SLACK ACTIONS ─────────────────────────────────────────────────────────
    const isSlackSend = fullThreadText.match(/(send|post|write|publish|share)\s+(a|an)?\s*(slack\s*)?(message|msg|notification|dm|direct\s*message)/i) ||
                        (fullThreadText.includes("slack") && (fullThreadText.includes("send") || fullThreadText.includes("post") || fullThreadText.includes("message")));
    const isSlackChannel = fullThreadText.match(/(create|make|new|set up)\s+(a|an)?\s*(slack\s*)?(channel)/i);

    if ((isSlackSend || isSlackChannel) && isProviderAssigned(assignedPermissions, "slack")) {
      const conn = getConnectedAccount("slack");
      if (conn && conn.accessToken && !conn.accessToken.startsWith("xoxb_mock_")) {
        const provider = registry.getProvider("slack");
        if (provider) {
          if (isSlackSend) {
            const isDM = fullThreadText.includes("dm") || fullThreadText.includes("direct message");
            const channel = extractBetween(combinedText, "channel:") || extractBetween(combinedText, "in channel") ||
                            extractBetween(combinedText, "to channel") || combinedText.match(/#[a-z0-9_-]+/i)?.[0]?.replace("#", "") || "general";
            const userId = extractBetween(combinedText, "userId:") || extractBetween(combinedText, "user id:") ||
                           extractBetween(combinedText, "to user") || "";
            const text = extractBetween(combinedText, "text:") || extractBetween(combinedText, "saying:") ||
                         extractBetween(combinedText, "message:") || extractBetween(combinedText, "content:") ||
                         message.replace(/.*(send|post|share)\s*(a|an)?\s*(slack\s*)?(message|msg|dm|notification)\s*/i, "").trim() ||
                         `Update from ${employee.name}: ${message.substring(0, 160)}`;

            if (isDM && userId) {
              const args = { accessToken: conn.accessToken, userId, text: text.substring(0, 3000) };
              const approval = await createApproval({
                actionName: "SLACK_SEND_DM",
                toolName: "slack.send_dm",
                params: args,
                riskLevel: "MEDIUM",
                riskReason: `Sending Slack DM to ${userId} requires approval.`,
              });
              approvalRequired = {
                approvalId: approval.id,
                toolName: "slack.send_dm",
                args: { userId, text: args.text },
                riskReason: "Slack DM dispatch requires approval.",
              };
              responseText += `\n\n🔒 **Action Triggered**: Slack DM to user **${userId}** prepared — **Approval Request** created.`;
            } else {
              const args = { accessToken: conn.accessToken, channel, text: text.substring(0, 3000) };
              const approval = await createApproval({
                actionName: "SLACK_SEND_MESSAGE",
                toolName: "slack.send_message",
                params: args,
                riskLevel: "MEDIUM",
                riskReason: `Posting to Slack channel #${channel} requires authorization.`,
              });
              approvalRequired = {
                approvalId: approval.id,
                toolName: "slack.send_message",
                args: { channel, text: args.text },
                riskReason: "Slack channel post requires approval.",
              };
              responseText += `\n\n🔒 **Action Triggered**: Slack message to **#${channel}** prepared — **Approval Request** created.`;
            }
          } else if (isSlackChannel) {
            const name = (extractBetween(combinedText, "name:") || extractBetween(combinedText, "called") ||
                         extractBetween(combinedText, "channel named") || "new-project-channel")
                         .toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").substring(0, 80);
            const isPrivate = fullThreadText.includes("private");
            const args = { accessToken: conn.accessToken, name, isPrivate };
            const approval = await createApproval({
              actionName: "SLACK_CREATE_CHANNEL",
              toolName: "slack.create_channel",
              params: args,
              riskLevel: "MEDIUM",
              riskReason: `Creating Slack channel #${name} requires approval.`,
            });
            approvalRequired = {
              approvalId: approval.id,
              toolName: "slack.create_channel",
              args: { name, isPrivate },
              riskReason: "Slack channel creation requires approval.",
            };
            responseText += `\n\n🔒 **Action Triggered**: Slack channel **#${name}** prepared — **Approval Request** created.`;
          }
        }
      } else if (!conn) {
        responseText += "\n\n⚠️ **Not Connected**: Slack is not connected. Please connect it in Integrations settings.";
      }
    }

    // ─── HUBSPOT ACTIONS ───────────────────────────────────────────────────────
    const isHubspotContact = fullThreadText.match(/(create|add|make|new)\s+(a|an)?\s*(hubspot\s*)?(contact|lead|customer|prospect)/i) ||
                             (fullThreadText.includes("hubspot") && (fullThreadText.includes("contact") && fullThreadText.includes("create")));
    const isHubspotDeal = fullThreadText.match(/(create|add|make|new|open)\s+(a|an)?\s*(hubspot\s*)?(deal|opportunity|pipeline)/i) ||
                          (fullThreadText.includes("hubspot") && fullThreadText.includes("deal"));

    if ((isHubspotContact || isHubspotDeal) && isProviderAssigned(assignedPermissions, "hubspot")) {
      const conn = getConnectedAccount("hubspot");
      if (conn && conn.accessToken && !conn.accessToken.startsWith("hubspot_mock_")) {
        const provider = registry.getProvider("hubspot");
        if (provider) {
          if (isHubspotContact) {
            const emailMatch = combinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const email = emailMatch ? emailMatch[0] : extractBetween(combinedText, "email:") || "";
            const firstname = extractBetween(combinedText, "firstname:") || extractBetween(combinedText, "first name:") || "";
            const lastname = extractBetween(combinedText, "lastname:") || extractBetween(combinedText, "last name:") || "";
            const company = extractBetween(combinedText, "company:") || "";
            const phone = extractBetween(combinedText, "phone:") || "";

            if (email) {
              const args: Record<string, any> = { accessToken: conn.accessToken, email };
              if (firstname) args.firstname = firstname;
              if (lastname) args.lastname = lastname;
              if (company) args.company = company;
              if (phone) args.phone = phone;
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "hubspot.create_contact",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "hubspot.create_contact", args, result: res.data };
                responseText += `\n\n✅ **Action Executed**: Created HubSpot contact **${email}** in CRM.`;
              } else {
                responseText += `\n\n⚠️ **HubSpot Failed**: Could not create contact. ${res?.error || 'Unknown error'}`;
              }
            }
          } else if (isHubspotDeal) {
            const dealname = extractBetween(combinedText, "dealname:") || extractBetween(combinedText, "deal name:") ||
                             extractBetween(combinedText, "deal called") || `New Deal from ${employee.name}`;
            const amountStr = extractBetween(combinedText, "amount:") || extractBetween(combinedText, "$");
            const dealstage = extractBetween(combinedText, "stage:") || extractBetween(combinedText, "pipeline stage:") || "appointmentscheduled";
            const args: Record<string, any> = { accessToken: conn.accessToken, dealname };
            if (amountStr && !isNaN(parseFloat(amountStr))) args.amount = parseFloat(amountStr);
            if (dealstage) args.dealstage = dealstage;
            const res = await provider.executeTool({
              connectionId: conn.acc.id,
              toolName: "hubspot.create_deal",
              arguments: args,
              employeeId: employee.id,
              companyId,
            });
            if (res?.success) {
              actionExecuted = { toolName: "hubspot.create_deal", args, result: res.data };
              responseText += `\n\n✅ **Action Executed**: Created HubSpot deal **"${dealname}"** in pipeline.`;
            } else {
              responseText += `\n\n⚠️ **HubSpot Deal Failed**: ${res?.error || 'Unknown error'}`;
            }
          }
        }
      } else if (!conn) {
        responseText += "\n\n⚠️ **Not Connected**: HubSpot is not connected. Please connect it in Integrations settings.";
      }
    }

    // ─── LINEAR ACTIONS ────────────────────────────────────────────────────────
    const isLinearCreate = fullThreadText.match(/(create|file|open|make|log|add)\s+(a|an)?\s*(linear\s*)?(issue|ticket|bug|task|story)/i) ||
                           (fullThreadText.includes("linear") && (fullThreadText.includes("issue") || fullThreadText.includes("ticket")) && fullThreadText.includes("create"));
    const isLinearUpdate = fullThreadText.match(/(update|change|close|complete|resolve)\s+(a|an)?\s*(linear\s*)?(issue|ticket|task)/i);

    if ((isLinearCreate || isLinearUpdate) && isProviderAssigned(assignedPermissions, "linear")) {
      const conn = getConnectedAccount("linear");
      if (conn) {
        const provider = registry.getProvider("linear");
        if (provider) {
          if (isLinearCreate) {
            const title = extractBetween(combinedText, "title:") || extractBetween(combinedText, "issue called") ||
                          extractBetween(combinedText, "ticket for") || extractBetween(combinedText, "titled") ||
                          message.replace(/.*(create|file|open)\s*(a|an)?\s*(linear\s*)?(issue|ticket|bug|task|story)\s*/i, "").trim().substring(0, 200) ||
                          `Issue created by ${employee.name}`;
            const description = extractBetween(combinedText, "description:") || extractBetween(combinedText, "body:") ||
                                `Reported via Clone AI. Original: ${message.substring(0, 500)}`;
            const priorityStr = extractBetween(combinedText, "priority:");
            const priority = priorityStr ? (parseInt(priorityStr, 10) || 0) : 0;
            const teamKey = extractBetween(combinedText, "team:") || extractBetween(combinedText, "teamKey:") || "ENG";

            const args = { accessToken: conn.accessToken, title: title.substring(0, 250), description, priority, teamKey };
            const res = await provider.executeTool({
              connectionId: conn.acc.id,
              toolName: "linear.create_issue",
              arguments: args,
              employeeId: employee.id,
              companyId,
            });
            if (res?.success) {
              actionExecuted = { toolName: "linear.create_issue", args, result: res.data };
              responseText += `\n\n✅ **Action Executed**: Created Linear issue **"${title}"**.`;
            } else {
              responseText += `\n\n⚠️ **Linear Failed**: Could not create issue. ${res?.error || 'Unknown error'}`;
            }
          } else if (isLinearUpdate) {
            const issueId = extractBetween(combinedText, "issueId:") || extractBetween(combinedText, "ticket id:") ||
                           combinedText.match(/[A-Z]{2,}-\d+/i)?.[0] || "";
            const status = extractBetween(combinedText, "status:") ||
                           ((fullThreadText.includes("close") || fullThreadText.includes("complete") || fullThreadText.includes("resolve")) ? "Done" : "");
            if (issueId && status) {
              const args = { accessToken: conn.accessToken, issueId, status };
              const res = await provider.executeTool({
                connectionId: conn.acc.id,
                toolName: "linear.update_issue",
                arguments: args,
                employeeId: employee.id,
                companyId,
              });
              if (res?.success) {
                actionExecuted = { toolName: "linear.update_issue", args, result: res.data };
                responseText += `\n\n✅ **Action Executed**: Updated Linear issue **${issueId}** status to **${status}**.`;
              } else {
                responseText += `\n\n⚠️ **Linear Update Failed**: ${res?.error || 'Unknown error'}`;
              }
            }
          }
        }
      } else if (!conn) {
        responseText += "\n\n⚠️ **Not Connected**: Linear is not connected. Please connect it in Integrations settings.";
      }
    }

    // ─── GMAIL / EMAIL ACTIONS ─────────────────────────────────────────────────
    const isEmailAction = fullThreadText.includes("send an email") || fullThreadText.includes("send email") ||
                          fullThreadText.includes("draft an email") || fullThreadText.includes("draft email");

    if (isEmailAction && !actionExecuted && !approvalRequired) {
      const emailMatch = combinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const toEmail = emailMatch ? emailMatch[0] : "";

      if (toEmail) {
        const isSend = fullThreadText.includes("send") && !fullThreadText.includes("draft");
        const toolName = isSend ? "gmail.send_message" : "gmail.draft_message";
        const subject = extractBetween(combinedText, "subject:") ||
                        extractBetween(combinedText, "re:") || `Follow up from ${employee.name}`;
        const body = extractBetween(combinedText, "body:") || extractBetween(combinedText, "content:") ||
                     `Hi,\n\nFollowing up on our conversation.\n\nBest regards,\n${employee.name}\n${employee.role}`;

        const gmailConn = getConnectedAccount("gmail");
        if (!gmailConn || !gmailConn.accessToken) {
          responseText += "\n\n⚠️ **Not Connected**: Gmail is not connected. Please connect it in Integrations settings.";
        } else if (isSend) {
          const approval = await createApproval({
            actionName: "SEND_EMAIL_DISPATCH",
            toolName,
            params: { to: toEmail, subject, body },
            riskLevel: "HIGH",
            riskReason: `External email dispatch to ${toEmail} requires founder authorization.`,
          });
          approvalRequired = {
            approvalId: approval.id,
            toolName,
            args: { to: toEmail, subject, body },
            riskReason: `External email dispatch to ${toEmail} requires founder authorization.`,
          };
          responseText += `\n\n🔒 **Action Triggered**: Email dispatch to **${toEmail}** prepared — **Approval Request** created.`;
        } else {
          const provider = registry.getProvider("gmail");
          if (provider) {
            const draftRes = await provider.executeTool({
              connectionId: gmailConn.acc.id,
              toolName: "gmail.draft_message",
              arguments: {
                accessToken: gmailConn.accessToken,
                refreshToken: gmailConn.refreshToken,
                to: toEmail, subject, body,
              },
              employeeId: employee.id,
              companyId,
            });
            if (draftRes?.success) {
              actionExecuted = { toolName: "gmail.draft_message", args: { to: toEmail, subject, body }, result: draftRes?.data };
              responseText += `\n\n✅ **Action Executed**: Created Gmail draft to **${toEmail}** (*Subject: "${subject}"*).`;
            } else {
              responseText += `\n\n⚠️ **Gmail Draft Failed**: ${draftRes?.error || 'Unknown error'}`;
            }
          }
        }
      }
    }
    // Persist key context memories to database if facts were updated
    if (message.toLowerCase().includes("company name is") || message.toLowerCase().includes("my email is")) {
      await prisma.employeeMemory.create({
        data: {
          companyId,
          employeeId: employee.id,
          scope: "EMPLOYEE",
          key: `user_fact_${Date.now()}`,
          content: message,
          confidence: 1.0,
          source: "user_chat",
        },
      }).catch(() => null);
    }

    // Save user message and AI response to persistent conversation
    let convId = (request.body as any)?.conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: {
          companyId,
          employeeId: employee.id,
          title: message.substring(0, 40) + (message.length > 40 ? "..." : ""),
        },
      });
      convId = conv.id || conv._id?.toString();
    }

    if (convId) {
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await prisma.conversationMessage.create({
        data: {
          companyId,
          conversationId: convId,
          sender: "user",
          text: message,
          time: nowStr,
        },
      }).catch(() => null);

      await prisma.conversationMessage.create({
        data: {
          companyId,
          conversationId: convId,
          sender: "ai",
          text: responseText,
          time: nowStr,
          model: actualModelUsed,
          contextUsed,
          approvalRequired,
          actionExecuted,
        },
      }).catch(() => null);

      // Update conversation timestamp & title if default
      await prisma.conversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      }).catch(() => null);
    }

    // Audit log
    await prisma.activityLog.create({
      data: {
        companyId,
        employeeId: employee.id,
        actorName: request.user!.email,
        action: "EMPLOYEE_CHAT_QUERIED",
        resource: `Prompt: "${message.substring(0, 40)}..."`,
      },
    });

    return reply.send({
      success: true,
      data: {
        conversationId: convId,
        response: responseText,
        model: actualModelUsed,
        provider: "mistral",
        contextUsed,
        actionExecuted,
        approvalRequired,
      },
      requestId: request.id,
    });
  });

  // POST /companies/:companyId/employees/:employeeId/voice — synthesize Bark speech for AI responses
  app.post("/:companyId/employees/:employeeId/voice", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    try { reply.raw.setTimeout(TTS_PRIMARY_TIMEOUT_MS + 10_000); } catch {}
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const parsed = synthesizeSpeechSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Text is required and must be <= ${MAX_TTS_RAW_INPUT_LENGTH} characters (speech is truncated to ${MAX_TTS_INPUT_LENGTH} chars after formatting)`,
          requestId: request.id,
        },
      });
    }

    const employee = await prisma.aIEmployee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, role: true },
    });
    if (!employee) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Employee not found", requestId: request.id },
      });
    }

    try {
      const speechText = prepareTextForSpeech(parsed.data.text).slice(0, MAX_TTS_INPUT_LENGTH);
      if (!speechText) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Text must include spoken content after formatting cleanup",
            requestId: request.id,
          },
        });
      }
      const audio = await synthesizeSpeech({
        text: speechText,
        voicePreset: parsed.data.voicePreset,
      });

      const providerLabel =
        audio.model === "macos-say" ? "local_say" :
        audio.model === "local_http" ? "local_http" :
        audio.model.includes("bark") || audio.model === BARK_MODEL_ID ? "bark" : "huggingface";

      await prisma.activityLog.create({
        data: {
          companyId,
          employeeId: employee.id,
          actorName: request.user!.email,
          action: "EMPLOYEE_VOICE_SYNTHESIZED",
          resource: `${employee.name} ${providerLabel} reply`,
          details: `Model ${audio.model} voice ${audio.voicePreset} with ${speechText.length} chars`,
        },
      }).catch(() => null);

      return reply.send({
        success: true,
        data: {
          audioBase64: audio.audioBase64,
          mimeType: audio.mimeType,
          model: audio.model,
          provider: providerLabel,
          voicePreset: audio.voicePreset,
        },
        requestId: request.id,
      });
    } catch (error: any) {
      request.log.error({ err: error, requestId: request.id, employeeId }, "TTS synthesis failed");
      return reply.status(502).send({
        success: false,
        error: {
          code: "TTS_ERROR",
          message: error?.message || "Failed to synthesize audio",
          requestId: request.id,
        },
      });
    }
  });

  // GET /companies/:companyId/employees/:employeeId/conversations — list conversation history
  app.get("/:companyId/employees/:employeeId/conversations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const conversations = await prisma.conversation.findMany({
      where: { companyId, employeeId },
    });

    return reply.send({
      success: true,
      data: { conversations },
      requestId: request.id,
    });
  });

  // POST /companies/:companyId/employees/:employeeId/conversations — start new conversation
  app.post("/:companyId/employees/:employeeId/conversations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, employeeId } = request.params as { companyId: string; employeeId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { title } = (request.body || {}) as { title?: string };
    const conversation = await prisma.conversation.create({
      data: {
        companyId,
        employeeId,
        title: title || "New Conversation",
      },
    });

    return reply.status(201).send({
      success: true,
      data: { conversation },
      requestId: request.id,
    });
  });

  // GET /companies/:companyId/employees/:employeeId/conversations/:conversationId/messages
  app.get("/:companyId/employees/:employeeId/conversations/:conversationId/messages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, conversationId } = request.params as { companyId: string; employeeId: string; conversationId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const messages = await prisma.conversationMessage.findMany({
      where: { companyId, conversationId },
    });

    return reply.send({
      success: true,
      data: { messages },
      requestId: request.id,
    });
  });

  // DELETE /companies/:companyId/employees/:employeeId/conversations/:conversationId
  app.delete("/:companyId/employees/:employeeId/conversations/:conversationId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, conversationId } = request.params as { companyId: string; employeeId: string; conversationId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return reply.send({
      success: true,
      data: { deleted: true },
      requestId: request.id,
    });
  });
}

function encryptToken(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

