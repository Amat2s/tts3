import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { logger, task } from "@trigger.dev/sdk/v3";

/**
 * Async solver job (Unit 45).
 *
 * Boundary rules (see jobs/README.md):
 * - This task is an ORCHESTRATION WRAPPER. It owns the job lifecycle:
 *   structured logging, timing, and returning a structured result.
 * - It contains NO solver business logic. The CP-SAT modeling, snapshot
 *   building, and result application all live in the backend Python solver
 *   services and run via `python -m solver.job_cli`.
 * - It is driven by a stable payload reference only and NEVER receives
 *   mutable frontend draft assignment state.
 * - Saved timetable state is preserved on failure by the backend result
 *   application service (Unit 43); this task just reports the outcome.
 *
 * The backend pipeline run by the bridge is:
 *   build_solver_input_snapshot (Unit 41)
 *     -> solve_timetable        (Unit 42)
 *     -> apply_solver_result    (Unit 43)
 */

export interface SolverJobPayload {
  /** Stable reference to this solver run; echoed in logs and result. */
  solverRunId: string;
  /** Caller-supplied id used to correlate logs across systems. */
  correlationId: string;
  /** Authenticated admin / workspace id, if already modeled (optional in v1). */
  adminWorkspaceId?: string;
  /** Saved-assignment snapshot id, if introduced later (optional in v1). */
  snapshotId?: string;
}

export type SolverJobStatus = "completed" | "partial" | "failed";

export interface SolverJobResult {
  status: SolverJobStatus;
  solverRunId: string;
  correlationId: string;
  /** Underlying CP-SAT status ("optimal"/"feasible"/...) or null on early failure. */
  solverStatus: string | null;
  sessionsAttempted: number;
  sessionsScheduled: number;
  sessionsUnscheduled: number;
  isPartial: boolean;
  timedOut: boolean;
  durationSeconds: number;
  message: string;
  /** Concise failure code on a failed run; null otherwise. */
  failureCode: string | null;
}

interface BridgeConfig {
  pythonBin: string;
  backendDir: string;
  scriptPath: string;
}

/**
 * Resolve how to invoke the backend Python solver bridge.
 *
 * `BACKEND_DIR` should be an ABSOLUTE path to the repo's `backend/` directory
 * (Trigger.dev does not set `process.cwd()` to `jobs/`, so a cwd-relative
 * default is unreliable — we only fall back to it for plain local runs).
 * `PYTHON_BIN` may be an absolute path, a path relative to `BACKEND_DIR`, or a
 * bare command on PATH (default `python`). Both are documented in
 * jobs/.env.example.
 */
function resolveBridge(): BridgeConfig {
  const backendDir = path.resolve(
    process.env.BACKEND_DIR ?? path.resolve(process.cwd(), "..", "backend"),
  );

  const rawPython = process.env.PYTHON_BIN ?? "python";
  // A bare command (no separator) is left for PATH lookup; anything that looks
  // like a path is resolved against backendDir when not already absolute.
  const looksLikePath = rawPython.includes("/") || rawPython.includes("\\");
  const pythonBin =
    looksLikePath && !path.isAbsolute(rawPython)
      ? path.resolve(backendDir, rawPython)
      : rawPython;

  const scriptPath = path.join(backendDir, "solver", "job_cli.py");
  return { pythonBin, backendDir, scriptPath };
}

interface BridgeOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runBridge(config: BridgeConfig, payloadJson: string): Promise<BridgeOutcome> {
  return new Promise((resolve, reject) => {
    // Invoke via `-m solver.job_cli` (NOT by file path): the `-m` form puts the
    // working directory on sys.path[0] so the `solver` package resolves, whereas
    // running the file by path would put `solver/` itself on the path and shadow
    // the stdlib `types` module with backend/solver/types.py. cwd is backendDir
    // (so the backend loads its `.env` relative to cwd); PYTHONPATH adds it too
    // as a fallback in case the runner overrides cwd handling.
    const child = spawn(config.pythonBin, ["-m", "solver.job_cli"], {
      cwd: config.backendDir,
      env: { ...process.env, PYTHONPATH: config.backendDir },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));

    child.stdin.write(payloadJson);
    child.stdin.end();
  });
}

/** Find the last line of stdout that parses as a JSON object. */
function parseResultLine(stdout: string): Record<string, unknown> | null {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep scanning earlier lines
    }
  }
  return null;
}

function failedResult(
  payload: SolverJobPayload,
  failureCode: string,
  message: string,
): SolverJobResult {
  return {
    status: "failed",
    solverRunId: payload.solverRunId,
    correlationId: payload.correlationId,
    solverStatus: null,
    sessionsAttempted: 0,
    sessionsScheduled: 0,
    sessionsUnscheduled: 0,
    isPartial: false,
    timedOut: false,
    durationSeconds: 0,
    message,
    failureCode,
  };
}

/** Map the Python result document (snake_case) into the TS result shape. */
function toResult(doc: Record<string, unknown>): SolverJobResult {
  return {
    status: (doc.status as SolverJobStatus) ?? "failed",
    solverRunId: String(doc.solver_run_id ?? ""),
    correlationId: String(doc.correlation_id ?? ""),
    solverStatus: (doc.solver_status as string | null) ?? null,
    sessionsAttempted: Number(doc.sessions_attempted ?? 0),
    sessionsScheduled: Number(doc.sessions_scheduled ?? 0),
    sessionsUnscheduled: Number(doc.sessions_unscheduled ?? 0),
    isPartial: Boolean(doc.is_partial ?? false),
    timedOut: Boolean(doc.timed_out ?? false),
    durationSeconds: Number(doc.duration_seconds ?? 0),
    message: String(doc.message ?? ""),
    failureCode: (doc.failure_code as string | null) ?? null,
  };
}

export const solverJob = task({
  id: "solver-job",
  // The backend CP-SAT solver defaults to a 30s time limit; keep headroom.
  maxDuration: 120,
  run: async (rawPayload: SolverJobPayload | string): Promise<SolverJobResult> => {
    // Defensive: a payload triggered with a pre-serialized JSON string arrives
    // here as a string, which would make every field below undefined. Parse it
    // back into an object so both encodings work.
    let payload: SolverJobPayload;
    if (typeof rawPayload === "string") {
      try {
        payload = JSON.parse(rawPayload) as SolverJobPayload;
      } catch {
        return failedResult(
          { solverRunId: "", correlationId: "" },
          "invalid_payload",
          "Solver job payload was a string that could not be parsed as JSON.",
        );
      }
    } else {
      payload = rawPayload;
    }
    if (!payload?.solverRunId || !payload?.correlationId) {
      return failedResult(
        { solverRunId: payload?.solverRunId ?? "", correlationId: payload?.correlationId ?? "" },
        "invalid_payload",
        "Solver job payload is missing solverRunId/correlationId.",
      );
    }

    logger.info("solver_job_started", {
      solverRunId: payload.solverRunId,
      correlationId: payload.correlationId,
      adminWorkspaceId: payload.adminWorkspaceId ?? null,
      snapshotId: payload.snapshotId ?? null,
    });

    const config = resolveBridge();

    // Fail fast with an actionable message if the bridge isn't reachable.
    if (!existsSync(config.backendDir)) {
      const message = `BACKEND_DIR does not exist: ${config.backendDir}. Set BACKEND_DIR in jobs/.env to an absolute path to the repo's backend/ directory.`;
      logger.error("solver_job_failed", {
        solverRunId: payload.solverRunId,
        correlationId: payload.correlationId,
        failureCode: "backend_dir_missing",
        backendDir: config.backendDir,
      });
      return failedResult(payload, "backend_dir_missing", message);
    }
    if (!existsSync(config.scriptPath)) {
      const message = `Solver bridge script not found: ${config.scriptPath}. Check BACKEND_DIR points at the backend/ directory.`;
      logger.error("solver_job_failed", {
        solverRunId: payload.solverRunId,
        correlationId: payload.correlationId,
        failureCode: "bridge_script_missing",
        scriptPath: config.scriptPath,
      });
      return failedResult(payload, "bridge_script_missing", message);
    }

    logger.debug("solver_job_bridge", {
      pythonBin: config.pythonBin,
      backendDir: config.backendDir,
      scriptPath: config.scriptPath,
    });

    // Only stable references cross the boundary — never draft assignments.
    const bridgePayload = JSON.stringify({
      solver_run_id: payload.solverRunId,
      correlation_id: payload.correlationId,
      admin_workspace_id: payload.adminWorkspaceId ?? null,
      snapshot_id: payload.snapshotId ?? null,
    });

    let outcome: BridgeOutcome;
    try {
      outcome = await runBridge(config, bridgePayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("solver_job_failed", {
        solverRunId: payload.solverRunId,
        correlationId: payload.correlationId,
        failureCode: "bridge_spawn_error",
        pythonBin: config.pythonBin,
        message,
      });
      return failedResult(
        payload,
        "bridge_spawn_error",
        `Failed to start solver bridge (PYTHON_BIN=${config.pythonBin}): ${message}`,
      );
    }

    const doc = parseResultLine(outcome.stdout);
    if (!doc) {
      // No parseable JSON on stdout — surface the Python stderr so the failure
      // is diagnosable from the run result itself.
      const stderrTail = outcome.stderr.trim().slice(-1500);
      logger.error("solver_job_failed", {
        solverRunId: payload.solverRunId,
        correlationId: payload.correlationId,
        failureCode: "bridge_output_error",
        exitCode: outcome.exitCode,
        stderr: outcome.stderr.slice(-2000),
      });
      return failedResult(
        payload,
        "bridge_output_error",
        `Solver bridge produced no parseable result (exit ${outcome.exitCode}). stderr: ${stderrTail || "(empty)"}`,
      );
    }

    const result = toResult(doc);

    if (result.status === "failed") {
      logger.error("solver_job_failed", {
        solverRunId: result.solverRunId,
        correlationId: result.correlationId,
        solverStatus: result.solverStatus,
        failureCode: result.failureCode,
        durationSeconds: result.durationSeconds,
        message: result.message,
      });
    } else {
      logger.info("solver_job_completed", {
        solverRunId: result.solverRunId,
        correlationId: result.correlationId,
        status: result.status,
        solverStatus: result.solverStatus,
        durationSeconds: result.durationSeconds,
        sessionsAttempted: result.sessionsAttempted,
        sessionsScheduled: result.sessionsScheduled,
        sessionsUnscheduled: result.sessionsUnscheduled,
        isPartial: result.isPartial,
        timedOut: result.timedOut,
      });
    }

    return result;
  },
});
