import { redirect } from "next/navigation";

// Register was merged into Check-in (tap + mark on one screen). Keep the route
// as a redirect so old links/bookmarks still work.
export default function CoachAttendancePage() {
  redirect("/coach/checkin");
}
