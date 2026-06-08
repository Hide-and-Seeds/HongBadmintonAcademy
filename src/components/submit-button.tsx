"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { buttonClass } from "@/components/ui";

type Variant = "primary" | "secondary" | "danger" | "ghost";

// Submit button that disables + shows a pending label while the form action
// runs. Must be rendered inside a <form action={…}>.
export function SubmitButton({
  children,
  variant = "primary",
  pendingText,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant, className)}
      {...props}
    >
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
