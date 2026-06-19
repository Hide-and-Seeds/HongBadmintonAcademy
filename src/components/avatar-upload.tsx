"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";

// Photo picker with live preview. The selected file posts with the form; the
// server action uploads it (see uploadStudentPhoto). Falls back to the initials
// Avatar when there's no photo yet.
export function AvatarUpload({
  name,
  currentUrl,
  label,
}: {
  name: string;
  currentUrl?: string | null;
  label: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const src = preview ?? currentUrl ?? null;
  return (
    <div className="flex items-center gap-4">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <Avatar name={label || "?"} size={64} />
      )}
      <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
        {src ? "Change photo" : "Choose photo"}
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
    </div>
  );
}
