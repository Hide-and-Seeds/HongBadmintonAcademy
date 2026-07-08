"use client";

import { buttonClass } from "@/components/ui";
import { dict } from "@/lib/i18n";

// Submit button that asks for confirmation first. Use inside a <form action=…>.
export function ConfirmButton({
  label,
  confirmText,
  variant = "danger",
  locale,
}: {
  label?: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  locale?: string | null;
}) {
  const L = dict(locale);
  const msg = confirmText ?? L.cb_are_you_sure;
  return (
    <button
      type="submit"
      className={buttonClass(variant)}
      onClick={(e) => {
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {label ?? L.del_word}
    </button>
  );
}
