"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
};

export function SiteHeader({
  profile,
  showBagan = false,
  compactNav = false,
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

  const navLinkClass =
    "block rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-white sm:inline sm:rounded-none sm:px-0 sm:py-0 sm:hover:bg-transparent";

  return (
    <header className="relative border-b border-white/10 bg-[var(--bg-elevated)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link
          href={profile?.role === "captain" ? "/dashboard" : "/"}
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-white"
          onClick={() => setOpen(false)}
        >
          Turnamen Bola
        </Link>

        {/* Jangan pakai .btn-ghost di sini — display:inline-flex menimpa sm:hidden */}
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
  );
}
