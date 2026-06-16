"use client";

import { useState } from "react";
import { Field, Input, Select, Button, buttonClass } from "@/components/ui";
import { createSession } from "@/app/(admin)/admin/sessions/actions";

// "+ Add session" button that opens a modal with the one-off session form.
// Posts to the createSession server action (which redirects back).
export function AddSessionModal({
  classes,
  monthStr,
  today,
}: {
  classes: { id: string; name: string }[];
  monthStr: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonClass("primary")} onClick={() => setOpen(true)}>
        + Add session
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add a session</h2>
                <p className="text-xs text-slate-500">A one-off or makeup class on a specific date.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
            </div>

            {classes.length > 0 ? (
              <form action={createSession} className="space-y-4">
                <input type="hidden" name="month" value={monthStr} />
                <Field label="Class" required>
                  <Select name="class_id" required defaultValue="">
                    <option value="" disabled>— pick a class —</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Date" required>
                    <Input type="date" name="session_date" required defaultValue={today} />
                  </Field>
                  <Field label="Start" required>
                    <Input type="time" name="start_time" required defaultValue="18:00" />
                  </Field>
                  <Field label="End" required>
                    <Input type="time" name="end_time" required defaultValue="19:30" />
                  </Field>
                </div>
                <Field label="Location (optional)">
                  <Input name="location" placeholder="e.g. Court 1" />
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>Cancel</button>
                  <Button type="submit">Add session</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-slate-500">No active classes yet — create a class first.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
