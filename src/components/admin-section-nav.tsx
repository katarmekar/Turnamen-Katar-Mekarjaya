"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type SectionNavProps = {
  /** Tujuan tombol Home (default: panel admin) */
  homeHref?: string;
  /** Fallback jika tidak ada history (default = homeHref) */
  backFallback?: string;
};

/**
 * Navigasi section: Kembali (history) + Home.
 */
export function AdminSectionNav({
  homeHref = "/admin",
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
        Home
      </Link>
    </div>
  );
}
