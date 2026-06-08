import { z } from "zod";

const optionalStr = z.string().trim().optional().transform((v) => (v ? v : null));
const classSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  level: optionalStr,
  description: optionalStr,
  coach_id: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  default_location: optionalStr,
  capacity: z.coerce.number().int().positive().optional().nullable().or(z.literal("")).transform((v) => (v === "" ? null : v)),
});

const cases = [
  { name: "Junior B", level: "", description: "", coach_id: "", default_location: "", capacity: "" },
  { name: "Junior B", level: "Beginner", description: "d", coach_id: "", default_location: "Court 1", capacity: "12" },
  { name: "Junior B", level: "", description: "", coach_id: "00000000-0000-0000-0000-000000000011", default_location: "", capacity: "" },
];

for (const c of cases) {
  const r = classSchema.safeParse(c);
  console.log(r.success ? "OK  " : "FAIL", JSON.stringify(c.capacity), "coach=" + JSON.stringify(c.coach_id),
    "=>", r.success ? JSON.stringify(r.data) : r.error.issues.map((i) => `${i.path}:${i.message}`).join("; "));
}
