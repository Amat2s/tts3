import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev project configuration.
 *
 * The project ref is selected by APP_ENV (development | production) via the
 * PROJECT_REFS map below, so the same config drives both Trigger.dev projects
 * without hand-editing this file. Set TRIGGER_PROJECT_REF to override. The npm
 * scripts (`dev`, `dev:prod`, `deploy`, `deploy:dev`) set APP_ENV for you.
 *
 * Jobs in this project are orchestration wrappers only. The `solver-job` task
 * is production-wired (Unit 56): in production it calls the deployed backend's
 * internal execute endpoint over HTTP (SOLVER_EXECUTE_URL), never running
 * solver business logic itself. See docs/trigger-dev-deployment.md.
 */
const PROJECT_REFS: Record<string, string> = {
  development: "proj_bmtqxqdddzxouqfewdiy",
  production: "proj_kwgyhghrnimqdhmwqjrr",
};

const appEnv = process.env.APP_ENV ?? "development";
const projectRef =
  process.env.TRIGGER_PROJECT_REF ?? PROJECT_REFS[appEnv] ?? PROJECT_REFS.development;

export default defineConfig({
  project: projectRef,
  runtime: "node",
  logLevel: "info",
  // v1 jobs are short orchestration wrappers; keep an explicit ceiling.
  maxDuration: 60,
  dirs: ["./src/trigger"],
});
