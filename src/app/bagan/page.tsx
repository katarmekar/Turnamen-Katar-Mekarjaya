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

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader
        profile={profile}
        showBagan={profile?.role === "admin"}
      />
      <main className="mx-auto max-w-[90rem] px-4 py-10">
        <AdminSectionNav homeHref="/" />
        <div className="mt-4">
          <TournamentBracketView tournament={tournament} />
        </div>
      </main>
    </div>
  );
}
