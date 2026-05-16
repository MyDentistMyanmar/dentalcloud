import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  withRateLimit,
  createRateLimitedFunction,
  RateLimitError,
  resetRateLimit,
  resetAllRateLimits,
  RATE_LIMIT_PRESETS,
} from './rateLimiter';

describe('RateLimitError', () => {
  it('should create error with descriptive message', () => {
    const error = new RateLimitError('t:ep', 10, 60000);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toContain('t:ep');
    expect(error.retryAfterMs).toBe(60000);
  });
});

describe('withRateLimit', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('allows requests within limit', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const r = await withRateLimit('a', fn, { limit: 3, windowMs: 60000 });
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('rejects requests exceeding limit', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    for (let i=0;i<2;i++) await withRateLimit('b', fn, { limit: 2, windowMs: 60000 });
    await expect(withRateLimit('b', fn, { limit: 2, windowMs: 60000 })).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('does not call underlying fn when rate limited', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    await withRateLimit('c', fn, { limit: 1, windowMs: 60000 });
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(withRateLimit('c', fn, { limit: 1, windowMs: 60000 })).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('allows requests after window expires', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue('ok');
    await withRateLimit('d', fn, { limit: 1, windowMs: 100 });
    await expect(withRateLimit('d', fn, { limit: 1, windowMs: 100 })).rejects.toThrow(RateLimitError);
    vi.advanceTimersByTime(150);
    await withRateLimit('d', fn, { limit: 1, windowMs: 100 });
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('independent counters', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('separate counters for different keys', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const c = { limit: 2, windowMs: 60000 };
    for (let i=0;i<2;i++) await withRateLimit('x', fn, c);
    await expect(withRateLimit('x', fn, c)).rejects.toThrow(RateLimitError);
    for (let i=0;i<2;i++) await withRateLimit('y', fn, c);
    await expect(withRateLimit('y', fn, c)).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('RATE_LIMIT_PRESETS', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('AUTH: 5 then block', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    for (let i=0;i<5;i++) await withRateLimit('pa', fn, RATE_LIMIT_PRESETS.AUTH);
    await expect(withRateLimit('pa', fn, RATE_LIMIT_PRESETS.AUTH)).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(5);
  });
  it('REGISTRATION: 10 then block', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    for (let i=0;i<10;i++) await withRateLimit('pr', fn, RATE_LIMIT_PRESETS.REGISTRATION);
    await expect(withRateLimit('pr', fn, RATE_LIMIT_PRESETS.REGISTRATION)).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(10);
  });
  it('WRITE: 20 then block', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    for (let i=0;i<20;i++) await withRateLimit('pw', fn, RATE_LIMIT_PRESETS.WRITE);
    await expect(withRateLimit('pw', fn, RATE_LIMIT_PRESETS.WRITE)).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(20);
  });
  it('UPLOAD: 10 then block', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    for (let i=0;i<10;i++) await withRateLimit('pu', fn, RATE_LIMIT_PRESETS.UPLOAD);
    await expect(withRateLimit('pu', fn, RATE_LIMIT_PRESETS.UPLOAD)).rejects.toThrow(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(10);
  });
});


describe('resetRateLimit', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('resets counter for specific key', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const c = { limit: 1, windowMs: 60000 };
    await withRateLimit('rk', fn, c);
    await expect(withRateLimit('rk', fn, c)).rejects.toThrow(RateLimitError);
    resetRateLimit('rk');
    await withRateLimit('rk', fn, c);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('resetAllRateLimits', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('resets all counters', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const c = { limit: 1, windowMs: 60000 };
    await withRateLimit('ra1', fn, c); await withRateLimit('ra2', fn, c);
    await expect(withRateLimit('ra1', fn, c)).rejects.toThrow(RateLimitError);
    await expect(withRateLimit('ra2', fn, c)).rejects.toThrow(RateLimitError);
    resetAllRateLimits();
    await withRateLimit('ra1', fn, c); await withRateLimit('ra2', fn, c);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('createRateLimitedFunction', () => {
  beforeEach(() => { resetAllRateLimits(); });
  it('creates rate-limited wrapper', async () => {
    const inner = vi.fn().mockResolvedValue('data');
    const w = createRateLimitedFunction('cw', inner, { limit: 2, windowMs: 60000 });
    expect(await w('a')).toBe('data'); expect(await w('b')).toBe('data');
    await expect(w('c')).rejects.toThrow(RateLimitError);
    expect(inner).toHaveBeenCalledTimes(2);
  });
  it('passes arguments to underlying fn', async () => {
    const inner = vi.fn().mockResolvedValue('r');
    const w = createRateLimitedFunction('cw2', inner, { limit: 5, windowMs: 60000 });
    await w(1, 'b', true);
    expect(inner).toHaveBeenCalledWith(1, 'b', true);
  });
  it('propagates errors from underlying fn', async () => {
    const inner = vi.fn().mockRejectedValue(new Error('db'));
    const w = createRateLimitedFunction('cw3', inner, { limit: 5, windowMs: 60000 });
    await expect(w()).rejects.toThrow('db');
  });
});


