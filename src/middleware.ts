import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes publiques (pas besoin d'auth)
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/cgu") ||
    pathname.startsWith("/confidentialite") ||
    pathname.startsWith("/mentions-legales");

  // Routes admin — accessibles uniquement aux emails dans ADMIN_EMAILS
  const isAdminRoute = pathname.startsWith("/admin");

  // Page d'attente de validation
  const isPendingPage = pathname === "/pending-approval";

  // Non-authentifié → /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const adminEmailsRaw = process.env.ADMIN_EMAILS || "contact@datavocat.fr";
    const adminEmails = adminEmailsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = (user.email || "").toLowerCase();
    const isAdmin = adminEmails.includes(userEmail);
    const isApproved =
      isAdmin || user.user_metadata?.approved === true;

    // Admin uniquement pour /admin*
    if (isAdminRoute && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // User non-approuvé → /pending-approval pour tout ce qui n'est pas public/admin/pending
    if (!isApproved && !isPublicRoute && !isAdminRoute && !isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }

    // User approuvé sur /pending-approval → renvoyer sur /
    if (isApproved && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public assets (images, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
