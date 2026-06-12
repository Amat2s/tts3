import { defineConfig } from "@trigger.dev/sdk/v3";

/**
 * Trigger.dev project configuration.
 *
 * `project` must be the project ref shown in your Trigger.dev dashboard
 * (looks like `proj_abcdefg1234567`). It is the only value that must be
 * replaced before `npm run dev` can connect — see jobs/README.md.
 *
 * Jobs in this project are orchestration wrappers only. The production
 * solver job is intentionally NOT wired here yet (see Unit 44 spec).
 */
export default defineConfig({
  project: "proj_kwgyhghrnimqdhmwqjrr",
  runtime: "node",
  logLevel: "info",
  // v1 jobs are short orchestration wrappers; keep an explicit ceiling.
  maxDuration: 60,
  dirs: ["./src/trigger"],
});
