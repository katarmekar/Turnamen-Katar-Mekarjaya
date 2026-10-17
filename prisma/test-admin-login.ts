import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@admin.com",
    password: "admin1",
  });

  console.log("ok:", Boolean(data.session));
  console.log("err:", error?.message ?? null);
  console.log("user:", data.user?.email ?? null);
}

main();
