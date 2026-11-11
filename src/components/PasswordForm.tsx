"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions";
import { Field } from "./AuthForms";
import { SubmitButton } from "./ui";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="mt-3 space-y-4 rounded-xl border border-line bg-surface p-5">
      {state?.error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-xl bg-signal/12 px-4 py-3 text-sm font-semibold text-signal">{state.ok}</p>}
      <Field label="Password lama" name="old" type="password" autoComplete="current-password" required />
      <Field label="Password baru" name="new" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Ulangi password baru" name="new2" type="password" autoComplete="new-password" minLength={8} required />
      <SubmitButton pendingText="Menyimpan…">Simpan password</SubmitButton>
    </form>
  );
}
