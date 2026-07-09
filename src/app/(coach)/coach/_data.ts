// Helper: the set of class ids a coach is responsible for (primary or assigned).
export async function coachClassIds(supabase: any, coachId: string): Promise<string[]> {
  const [{ data: cc }, { data: cl }] = await Promise.all([
    supabase.from("class_coaches").select("class_id").eq("coach_id", coachId),
    supabase.from("classes").select("id").eq("coach_id", coachId),
  ]);
  const ids = new Set<string>();
  (cc ?? []).forEach((r: any) => ids.add(r.class_id));
  (cl ?? []).forEach((r: any) => ids.add(r.id));
  return [...ids];
}

// The set of session ids a coach is covering (approved coach-leave replacements
// where they are the substitute). Fetched separately from their own class
// sessions because a cover is per-SESSION, not per-class.
export async function coachCoverSessionIds(supabase: any, coachId: string): Promise<string[]> {
  const { data } = await supabase
    .from("coach_leave_requests")
    .select("session_id")
    .eq("replacement_coach_id", coachId)
    .eq("status", "approved");
  return [...new Set(((data ?? []) as any[]).map((r) => r.session_id))];
}
