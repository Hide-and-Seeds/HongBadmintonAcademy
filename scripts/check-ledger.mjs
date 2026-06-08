import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const embed = await db.from("reward_ledger").select("points, students(full_name)");
console.log("EMBED error:", embed.error?.message ?? "none");
console.log("EMBED data :", JSON.stringify(embed.data));
const plain = await db.from("reward_ledger").select("points, student_id");
console.log("PLAIN error:", plain.error?.message ?? "none");
console.log("PLAIN data :", JSON.stringify(plain.data));
