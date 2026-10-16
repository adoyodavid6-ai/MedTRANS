import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/** Resets the synthetic first-time patient so the welcome/consent journey runs fresh, then re-seeds. */
export default async function globalSetup() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.phone === "254700000001" || u.phone === "254700000010") await admin.auth.admin.deleteUser(u.id);
  }
  execSync("npx tsx scripts/seed-dev.ts", { stdio: "inherit" });
}
