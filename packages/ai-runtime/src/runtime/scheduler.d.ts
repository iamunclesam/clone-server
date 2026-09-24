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
/**
 * Returns true if the given Date matches a cron expression.
 * Expression format: "minute hour dayOfMonth month dayOfWeek"
 */
export declare function matchesCron(expression: string, date: Date): boolean;
/**
 * Given a cron expression, compute the next Date after `after` when
 * the expression fires. Searches up to 1 year ahead, minute by minute.
 */
export declare function nextCronDate(expression: string, after: Date): Date;
export declare class RuntimeScheduler {
    private pollTimer;
    private running;
    private onFire;
    constructor(onFire: SchedulerFireCallback);
    /** Start the poll loop */
    start(): void;
    /** Stop the poll loop */
    stop(): void;
    /** Core poll: find due schedules, fire them, update nextRunAt */
    poll(): Promise<void>;
    /** Compute the next run time for a schedule after it fires */
    computeNextRun(doc: {
        triggerType: string;
        cronExpression?: string | null;
        intervalMs?: number | null;
    }, firedAt: Date): Date;
    /**
     * Manually trigger a specific schedule by ID (for testing / manual runs).
     */
    triggerNow(scheduleId: string): Promise<void>;
    /**
     * Seed or refresh schedules for a single Clone after compileRuntime().
     * No-op if schedules already exist and are current.
     */
    refreshForClone(cloneId: string, companyId: string): Promise<number>;
}
//# sourceMappingURL=scheduler.d.ts.map