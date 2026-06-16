import { redirect } from "next/navigation";

// Admin attendance is surfaced as the matrix only (for now). The live check-in,
// overview and per-session roster pages remain reachable by direct URL.
export default function AttendancePage() {
  redirect("/admin/attendance/matrix");
}
