export const APP_NAME = "Hong Badminton Academy";
export const APP_SHORT = "HBA";

// Rows per page for the admin directory tables. Defined here (a server-safe
// module) — NOT in the "use client" paginator — because server components
// (StudentsList, PeopleList) read it for slicing/range. A const exported from a
// "use client" file resolves to a client reference (undefined) on the server,
// which silently makes `slice(0, NaN)` return zero rows.
export const PAGE_SIZE = 25;

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  coach: "Coach",
  parent: "Parent",
};

export interface NavItem {
  href: string;
  label: string;
  // Only super-admins see this item (branches, staff, settings, fee plans).
  superOnly?: boolean;
}

// Admin sidebar — split two tiers to cut cognitive load. ADMIN_PRIMARY is the
// lean ~5 things used every day; it renders flat, always visible, directly under
// the pinned Dashboard. Everything else lives in ADMIN_ADVANCED, tucked behind a
// single collapsed "Advanced (N)" toggle in AppShell. Nothing is removed — power
// tools stay one tap away. "Dashboard" itself is pinned by AppShell, not listed.
export const ADMIN_PRIMARY: NavItem[] = [
  { href: "/admin/attendance/matrix", label: "Attendance" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/people", label: "Directory" },
  { href: "/admin/invoices", label: "Invoices & Payments" },
  { href: "/admin/leads", label: "Trial Leads" },
];

export const ADMIN_ADVANCED: { group: string; items: NavItem[] }[] = [
  {
    group: "Scheduling",
    items: [
      { href: "/admin/classes", label: "Classes & Schedule" },
      { href: "/admin/leave", label: "Leave & Makeup" },
    ],
  },
  {
    group: "Teaching",
    items: [
      { href: "/admin/coaches/summary", label: "Coaches & Payroll" },
      { href: "/admin/at-risk", label: "At-risk" },
      { href: "/admin/leaderboard", label: "Leaderboard" },
      { href: "/admin/exams", label: "Exams & Progress" },
      { href: "/admin/training", label: "Training Syllabus" },
      { href: "/admin/rewards", label: "Reward Rules" },
    ],
  },
  {
    group: "Finance & Comms",
    items: [
      { href: "/admin/collections", label: "Collections" },
      { href: "/admin/club", label: "Club", superOnly: true },
      { href: "/admin/calculator", label: "Fee Calculator" },
      { href: "/admin/announce", label: "Announcements" },
      { href: "/admin/messages", label: "WhatsApp Log" },
      { href: "/admin/fee-plans", label: "Fee Plans", superOnly: true },
    ],
  },
  {
    group: "Costs",
    items: [
      { href: "/admin/court-rentals", label: "Court Rentals", superOnly: true },
    ],
  },
  {
    group: "Insights & Setup",
    items: [
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/reports", label: "Reports & Export" },
      { href: "/admin/holidays", label: "Holidays" },
      { href: "/admin/settings", label: "Settings", superOnly: true },
    ],
  },
  {
    group: "Organization",
    items: [
      { href: "/admin/branches", label: "Branches", superOnly: true },
      { href: "/admin/staff", label: "Staff & Admins", superOnly: true },
    ],
  },
];

// "Dashboard" is pinned by AppShell, so it is omitted from these lists.
// Order matters: the mobile bottom-tab bar shows Home + these items.
export const COACH_NAV: NavItem[] = [
  { href: "/coach/checkin", label: "Check-in & mark" },
  { href: "/coach/schedule", label: "Schedule" },
  { href: "/coach/assess", label: "Monthly Marks" },
  { href: "/coach/exams", label: "Assessments" },
  { href: "/coach/payroll", label: "My Payroll" },
];

export const PARENT_NAV: NavItem[] = [
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/schedule", label: "Schedule" },
  { href: "/parent/reports", label: "Monthly Report" },
  { href: "/parent/scorecards", label: "Progress Card" },
  { href: "/parent/invoices", label: "Fees & Payments" },
];
