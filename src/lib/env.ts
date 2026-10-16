// Public configuration. Missing values fail loudly at the point of use, never silently.
// The public key is accepted under either name Supabase uses: the newer "publishable" key or the legacy "anon" key.
// Each NEXT_PUBLIC_ variable is referenced literally so Next.js can inline it into browser code.
export const supabasePublicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined;

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = supabasePublicKey();
  if (!url || !anonKey) {
    throw new Error(
      `Supabase is not configured: ${[!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"].filter(Boolean).join(" and ")} missing. ` +
        "Locally, set them in .env.local (see .env.example). On Vercel, add them under Project → Settings → Environment Variables for Production and Preview, then redeploy: they are needed at build time.",
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabasePublicKey());
}

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
