"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "", ...rest }:
  { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} disabled={pending || rest.disabled}
      className={`rounded-xl bg-ink px-5 py-3 font-display font-bold text-paper hover:opacity-90 disabled:opacity-60 ${className}`}>
      {pending ? pendingText ?? "Memproses…" : children}
    </button>
  );
}

export function CopyButton({ text, label = "Salin", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement("textarea");
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={`rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink-2 hover:border-ink-2 hover:text-ink ${className}`}>
      {done ? "Tersalin" : label}
    </button>
  );
}
