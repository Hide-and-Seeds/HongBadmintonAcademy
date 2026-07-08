"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from "react";
import { buttonClass } from "@/components/ui";
import { dict } from "@/lib/i18n";

// Drop-in multi-select for any server-rendered table.
//
//   <BulkProvider>
//     <table>
//       <th><BulkSelectAll /></th>           ← header checkbox
//       <td><BulkCheckbox id={row.id} /></td> ← one per row
//     </table>
//     <BulkBar action={deleteMany} label="session" />  ← floating delete bar
//   </BulkProvider>
//
// Checkboxes are plain client state (not form fields), so they never clash with
// the per-row action <form>s already in the table. The bar submits the selected
// ids to a server action via its own form.

type Ctx = {
  selected: Set<string>;
  allIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  register: (id: string) => void;
  unregister: (id: string) => void;
};

const BulkCtx = createContext<Ctx | null>(null);

function useBulk(): Ctx {
  const ctx = useContext(BulkCtx);
  if (!ctx) throw new Error("Bulk components must live inside <BulkProvider>");
  return ctx;
}

export function BulkProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allIds, setAllIds] = useState<Set<string>>(new Set());

  const register = useCallback((id: string) => {
    setAllIds((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setAllIds((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setSelected((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((s) => (s.size >= allIds.size && allIds.size > 0 ? new Set() : new Set(allIds)));
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return (
    <BulkCtx.Provider
      value={{ selected, allIds, isSelected, toggle, toggleAll, clear, register, unregister }}
    >
      {children}
    </BulkCtx.Provider>
  );
}

const checkboxClass =
  "h-4 w-4 cursor-pointer rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500/30";

export function BulkCheckbox({ id }: { id: string }) {
  const { isSelected, toggle, register, unregister } = useBulk();
  useEffect(() => {
    register(id);
    return () => unregister(id);
  }, [id, register, unregister]);
  return (
    <input
      type="checkbox"
      checked={isSelected(id)}
      onChange={() => toggle(id)}
      className={checkboxClass}
      aria-label="Select row"
    />
  );
}

export function BulkSelectAll() {
  const { selected, allIds, toggleAll } = useBulk();
  const allChecked = allIds.size > 0 && selected.size >= allIds.size;
  return (
    <input
      type="checkbox"
      checked={allChecked}
      onChange={toggleAll}
      className={checkboxClass}
      aria-label="Select all"
    />
  );
}

export function BulkBar({
  action,
  label = "item",
  hidden = [],
  confirmText,
  locale,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** singular noun, e.g. "session" → "3 sessions selected" */
  label?: string;
  /** extra hidden fields, e.g. class_id */
  hidden?: { name: string; value: string }[];
  /** confirm prompt; "{n}" is replaced with the count */
  confirmText?: string;
  locale?: string | null;
}) {
  const L = dict(locale);
  const { selected, clear } = useBulk();
  const n = selected.size;
  if (n === 0) return null;
  const ids = [...selected];
  return (
    <div className="sticky bottom-4 z-10 mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-slate-700">
        {L.bulk_selected.replace("{n}", String(n)).replace("{label}", label)}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={clear} className={buttonClass("ghost")}>
          {L.clear_word}
        </button>
        <form
          action={action}
          onSubmit={(e) => {
            const msg = (confirmText ?? L.bulk_del_default.replace("{label}", label)).replace(
              "{n}",
              String(n),
            );
            if (!confirm(msg)) e.preventDefault();
            else clear();
          }}
        >
          {hidden.map((h) => (
            <input key={h.name} type="hidden" name={h.name} value={h.value} />
          ))}
          {ids.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <button type="submit" className={buttonClass("danger")}>
            {L.bulk_delete_sel}
          </button>
        </form>
      </div>
    </div>
  );
}
