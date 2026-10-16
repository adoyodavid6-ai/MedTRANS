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
  await seedPharmacy();
  await seedDoctorCare();
  console.log("\nSign in at http://localhost:3000/sign-in with any number above and code 123456.");
}

/** Signs in as a seeded account with the local test code, so actions run under that user's real permissions. */
async function sessionFor(phone: string) {
  const client = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithOtp({ phone });
  const { error } = await client.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (error) throw error;
  return client;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as NonNullable<T>;
}

const userId = async (phone: string) => (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.phone === phone)!.id;

/**
 * A SYNTHETIC pharmacy for local development and tests. Every name, licence and number here is
 * fake and labelled as such. The real Nairobi pilot area is left untouched (inactive, no boundary).
 */
async function seedPharmacy() {
  const ops = await sessionFor("254700000008");

  await must(ops.from("countries").update({ is_active: true, regulatory_review_ref: "LOCAL-DEV-ONLY (synthetic)", regulatory_reviewed_at: new Date().toISOString() }).eq("code", "KE"), "activate KE");

  let area: { id: string } | null = (await ops.from("service_coverage_areas").select("id").eq("slug", "local-test-area").maybeSingle()).data;
  if (!area) {
    area = await must(ops.from("service_coverage_areas").insert({
      country_code: "KE", name: "Local test area (synthetic)", slug: "local-test-area",
      notes: "SYNTHETIC local development area. Not the confirmed pilot boundary.",
    }).select("id").single(), "area");
    await must(ops.rpc("admin_set_area_boundary", {
      area: area.id,
      geojson: JSON.stringify({ type: "Polygon", coordinates: [[[36.65, -1.45], [37.05, -1.45], [37.05, -1.15], [36.65, -1.15], [36.65, -1.45]]] }),
    }), "boundary");
    await must(ops.from("service_coverage_areas").update({ is_active: true }).eq("id", area.id), "activate area");
    await must(ops.from("coverage_area_services").insert({ area_id: area.id, module: "pharmacy", is_active: true, activated_at: new Date().toISOString() }), "module");
  }

  const fee = (await ops.from("platform_settings").select("key").eq("key", "pharmacy.service_fee_minor").maybeSingle()).data;
  if (!fee) {
    await must(ops.from("platform_settings").insert({
      key: "pharmacy.service_fee_minor", value: 5000, is_public: true,
      description: "SYNTHETIC local value. [[CONFIRM: service fee]]",
    }), "service fee");
  }

  let ph: { id: string } | null = (await ops.from("pharmacies").select("id").eq("slug", "synthetic-test-pharmacy").maybeSingle()).data;
  if (!ph) {
    ph = await must(ops.from("pharmacies").insert({
      name: "Synthetic Test Pharmacy", slug: "synthetic-test-pharmacy", country_code: "KE", area_id: area.id,
      address_line: "Test Plaza, Kenyatta Avenue (synthetic)", location: "SRID=4326;POINT(36.8172 -1.2864)",
      phone: "+254 700 000 999", verification_status: "verified", is_listed: true, delivery_radius_m: 15000, delivery_fee_minor: 15000,
      verified_hours: "Synthetic test hours: Mon–Sat 08:00–20:00",
    }).select("id").single(), "pharmacy");
    await must(ops.from("pharmacies").update({ is_accepting_orders: true }).eq("id", ph.id), "accepting");
    await must(ops.from("pharmacy_licences").insert({
      pharmacy_id: ph.id, licence_number: "SYNTHETIC-LOCAL-001", valid_until: `${new Date().getFullYear() + 1}-12-31`,
      status: "verified", check_method: "Synthetic local seed. Not a real licence.",
    }), "licence");
    await must(ops.from("pharmacy_staff").insert(
      { pharmacy_id: ph.id, user_id: await userId("254700000004"), staff_role: "pharmacist", registration_number: "SYNTHETIC-PHARM-01", registration_status: "verified" },
    ), "pharmacist");
    await must(ops.from("pharmacy_staff").insert({ pharmacy_id: ph.id, user_id: await userId("254700000005"), staff_role: "manager" }), "manager");
    await must(ops.from("courier_profiles").insert({
      user_id: await userId("254700000006"), verification_status: "verified", check_method: "Synthetic local seed.", is_available: true,
    }), "courier");

    const products = [
      { slug: "paracetamol-500mg-tablets", name: "Paracetamol 500 mg tablets", generic_name: "Paracetamol", strength: "500 mg", dosage_form: "Tablet", pack_size: "Pack of 24", requires_prescription: false, price: 12000, qty: 40 },
      { slug: "oral-rehydration-salts", name: "Oral rehydration salts", generic_name: "Oral rehydration salts", strength: "20.5 g sachet", dosage_form: "Powder for oral solution", pack_size: "Pack of 10", requires_prescription: false, price: 25000, qty: 15 },
      { slug: "amoxicillin-500mg-capsules", name: "Amoxicillin 500 mg capsules", generic_name: "Amoxicillin", strength: "500 mg", dosage_form: "Capsule", pack_size: "Pack of 21", requires_prescription: true, price: 45000, qty: 12 },
      { slug: "metformin-500mg-tablets", name: "Metformin 500 mg tablets", generic_name: "Metformin hydrochloride", strength: "500 mg", dosage_form: "Tablet", pack_size: "Pack of 28", requires_prescription: true, price: 30000, qty: 3 },
      { slug: "tramadol-50mg-capsules", name: "Tramadol 50 mg capsules", generic_name: "Tramadol hydrochloride", strength: "50 mg", dosage_form: "Capsule", pack_size: "Pack of 10", requires_prescription: true, is_controlled: true, price: 40000, qty: 10 },
    ];
    const staff = await sessionFor("254700000005");
    for (const { price, qty, ...p } of products) {
      const prod = await must(ops.from("medicine_products").insert({ is_controlled: false, ...p, vat_rate_bps: 0, is_active: true }).select("id").single(), p.slug);
      await must(staff.from("inventory_items").insert({ pharmacy_id: ph.id, product_id: prod.id, price_minor: price, quantity_available: qty }), `stock ${p.slug}`);
    }
  }

  // A pinned delivery address for the second patient, inside the synthetic area.
  const p2 = await sessionFor("254700000010");
  const hasAddr = (await p2.from("addresses").select("id").eq("label", "Home (synthetic)").maybeSingle()).data;
  if (!hasAddr) {
    await must(p2.from("addresses").insert({
      user_id: await userId("254700000010"), label: "Home (synthetic)", line1: "Test Estate, Ngong Road", area: "Kilimani",
      landmark: "Blue gate", location: "SRID=4326;POINT(36.7850 -1.2950)", is_default: true,
    }), "address");
  }
  console.log("Synthetic Test Pharmacy ready (local only).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** SYNTHETIC DoctorCare setup for local development: service on, screening marked reviewed by "local seed", one doctor. */
async function seedDoctorCare() {
  const ops = await sessionFor("254700000008");
  const area = await must(ops.from("service_coverage_areas").select("id").eq("slug", "local-test-area").single(), "area");
  const has = (await ops.from("coverage_area_services").select("area_id").eq("area_id", area.id).eq("module", "doctorcare").maybeSingle()).data;
  if (!has) await must(ops.from("coverage_area_services").insert({ area_id: area.id, module: "doctorcare", is_active: true, activated_at: new Date().toISOString() }), "dc module");

  const fee = (await ops.from("platform_settings").select("key").eq("key", "doctorcare.booking_fee_minor").maybeSingle()).data;
  if (!fee) await must(ops.from("platform_settings").insert({ key: "doctorcare.booking_fee_minor", value: 20000, is_public: true, description: "SYNTHETIC local value. [[CONFIRM: booking fee]]" }), "booking fee");

  await must(ops.from("care_screening_questions").update({
    clinically_reviewed_by: "SYNTHETIC LOCAL SEED: not a clinical review", clinically_reviewed_at: new Date().toISOString(),
  }).eq("is_active", true).is("clinically_reviewed_at", null), "screening");
  const svc = await must(ops.from("care_services").update({ is_active: true }).eq("slug", "gp-home-visit").select("id").single(), "service");

  const doctorId = await userId("254700000002");
  const doc = await sessionFor("254700000002");
  const exists = (await doc.from("provider_profiles").select("user_id").eq("user_id", doctorId).maybeSingle()).data;
  if (!exists) {
    await must(doc.from("provider_profiles").insert({
      user_id: doctorId, profession: "doctor", display_name: "Dr Test Doctor (synthetic)", regulator: "KMPDC", registration_number: "SYNTHETIC-DOC-01",
      bio: "Synthetic profile for local testing.", languages: ["en", "sw"], years_experience: 8,
      base_location: "SRID=4326;POINT(36.8000 -1.2900)", service_radius_m: 15000, travel_buffer_minutes: 30,
    }), "doctor profile");
    await must(doc.from("provider_services").insert({ provider_id: doctorId, service_id: svc.id, fee_minor: 250000 }), "doctor service");
    await must(doc.from("provider_weekly_hours").insert([0, 1, 2, 3, 4, 5, 6].map((d) => ({ provider_id: doctorId, weekday: d, start_time: "07:00", end_time: "21:00" }))), "hours");
    await must(ops.rpc("admin_set_provider_status", { p_provider: doctorId, p_status: "verified", p_check_method: "Synthetic local seed. Not a real registration check." }), "verify doctor");
    await must(doc.from("provider_profiles").update({ accepts_bookings: true }).eq("user_id", doctorId), "accepts");
  }
  console.log("Synthetic DoctorCare setup ready (local only).");
}
