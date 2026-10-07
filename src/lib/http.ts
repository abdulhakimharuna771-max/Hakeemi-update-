import { NextResponse } from 'next/server';

/**
 * Determining the origin a visitor actually used.
 *
 * `request.url` is built from the address the server is bound to, not from the
 * visitor's address bar: a dev server listening on 0.0.0.0 reports
 * `http://0.0.0.0:3000`, and behind a proxy it reports the internal address too.
 * A redirect or an email link built from it would send the browser to a host it
 * cannot reach — and would drop the visitor's session onto the wrong origin.
 *
 * So the Host header (or a proxy's X-Forwarded-Host, which takes precedence) is
 * the source of truth, with a relative Location header as the fallback, since a
 * browser resolves that against the URL it already has.
 */

/** Addresses that are never a real visitor-facing hostname. */
const BIND_ADDRESSES = new Set(['0.0.0.0', '::', '[::]', '']);

/** The visitor-facing host, or null when only a bind address is available. */
export function publicHost(headers: Headers): string | null {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').trim();
  if (!host) return null;

  const hostname = host.split(':')[0].toLowerCase();
  if (BIND_ADDRESSES.has(hostname) || BIND_ADDRESSES.has(host)) return null;

  return host;
}

/** Scheme for the host: proxies state it, development hosts are plain http. */
export function publicProtocol(headers: Headers, host: string): string {
  const forwarded = (headers.get('x-forwarded-proto') ?? '').trim();
  if (forwarded) return forwarded;

  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return 'http';
  }
  return 'https';
}

/**
 * Absolute origin for links that leave the app (email confirmation redirects),
 * with an explicit fallback for the rare case where no Host is available.
 */
export function publicOrigin(headers: Headers, fallback = 'http://localhost:3000'): string {
  const host = publicHost(headers);
  if (!host) return fallback.replace(/\/+$/, '');
  return `${publicProtocol(headers, host)}://${host}`;
}

/**
 * Redirect to an internal path.
 *
 * Only internal paths are accepted — the caller never forwards a user-supplied
 * destination unchanged, so this cannot become an open redirect.
 */
export function redirectTo(request: Request, path: string, status: 307 | 303 = 307): NextResponse {
  const host = publicHost(request.headers);

  if (host) {
    const proto = publicProtocol(request.headers, host);
    return NextResponse.redirect(new URL(path, `${proto}://${host}`), status);
  }

  return new NextResponse(null, { status, headers: { location: path } });
}
