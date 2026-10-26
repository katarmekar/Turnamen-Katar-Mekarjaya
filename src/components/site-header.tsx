"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { Profile } from "@prisma/client";
import { logout } from "@/app/actions/auth";

type SiteHeaderProps = {
  profile?: Profile | null;
  /**
   * Tampilkan link Bagan (hanya jika sudah login).
   * Admin: kirim true setelah turnamen dipilih.
   * Manajer: biasanya false — bagan ada di dashboard.
   */
  showBagan?: boolean;
  /**
   * Mode ringkas untuk halaman utama manajer:
   * sembunyikan Bagan / Tim / Dashboard (menu digabung di panel).
   */
  compactNav?: boolean;
  /** Konten sticky di bawah header (nav section + judul). */
  below?: ReactNode;
};

function homeHref(profile?: Profile | null) {
  if (profile?.role === "admin") return "/admin";
  if (profile?.role === "captain") return "/dashboard";
  return "/";
}

export function SiteHeader({
  profile,
  showBagan = false,
  compactNav = false,
  below,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const baganVisible = !!profile && !compactNav && showBagan;
  const showCaptainLinks =
    !!profile && !compactNav && profile.role === "captain";
  const showHubLink = !!profile && !compactNav;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const closeOnDesktop = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  const navLinkClass = "site-nav-link";

  return (
    <div className="site-header-stack">
      <header className="site-header">
        <div className="content-frame site-header-inner">
          <Link
            href={homeHref(profile)}
            className="site-brand"
            onClick={() => setOpen(false)}
          >
            MekarJaya Turnamen
          </Link>

          <button
            type="button"
            className="site-menu-toggle"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Tutup" : "Menu"}
          </button>

          <nav
            id="site-nav"
            className={open ? "site-nav site-nav--open" : "site-nav"}
          >
            {baganVisible && (
              <Link
                href="/bagan"
                className={navLinkClass}
                onClick={() => setOpen(false)}
              >
                Bagan
              </Link>
            )}
            {profile ? (
              <>
                {showCaptainLinks && (
                  <Link
                    href="/dashboard/tim"
                    className={navLinkClass}
                    onClick={() => setOpen(false)}
                  >
                    Tim
                  </Link>
                )}
                {showHubLink && (
                  <Link
                    href={profile.role === "admin" ? "/admin" : "/dashboard"}
                    className={navLinkClass}
                    onClick={() => setOpen(false)}
                  >
                    {profile.role === "admin" ? "Admin" : "Dashboard"}
                  </Link>
                )}
                <form action={logout} className="sm:ml-1">
                  <button type="submit" className="btn-ghost w-full sm:w-auto">
                    Keluar
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={navLinkClass}
                  onClick={() => setOpen(false)}
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="btn-primary mt-1 inline-flex justify-center sm:mt-0"
                  onClick={() => setOpen(false)}
                >
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {below ? (
        <div className="site-header-below">
          <div className="content-frame">{below}</div>
        </div>
      ) : null}
    </div>
  );
}
