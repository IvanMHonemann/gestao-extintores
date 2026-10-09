import { getPool } from "./db";

type Rule = { limit: number; windowSeconds: number; blockSeconds?: number };
const fallback = new Map<string, { start: number; count: number; blockedUntil: number }>();

export async function consumeRateLimit(key: string, rule: Rule): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % rule.windowSeconds);
  const blockedUntil = now + (rule.blockSeconds ?? rule.windowSeconds);
  const pool = process.env.NODE_ENV === "test" ? null : await getPool().catch(() => null);
  if (pool) {
    await pool.query(`INSERT INTO security_rate_limits (rateKey, windowStart, hitCount, blockedUntil) VALUES (?, ?, 1, 0) ON DUPLICATE KEY UPDATE hitCount = IF(windowStart <> VALUES(windowStart), 1, hitCount + 1), windowStart = IF(windowStart <> VALUES(windowStart), VALUES(windowStart), windowStart), blockedUntil = IF(hitCount + 1 >= ?, VALUES(blockedUntil), blockedUntil)`, [key, windowStart, rule.limit, blockedUntil]);
    const [rows] = await pool.query<any[]>("SELECT hitCount, windowStart, blockedUntil FROM security_rate_limits WHERE rateKey = ? LIMIT 1", [key]);
    const row = rows[0];
    const retry = Math.max(1, Number(row?.blockedUntil || 0) > now ? Number(row.blockedUntil) - now : windowStart + rule.windowSeconds - now);
    return { allowed: Number(row?.blockedUntil || 0) <= now && Number(row?.hitCount || 0) <= rule.limit, retryAfter: retry };
  }
  const current = fallback.get(key);
  const entry = !current || current.start !== windowStart ? { start: windowStart, count: 1, blockedUntil: 0 } : { ...current, count: current.count + 1 };
  if (entry.count > rule.limit) entry.blockedUntil = blockedUntil;
  fallback.set(key, entry);
  return { allowed: entry.blockedUntil <= now && entry.count <= rule.limit, retryAfter: Math.max(1, (entry.blockedUntil || windowStart + rule.windowSeconds) - now) };
}

export async function clearRateLimit(key: string) {
  fallback.delete(key);
  const pool = process.env.NODE_ENV === "test" ? null : await getPool().catch(() => null);
  if (pool) await pool.query("DELETE FROM security_rate_limits WHERE rateKey = ?", [key]);
}

export const RATE_RULES = {
  loginEmail: { limit: 5, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  loginIp: { limit: 20, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  recovery: { limit: 3, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  signupIp: { limit: 5, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  publicPlans: { limit: 60, windowSeconds: 60, blockSeconds: 60 },
  authenticated: { limit: 300, windowSeconds: 60, blockSeconds: 60 },
  webhook: { limit: 120, windowSeconds: 60, blockSeconds: 60 },
} as const;
