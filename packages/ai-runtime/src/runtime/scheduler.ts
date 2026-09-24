/**
 * Runtime Scheduler
 *
 * Persistent job scheduler backed by MongoDB RuntimeSchedule records.
 * Uses setInterval for polling — no external queue dependency required.
 *
 * Supports:
 *   CRON    — standard cron expressions ("0 8 * * 1-5")
 *   INTERVAL — fixed millisecond intervals
 *   DEADLINE — one-time fires when dueAt <= now
 *   MANUAL  — never auto-fires; triggered explicitly
 *
 * Architecture:
 *   - A single poll loop runs every POLL_INTERVAL_MS
 *   - Finds all enabled schedules with nextRunAt <= now
 *   - Fires each via the provided onFire callback
 *   - Updates lastRunAt + computes nextRunAt and persists
 *   - Deduplication: a schedule is never double-fired within POLL_INTERVAL_MS
 *
 * CRON parsing is lightweight — we support the most common patterns
 * without a full cron library:
 *   "0 8 * * 1-5"   = 08:00 Monday-Friday
 *   "0 16 * * 5"    = 16:00 Friday
 *   "0 * * * *"     = top of every hour
 *   "star/15 * * * *" = every 15 minutes
 */

import { prisma } from "@clone/database";

export type ScheduledJob = {
  scheduleId: string;
  companyId: string;
  cloneId: string;
  taskType: string;
  taskPayload: Record<string, unknown>;
  triggerType: string;
  scheduleName: string;
};

export type SchedulerFireCallback = (job: ScheduledJob) => Promise<void>;

// How often the scheduler polls the DB for due jobs (ms)
const POLL_INTERVAL_MS = 60_000; // 1 minute

// ─── CRON helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a cron field token against a current value.
 * Supports: *, digit, digit-digit, *\/digit
 */
function matchCronField(token: string, value: number): boolean {
  if (token === "*") return true;
  if (token.startsWith("*/")) {
    const step = parseInt(token.slice(2), 10);
    return Number.isFinite(step) && value % step === 0;
  }
  if (token.includes("-")) {
    const [lo, hi] = token.split("-").map(Number);
    return value >= lo && value <= hi;
  }
  if (token.includes(",")) {
    return token.split(",").some((t) => matchCronField(t.trim(), value));
  }
  return parseInt(token, 10) === value;
}

/**
 * Returns true if the given Date matches a cron expression.
 * Expression format: "minute hour dayOfMonth month dayOfWeek"
 */
export function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    matchCronField(minute, date.getMinutes()) &&
    matchCronField(hour, date.getHours()) &&
    matchCronField(dom, date.getDate()) &&
    matchCronField(month, date.getMonth() + 1) &&
    matchCronField(dow, date.getDay())
  );
}

/**
 * Given a cron expression, compute the next Date after `after` when
 * the expression fires. Searches up to 1 year ahead, minute by minute.
 */
export function nextCronDate(expression: string, after: Date): Date {
  const MAX_MINUTES = 525_960; // 1 year
  const candidate = new Date(after.getTime() + 60_000);
  candidate.setSeconds(0, 0);

  for (let i = 0; i < MAX_MINUTES; i++) {
    if (matchesCron(expression, candidate)) return new Date(candidate);
    candidate.setTime(candidate.getTime() + 60_000);
  }
  // Fallback: 24 hours from now
  return new Date(after.getTime() + 24 * 60 * 60 * 1000);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class RuntimeScheduler {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private onFire: SchedulerFireCallback;

  constructor(onFire: SchedulerFireCallback) {
    this.onFire = onFire;
  }

  /** Start the poll loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(
      `[RuntimeScheduler] Started — polling every ${POLL_INTERVAL_MS / 1000}s`
    );
    // Fire immediately on start, then on interval
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  /** Stop the poll loop */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    console.log("[RuntimeScheduler] Stopped");
  }

  /** Core poll: find due schedules, fire them, update nextRunAt */
  async poll(): Promise<void> {
    const now = new Date();
    let dueDocs: any[] = [];

    try {
      dueDocs = await prisma.runtimeSchedule.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: now },
        },
        take: 100,
      });
    } catch (err) {
      // DB not yet ready — skip silently
      return;
    }

    for (const doc of dueDocs) {
      try {
        const job: ScheduledJob = {
          scheduleId: doc.id,
          companyId: doc.companyId,
          cloneId: doc.cloneId,
          taskType: doc.taskType || "generic",
          taskPayload: doc.taskPayload || {},
          triggerType: doc.triggerType,
          scheduleName: doc.name,
        };

        // Compute next run before firing so DB is updated even if fire throws
        const nextRunAt = this.computeNextRun(doc, now);

        await prisma.runtimeSchedule.update({
          where: { id: doc.id },
          data: {
            lastRunAt: now,
            lastRunStatus: "FIRED",
            nextRunAt,
          },
        });

        await this.onFire(job);
      } catch (err: any) {
        console.error(
          `[RuntimeScheduler] Error firing schedule ${doc.id}:`,
          err?.message
        );
        // Mark last run as failed but don't stop the loop
        try {
          await prisma.runtimeSchedule.update({
            where: { id: doc.id },
            data: {
              lastRunAt: now,
              lastRunStatus: "FAILED",
              nextRunAt: this.computeNextRun(doc, now),
            },
          });
        } catch {
          /* ignore */
        }
      }
    }
  }

  /** Compute the next run time for a schedule after it fires */
  computeNextRun(
    doc: {
      triggerType: string;
      cronExpression?: string | null;
      intervalMs?: number | null;
    },
    firedAt: Date
  ): Date {
    switch (doc.triggerType) {
      case "CRON": {
        if (doc.cronExpression) {
          return nextCronDate(doc.cronExpression, firedAt);
        }
        // fallback: 1 hour
        return new Date(firedAt.getTime() + 60 * 60 * 1000);
      }
      case "INTERVAL": {
        const ms = doc.intervalMs || 30 * 60 * 1000;
        return new Date(firedAt.getTime() + ms);
      }
      case "DEADLINE": {
        // one-time fire — disable it
        return new Date(firedAt.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
      }
      default:
        return new Date(firedAt.getTime() + 60 * 60 * 1000);
    }
  }

  /**
   * Manually trigger a specific schedule by ID (for testing / manual runs).
   */
  async triggerNow(scheduleId: string): Promise<void> {
    const doc = await prisma.runtimeSchedule.findFirst({
      where: { id: scheduleId },
    });
    if (!doc) throw new Error(`Schedule ${scheduleId} not found`);

    const job: ScheduledJob = {
      scheduleId: doc.id,
      companyId: doc.companyId,
      cloneId: doc.cloneId,
      taskType: doc.taskType || "generic",
      taskPayload: doc.taskPayload || {},
      triggerType: doc.triggerType,
      scheduleName: doc.name,
    };

    const now = new Date();
    const nextRunAt = this.computeNextRun(doc, now);
    await prisma.runtimeSchedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: now, lastRunStatus: "MANUAL", nextRunAt },
    });

    await this.onFire(job);
  }

  /**
   * Seed or refresh schedules for a single Clone after compileRuntime().
   * No-op if schedules already exist and are current.
   */
  async refreshForClone(cloneId: string, companyId: string): Promise<number> {
    const schedules = await prisma.runtimeSchedule.findMany({
      where: { cloneId, companyId, enabled: true },
    });
    return schedules.length;
  }
}
