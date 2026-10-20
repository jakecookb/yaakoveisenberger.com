import 'server-only';
import { createFundServiceClient } from './supabase/server';
import { isServiceRoleConfigured, serverEnv } from './env';

/**
 * Best-effort client IP. Cloudflare sets cf-connecting-ip, Vercel sets
 * x-real-ip / x-forwarded-for. Only trust these behind those proxies.
 */
export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ];
  for (const c of candidates) {
    const ip = c?.trim();
    if (ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip)) return ip;
  }
  return null;
}

export function getCountry(headers: Headers) {
  return headers.get('cf-ipcountry') ?? headers.get('x-vercel-ip-country') ?? null;
}

/**
 * App-level rate limit backed by Postgres (works without Redis/Upstash). Your edge
 * WAF (Cloudflare / Vercel Firewall) should enforce coarser limits in front of this.
 * Fails open if the database is unreachable so donors are never locked out by an outage.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  if (!isServiceRoleConfigured()) return true;
  const { data, error } = await createFundServiceClient().rpc('fund_check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[fund] rate limit check failed', error.message);
    return true;
  }
  return Boolean(data);
}

export async function isIpBlocked(ip: string | null) {
  if (!ip || !isServiceRoleConfigured()) return false;
  const { data } = await createFundServiceClient()
    .from('fund_flagged_ips')
    .select('is_blocked, expires_at')
    .eq('ip', ip)
    .maybeSingle<{ is_blocked: boolean; expires_at: string | null }>();
  return Boolean(data?.is_blocked && (!data.expires_at || new Date(data.expires_at) > new Date()));
}

/** Cloudflare Turnstile verification — skipped when TURNSTILE_SECRET_KEY is not set. */
export async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = serverEnv().turnstileSecret;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients; still guarded by rate limits
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requestOrigin(request: Request) {
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
