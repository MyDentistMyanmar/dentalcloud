export const REPORT_URL_BATCH_SIZE = 20;
export const REPORT_REQUEST_CONCURRENCY = 3;

export const chunkUniqueIds = (ids: string[], size = REPORT_URL_BATCH_SIZE): string[][] => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const safeSize = Math.max(1, Math.floor(size));
  const batches: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += safeSize) {
    batches.push(uniqueIds.slice(index, index + safeSize));
  }
  return batches;
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> => {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }));

  return results;
};