import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, RegisterForm } from "@/components/AuthForms";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Daftar" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getUser()) redirect("/app");
  return (
    <AuthCard title="Buat akun" footer={<>Sudah punya akun? <Link href="/masuk" className="font-bold text-ink underline">Masuk</Link></>}>
      <RegisterForm />
    </AuthCard>
  );
}
