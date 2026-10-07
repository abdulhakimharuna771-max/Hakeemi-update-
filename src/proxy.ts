import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured, supabaseFetch } from '@/lib/supabase/config';
import { redirectTo } from '@/lib/http';

/**
 * Next.js 16 Proxy (previously middleware).
 *
 * Two jobs:
 *   1. Refresh the Supabase session cookie so an active applicant is not signed
 *      out mid-form, and keep the access token fresh for Server Components.
 *   2. Optimistically redirect signed-out visitors away from portal routes.
 *
 * This is NOT the authorisation boundary. Every protected page and server
 * action independently validates the session server-side (see src/lib/auth.ts),
 * because a proxy check alone can be bypassed.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // Bounded, so an unreachable project cannot hold up every navigation.
    global: { fetch: supabaseFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // with the Auth server, which is also what refreshes an expired session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // /track is authenticated by design: an application number is never enough on
  // its own to reveal an application, so there is no anonymous tracking route
  // to guess at.
  const requiresSession = pathname.startsWith('/portal') || pathname === '/track' || pathname.startsWith('/track/');

  if (!user && requiresSession) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return redirectTo(request, `/login?next=${next}`);
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return redirectTo(request, '/portal/dashboard');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation, so the
     * session cookie stays fresh without paying for every asset request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};
