"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type SectionNavProps = {
  /** Tujuan tombol Dashboard (default: panel turnamen aktif) */
  homeHref?: string;
  /** Label tombol dashboard (default: Dashboard) */
  homeLabel?: string;
  /** Fallback jika tidak ada history (default = homeHref) */
  backFallback?: string;
};

/**
 * Navigasi section: Kembali (history) + Dashboard.
 */
export function AdminSectionNav({
  homeHref = "/admin/panel",
  homeLabel = "Dashboard",
  backFallback,
}: SectionNavProps = {}) {
  const router = useRouter();
  const fallback = backFallback ?? homeHref;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push(fallback);
          }
        }}
        className="btn-ghost"
      >
        ← Kembali
      </button>
      <Link href={homeHref} className="btn-ghost">
        {homeLabel}
      </Link>
    </div>
  );
}
