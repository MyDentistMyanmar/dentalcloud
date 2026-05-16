/**
 * Rate Limiter Utility
 * 
 * Implements a sliding-window rate limiter to protect critical API endpoints
 * from abuse, brute-force attacks, and accidental excessive calls.
 * 
 * Each endpoint key gets its own counter that resets after a configurable
 * time window. When the limit is exceeded, subsequent calls are rejected
 * with a RateLimitError.
 */

export class RateLimitError extends Error {
  public retryAfterMs: number;

  constructor(endpointKey: string, limit: number, windowMs: number) {
    const retryAfterSec = Math.ceil(windowMs / 1000);
    super(
      `Rate limit exceeded for "${endpointKey}". ` +
      `Maximum ${limit} requests per ${retryAfterSec}s. Please wait before retrying.`
    );
    this.name = 'RateLimitError';
    this.retryAfterMs = windowMs;
  }
}

interface RateLimitEntry {
  /** Timestamps (ms) of requests within the current window */
  timestamps: number[];
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000, // 1 minute
};

// In-memory store for rate limit entries (cleared on page refresh)
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup interval to evict stale entries (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (typeof window === 'undefined') return; // don't run in non-browser env
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries whose windows have fully expired
      const oldestRelevant = now - DEFAULT_CONFIG.windowMs;
      entry.timestamps = entry.timestamps.filter((t) => t >= oldestRelevant);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Check whether a request for the given endpoint key is allowed.
 * If allowed, record the request and return `true`.
 * If denied (rate limit exceeded), return `false`.
 */
function checkAndRecord(key: string, config: RateLimitConfig = DEFAULT_CONFIG): boolean {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
    startCleanupTimer();
  }

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t >= windowStart);

  if (entry.timestamps.length >= config.limit) {
    return false; // rate limited
  }

  entry.timestamps.push(now);
  return true;
}

/**
 * Reset the rate limit counter for a specific endpoint key.
 * Useful after a successful login to clear failed-attempt counters.
 */
export function resetRateLimit(endpointKey: string): void {
  store.delete(endpointKey);
}

/**
 * Reset all rate limit counters.
 */
export function resetAllRateLimits(): void {
  store.clear();
}

/**
 * Predefined rate limit presets for different endpoint severities.
 */
export const RATE_LIMIT_PRESETS = {
  /** Very strict: for authentication endpoints (5 requests / 60s) */
  AUTH: { limit: 5, windowMs: 60_000 } as RateLimitConfig,

  /** Strict: for patient registration and password changes (10 requests / 60s) */
  REGISTRATION: { limit: 10, windowMs: 60_000 } as RateLimitConfig,

  /** Moderate: for data writes like treatments, expenses, messages (20 requests / 60s) */
  WRITE: { limit: 20, windowMs: 60_000 } as RateLimitConfig,

  /** Moderate: for file uploads (10 requests / 60s) */
  UPLOAD: { limit: 10, windowMs: 60_000 } as RateLimitConfig,

  /** Loose: for reads that are still sensitive (30 requests / 60s) */
  SENSITIVE_READ: { limit: 30, windowMs: 60_000 } as RateLimitConfig,

  /** Default: general purpose */
  DEFAULT: DEFAULT_CONFIG,
};

/**
 * Execute a function with rate limiting applied.
 * 
 * @param endpointKey - Unique key identifying the endpoint (e.g. "auth:login")
 * @param fn - The async function to execute
 * @param config - Optional rate limit configuration
 * @returns The result of `fn`
 * @throws {RateLimitError} if rate limit is exceeded
 */
export async function withRateLimit<T>(
  endpointKey: string,
  fn: () => Promise<T>,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<T> {
  if (!checkAndRecord(endpointKey, config)) {
    throw new RateLimitError(endpointKey, config.limit, config.windowMs);
  }
  return fn();
}

/**
 * Create a rate-limited wrapper around an existing function.
 * 
 * @param endpointKey - Unique key identifying the endpoint
 * @param fn - The original function to wrap
 * @param config - Optional rate limit configuration
 * @returns A rate-limited version of the function
 */
export function createRateLimitedFunction<T extends (...args: any[]) => Promise<any>>(
  endpointKey: string,
  fn: T,
  config: RateLimitConfig = DEFAULT_CONFIG
): T {
  return ((...args: any[]) =>
    withRateLimit(endpointKey, () => fn(...args), config)) as unknown as T;
}
