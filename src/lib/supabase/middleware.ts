import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_STARTED_COOKIE,
  isSessionExpired,
  sessionCookieOptions,
  supabaseCookieOptions,
} from "@/lib/auth-session";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/admin");

  let effectiveUser = user;

  if (user) {
    const startedRaw = request.cookies.get(SESSION_STARTED_COOKIE)?.value;
    const startedAt = startedRaw ? Number(startedRaw) : NaN;

    if (!startedRaw || !Number.isFinite(startedAt)) {
      // Sesi lama tanpa marker — mulai hitung 6 jam dari sekarang
      supabaseResponse.cookies.set(
        SESSION_STARTED_COOKIE,
        String(Date.now()),
        sessionCookieOptions
      );
    } else if (isSessionExpired(startedAt)) {
      await supabase.auth.signOut();
      effectiveUser = null;
      supabaseResponse.cookies.set(SESSION_STARTED_COOKIE, "", {
        ...sessionCookieOptions,
        maxAge: 0,
      });

      if (isProtected || isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        if (isProtected) url.searchParams.set("next", path);
        url.searchParams.set("expired", "1");

        const redirect = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value);
        });
        return redirect;
      }
    }
  }

  if (!effectiveUser && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (effectiveUser && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
