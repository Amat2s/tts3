import { logger, task } from "@trigger.dev/sdk/v3";

/**
 * Minimal test job for the jobs boundary.
 *
 * Boundary rules (see jobs/README.md):
 * - Jobs receive small payloads or input references, never mutable
 *   frontend draft state.
 * - Jobs orchestrate work by calling backend services; they contain no
 *   solver (CP-SAT) modeling and never query or mutate the database
 *   directly.
 * - This test job exists only to prove a job can be registered, run
 *   locally, and emit structured logs. It does no scheduling work.
 */

export interface TestJobPayload {
  /** Human-readable message echoed back in the result and logs. */
  message: string;
  /** Caller-supplied id used to correlate logs across systems. */
  correlationId: string;
  /** ISO-8601 timestamp describing when the job was requested. */
  timestamp: string;
}

export interface TestJobResult {
  ok: true;
  correlationId: string;
  message: string;
  requestedAt: string;
  completedAt: string;
}

export const testJob = task({
  id: "test-job",
  run: async (payload: TestJobPayload): Promise<TestJobResult> => {
    const completedAt = new Date().toISOString();

    logger.info("test_job_started", {
      correlationId: payload.correlationId,
      requestedAt: payload.timestamp,
    });

    // No solver execution, no timetable queries, no result persistence.
    // Future solver jobs will call backend services from here instead of
    // implementing any business logic inline.

    logger.info("test_job_completed", {
      correlationId: payload.correlationId,
      message: payload.message,
      requestedAt: payload.timestamp,
      completedAt,
    });

    return {
      ok: true,
      correlationId: payload.correlationId,
      message: payload.message,
      requestedAt: payload.timestamp,
      completedAt,
    };
  },
});
