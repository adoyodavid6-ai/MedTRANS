/**
 * Local development seed: one synthetic account per role. Never run against production.
 * Sign in with the phone number and the fixed code 123456 (see [auth.sms.test_otp] in supabase/config.toml).
 *
 *   npm run db:seed-dev
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to seed a non-local Supabase (${url}). This script is for local development only.`);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const DEV_ACCOUNTS = [
  { phone: "254700000001", name: "Test Patient", role: null, consented: false },
  { phone: "254700000002", name: "Test Doctor", role: "doctor", consented: true },
  { phone: "254700000003", name: "Test Nurse", role: "nurse", consented: true },
  { phone: "254700000004", name: "Test Pharmacist", role: "pharmacist", consented: true },
  { phone: "254700000005", name: "Test Pharmacy Admin", role: "pharmacy_admin", consented: true },
  { phone: "254700000006", name: "Test Courier", role: "courier", consented: true },
  { phone: "254700000007", name: "Test Support", role: "support", consented: true },
  { phone: "254700000008", name: "Test Admin", role: "admin", consented: true },
  { phone: "254700000009", name: "Test Responder", role: "emergency_responder", consented: true },
  { phone: "254700000010", name: "Second Patient", role: null, consented: true },
] as const;

async function main() {
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const acct of DEV_ACCOUNTS) {
    let user = existing?.users.find((u) => u.phone === acct.phone);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ phone: acct.phone, phone_confirm: true });
      if (error || !data.user) throw error ?? new Error("createUser failed");
      user = data.user;
    }
    await admin.from("profiles").update({ full_name: acct.name }).eq("id", user.id);
    if (acct.role) {
      const { count } = await admin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", acct.role)
        .is("revoked_at", null);
      if (!count) {
        const { error } = await admin.from("user_roles").insert({ user_id: user.id, role: acct.role });
        if (error) throw error;
      }
    }
    if (acct.consented) {
      const { count } = await admin.from("consent_records").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (!count) {
        await admin.from("consent_records").insert([
          { user_id: user.id, purpose: "terms_of_service", granted: true, policy_version: "dev-seed" },
          { user_id: user.id, purpose: "privacy_notice", granted: true, policy_version: "dev-seed" },
        ]);
      }
    }
    console.log(`+${acct.phone}  ${acct.name.padEnd(20)} ${acct.role ?? "patient"}`);
  }
  console.log("\nSign in at http://localhost:3000/sign-in with any number above and code 123456.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
