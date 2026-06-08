// One-off: delete a class by id. node --env-file=.env.local scripts/del-class.mjs <id>
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const id = process.argv[2];
const { error } = await db.from("classes").delete().eq("id", id);
console.log(error ? "error: " + error.message : "deleted class " + id);
