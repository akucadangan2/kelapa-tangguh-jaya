"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ActionState } from "@/lib/action";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit?: string;
  variant?: "primary" | "danger" | "ghost";
  confirm?: string;
  reset?: boolean;
  className?: string;
  inline?: boolean;
};

/** Form dengan pesan sukses/gagal dari server action. */
export function ActionForm({ action, children, submit = "Simpan", variant = "primary", confirm, reset = true, className = "", inline }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);

  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={inline ? `inline-flex flex-wrap items-center gap-2 ${className}` : `space-y-4 ${className}`}
    >
      {children}
      <div className={inline ? "inline-flex items-center gap-2" : "flex flex-wrap items-center gap-3 pt-1"}>
        <Submit label={submit} variant={variant} />
        {state?.error && (
          <span key={state.t} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
            <XCircle size={16} /> {state.error}
          </span>
        )}
        {state?.ok && !inline && (
          <span key={state.t} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={16} /> {state.ok}
          </span>
        )}
      </div>
    </form>
  );
}

export function Submit({ label, variant = "primary" }: { label: string; variant?: "primary" | "danger" | "ghost" }) {
  const { pending } = useFormStatus();
  const c = {
    primary: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${c}`}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending ? "Memproses..." : label}
    </button>
  );
}