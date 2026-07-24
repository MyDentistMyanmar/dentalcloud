import { describe, expect, it } from 'vitest';
import { chunkUniqueIds, mapWithConcurrency, REPORT_URL_BATCH_SIZE } from './reportBatching';

describe('report request batching', () => {
  it('deduplicates IDs and keeps proxy URLs within the safe batch size', () => {
    const ids = [...Array.from({ length: 45 }, (_, index) => `id-${index}`), 'id-0', ''];
    const batches = chunkUniqueIds(ids);
    expect(batches.map(batch => batch.length)).toEqual([20, 20, 5]);
    expect(Math.max(...batches.map(batch => batch.length))).toBe(REPORT_URL_BATCH_SIZE);
  });

  it('bounds concurrency, preserves result order, and reports completion', async () => {
    let active = 0;
    let peak = 0;
    const progress: number[] = [];
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async value => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      return value * 10;
    }, completed => progress.push(completed));
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
  });
});