"use client";

import { buttonClass } from "@/components/ui";

// Small client button — the poster page itself is a server component (it renders
// the QR server-side), so the print trigger lives here. Hidden when printing.
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={`${buttonClass("primary")} print:hidden`}>
      🖨️ Print poster
    </button>
  );
}
