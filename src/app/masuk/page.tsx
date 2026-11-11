import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, LoginForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/app" } = await searchParams;
  if (await getUser()) redirect(next.startsWith("/") ? next : "/app");
  return (
    <AuthCard title="Masuk" footer={<>Belum punya akun? <Link href="/daftar" className="font-bold text-ink underline">Daftar</Link></>}>
      <LoginForm next={next} />
    </AuthCard>
  );
}
