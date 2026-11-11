"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/app/actions";
import { SubmitButton } from "./ui";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <div className="sim bg-surface p-6 sm:p-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-5 text-center text-ink-2">{footer}</p>
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input {...props} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink-2" />
    </label>
  );
}

function FormError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{state.error}</p>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full" pendingText="Masuk…">Masuk</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label="Nama" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      <Field label="Password (minimal 8 karakter)" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Ulangi password" name="password2" type="password" autoComplete="new-password" minLength={8} required />
      <label className="flex items-start gap-3 text-sm text-ink-2">
        <input type="checkbox" name="setuju" value="1" required defaultChecked={Boolean(state?.values)} className="mt-0.5 size-4 accent-[var(--ink)]" />
        <span>Saya tidak akan memakai nomor untuk penipuan, spam, atau kegiatan ilegal, dan setuju dengan <Link href="/aturan" className="underline" target="_blank">aturan pemakaian</Link>.</span>
      </label>
      <SubmitButton className="w-full" pendingText="Membuat akun…">Buat akun</SubmitButton>
    </form>
  );
}
