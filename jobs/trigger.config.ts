import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev project configuration.
 *
 * `project` must be the project ref shown in your Trigger.dev dashboard
 * (looks like `proj_abcdefg1234567`). It is the only value that must be
 * replaced before `npm run dev` can connect — see jobs/README.md.
 *
 * Jobs in this project are orchestration wrappers only. The `solver-job` task
 * is production-wired (Unit 56): in production it calls the deployed backend's
 * internal execute endpoint over HTTP (SOLVER_EXECUTE_URL), never running
 * solver business logic itself. See docs/trigger-dev-deployment.md.
 */
export default defineConfig({
  project: "proj_kwgyhghrnimqdhmwqjrr",
  runtime: "node",
  logLevel: "info",
  // v1 jobs are short orchestration wrappers; keep an explicit ceiling.
  maxDuration: 60,
  dirs: ["./src/trigger"],
});
