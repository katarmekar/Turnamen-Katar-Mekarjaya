import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { login } from "@/app/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; expired?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="panel p-8">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
            Masuk
          </h1>
          <p className="mt-2 mb-6 text-sm text-[var(--muted)]">
            Masuk sebagai manajer tim atau admin.
          </p>
          {params.expired === "1" && (
            <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Sesi login berakhir (maksimal 6 jam). Silakan masuk lagi.
            </p>
          )}
          <AuthForm mode="login" action={login} nextPath={params.next} />
        </div>
      </main>
    </div>
  );
}
