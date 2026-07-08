"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { dict } from "@/lib/i18n";

// Password input with a show/hide toggle, so an admin can see exactly what
// they're setting before creating the account (a masked typo silently created
// accounts with an unrecoverable password).
export function PasswordField({ required, locale }: { required?: boolean; locale?: string | null }) {
  const L = dict(locale);
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        name="password"
        autoComplete="new-password"
        required={required}
        className="pr-16"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-slate-500 hover:text-slate-800"
        aria-label={show ? L.pw_hide_aria : L.pw_show_aria}
      >
        {show ? L.pw_hide : L.pw_show}
      </button>
    </div>
  );
}
