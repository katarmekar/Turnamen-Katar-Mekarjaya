import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { TournamentBracketView } from "@/components/tournament-bracket-view";
import { getCurrentProfile } from "@/lib/auth";
import { getTournamentForBracket } from "@/lib/tournament-bracket";

export default async function BaganPage() {
  let profile = null;
  let tournament = null;

  try {
    profile = await getCurrentProfile();
    tournament = await getTournamentForBracket();
  } catch {
    // DB offline
  }

  const hubHref =
    profile?.role === "admin"
      ? "/admin/panel"
      : profile?.role === "captain"
        ? "/dashboard"
        : "/";

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader
        profile={profile}
        showBagan={profile?.role === "admin"}
        below={<AdminSectionNav homeHref={hubHref} homeLabel="Beranda" />}
      />
      <main className="content-frame py-6">
        <TournamentBracketView tournament={tournament} />
      </main>
    </div>
  );
}
