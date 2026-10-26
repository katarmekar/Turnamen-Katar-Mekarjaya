import type { Profile } from "@prisma/client";
import type { ReactNode } from "react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";

type AdminPageShellProps = {
  profile: Profile;
  showBagan?: boolean;
  homeHref?: string;
  homeLabel?: string;
  /** Label kecil di atas judul (opsional) */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Shell panel admin: header + nav/judul sticky, konten bisa di-scroll.
 */
export function AdminPageShell({
  profile,
  showBagan = true,
  homeHref = "/admin/panel",
  homeLabel = "Dashboard",
  eyebrow,
  title,
  description,
  actions,
  children,
}: AdminPageShellProps) {
  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader
        profile={profile}
        showBagan={showBagan}
        below={
          <>
            <AdminSectionNav homeHref={homeHref} homeLabel={homeLabel} />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
                    {eyebrow}
                  </p>
                ) : null}
                <h1
                  className={`font-[family-name:var(--font-display)] text-4xl tracking-wide text-white sm:text-5xl ${
                    eyebrow ? "mt-1" : ""
                  }`}
                >
                  {title}
                </h1>
                {description ? (
                  <div className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {description}
                  </div>
                ) : null}
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {actions}
                </div>
              ) : null}
            </div>
          </>
        }
      />
      <main className="content-frame py-6">{children}</main>
    </div>
  );
}
