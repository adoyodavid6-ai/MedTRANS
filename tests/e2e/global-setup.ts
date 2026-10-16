import { execSync } from "node:child_process";

/** Every E2E run starts from a clean database plus the synthetic dev seed, so runs never depend on each other. */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_RESET !== "1") execSync("bash scripts/db-reset.sh", { stdio: "inherit" });
  execSync("npx tsx scripts/seed-dev.ts", { stdio: "inherit" });
}
