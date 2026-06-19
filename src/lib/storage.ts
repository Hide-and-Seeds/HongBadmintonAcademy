import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX = 5 * 1024 * 1024; // 5 MB

// Upload a student photo to the public `student-photos` bucket (service role,
// bypasses storage RLS) and return its public URL. Returns null on unsupported
// type / too large / upload error — the caller then just keeps the old photo.
// Path is timestamped so the public URL changes on each upload (cache-busting).
export async function uploadStudentPhoto(studentId: string, file: File): Promise<string | null> {
  const ext = EXT[file.type];
  if (!ext || file.size === 0 || file.size > MAX) return null;
  const db = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `students/${studentId}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("student-photos").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return null;
  return db.storage.from("student-photos").getPublicUrl(path).data.publicUrl;
}
