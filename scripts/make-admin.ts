/**
 * Makes someone a platform admin (can create rental companies).
 *
 *   npm run admin:add -- you@example.com "Your Name"
 *
 * If the email has no account yet, an invite email is sent so they can set a password.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

config({ path: ".env.local", quiet: true });

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = z.email().safeParse(rawEmail?.trim().toLowerCase());
  if (!email.success) throw new Error('Usage: npm run admin:add -- you@example.com "Your Name"');
  const fullName = nameParts.join(" ").trim();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingId, error: findError } = await admin.rpc("find_user_id_by_email", { p_email: email.data });
  if (findError) throw findError;

  let userId = existingId as string | null;
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email.data, {
      data: { full_name: fullName },
      redirectTo: `${site}/auth/accept`,
    });
    if (error || !data.user) throw error ?? new Error("invite failed");
    userId = data.user.id;
    console.log(`Invite email sent to ${email.data}. Open the link in it to set your password.`);
  }

  const { error } = await admin.from("platform_admins").upsert({ user_id: userId });
  if (error) throw error;
  console.log(`${email.data} is now a platform admin. After signing in, open /admin.`);
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
