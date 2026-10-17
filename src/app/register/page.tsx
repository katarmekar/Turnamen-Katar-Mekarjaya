import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { registerCaptain } from "@/app/actions/auth";

export default function RegisterPage() {
  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="panel p-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
            Daftar manajer
          </h1>
          <p className="mt-2 mb-6 text-sm text-[var(--muted)]">
            Buat akun untuk mendaftarkan tim ke turnamen.
          </p>
          <AuthForm mode="register" action={registerCaptain} />
        </div>
      </main>
    </div>
  );
}
