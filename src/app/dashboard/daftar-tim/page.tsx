import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ActionForm } from "@/components/action-form-status";
import { RwScrollPicker } from "@/components/rw-scroll-picker";
import { TournamentRegisterSelect } from "@/components/tournament-register-select";
import { registerTeam } from "@/app/actions/team";
import { requireProfile } from "@/lib/auth";
import { COMPETITION_FORMAT_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ tournament?: string }>;
};

export default async function DaftarTimPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  const params = await searchParams;

  const myTeams = await prisma.team.findMany({
    where: { captainId: profile.id },
    select: { tournamentId: true },
  });
  const joinedIds = new Set(myTeams.map((t) => t.tournamentId));

  const openTournaments = await prisma.tournament.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { teams: { where: { status: "confirmed" } } },
      },
    },
  });

  const available = openTournaments.filter((t) => !joinedIds.has(t.id));

  const options = available.map((t) => {
    const confirmedCount = t._count.teams;
    return {
      id: t.id,
      name: t.name,
      feeLabel: formatIdr(t.registrationFee),
      maxTeams: t.maxTeams,
      confirmedCount,
      formatLabel:
        COMPETITION_FORMAT_LABEL[t.competitionFormat] ?? t.competitionFormat,
      slotsLeft: Math.max(0, t.maxTeams - confirmedCount),
    };
  });

  const hasJoinedAll =
    openTournaments.length > 0 && available.length === 0 && myTeams.length > 0;

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] hover:text-white"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          Daftar tim
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pilih turnamen yang masih membuka pendaftaran, lalu isi data tim.
        </p>

        {options.length === 0 ? (
          <div className="panel mt-6 space-y-3 p-6 text-sm text-[var(--muted)]">
            {hasJoinedAll ? (
              <>
                <p>
                  Anda sudah mendaftar di semua turnamen yang sedang open.
                </p>
                <Link
                  href="/dashboard/tim"
                  className="btn-primary inline-flex"
                >
                  Lihat tim saya
                </Link>
              </>
            ) : (
              <p>Tidak ada turnamen dengan status open saat ini.</p>
            )}
          </div>
        ) : (
          <div className="panel mt-6 space-y-4 p-6">
            <ActionForm action={registerTeam} className="flex flex-col gap-4">
              <TournamentRegisterSelect
                tournaments={options}
                defaultId={params.tournament}
              />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">Nama tim *</span>
                <input name="name" required className="input" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">RW</span>
                <RwScrollPicker name="city" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">No. HP kontak</span>
                <input
                  name="contact_phone"
                  className="input"
                  defaultValue={profile.phone ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">
                  Nama pelatih / kapten (opsional)
                </span>
                <input
                  name="coach_name"
                  className="input"
                  placeholder="Nama pelatih atau kapten"
                  defaultValue={profile.fullName ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">Logo (opsional)</span>
                <input
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="input"
                />
              </label>
              <button type="submit" className="btn-primary">
                Daftar & lanjut pembayaran
              </button>
            </ActionForm>
          </div>
        )}
      </main>
    </div>
  );
}
