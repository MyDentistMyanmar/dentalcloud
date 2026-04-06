import * as tus from 'tus-js-client';
import { SupabaseStorageSettings } from '../types';

/**
 * Supabase Storage REST API utilities
 * Uses Supabase Storage TUS resumable upload API for large files.
 * Chunks are kept well below 90 MB so they always pass through the
 * Cloudflare tunnel (100 MB hard limit per request).
 */

/**
 * Check if Supabase Storage settings are ready
 */
export const isSupabaseStorageReady = (
  settings?: SupabaseStorageSettings | null
): settings is SupabaseStorageSettings => {
  return (
    !!settings &&
    !!settings.storageUrl?.trim() &&
    !!settings.anonKey?.trim() &&
    !!settings.bucket?.trim()
  );
};

/**
 * Normalize Supabase Storage base URL.
 * - Strips trailing slashes
 * - Forces HTTPS (required when the app is served over HTTPS — browsers block
 *   mixed HTTP/HTTPS requests and the self-hosted Supabase may return HTTP URLs)
 */
export const normalizeSupabaseStorageUrl = (rawUrl: string) =>
  rawUrl
    .trim()
    .replace(/\/+$/, '')              // strip trailing slashes
    .replace(/^http:\/\//i, 'https://'); // force HTTPS

/**
 * Convert any URL (potentially HTTP + non-standard port from the self-hosted
 * Supabase server) into the public HTTPS URL that goes through Cloudflare.
 *
 * Example:
 *   http://s3api.example.com:54321/storage/v1/upload/resumable/abc
 *   → https://s3api.example.com/storage/v1/upload/resumable/abc
 */
const toPublicHttpsUrl = (url: string): string =>
  url
    .replace(/^http:\/\//i, 'https://')            // http → https
    .replace(/^(https:\/\/[^/:]+):\d+(\/)/i, '$1$2'); // strip non-standard port

/**
 * Build public file URL for Supabase Storage
 * Format: {storageUrl}/storage/v1/object/public/{bucket}/{key}
 */
export const buildSupabasePublicUrl = (
  baseUrl: string,
  bucket: string,
  key: string
): string => {
  const normalized = normalizeSupabaseStorageUrl(baseUrl);
  return `${normalized}/storage/v1/object/public/${bucket}/${key}`;
};

/**
 * Choose an appropriate TUS chunk size based on the file size.
 * All chunks must be < 90 MB to safely pass through Cloudflare.
 * Supabase TUS requires chunk sizes that are multiples of 6 MB.
 *
 * Optimised for UNSTABLE internet connections — small chunks so each
 * request finishes quickly and failed chunks can be retried cheaply.
 */
const chooseTusChunkSize = (fileSize: number): number => {
  const MB = 1024 * 1024;
  // All files use 6 MB chunks — the smallest valid TUS chunk size.
  // This keeps each HTTP request short and retryable on flaky connections.
  // A 2 GB file = ~341 chunks, each finishing in seconds even on slow links.
  void fileSize; // kept for future tuning if network improves
  return 6 * MB;
};

/**
 * List files in Supabase Storage bucket
 * Uses Supabase REST API (POST /storage/v1/object/list/{bucket})
 */
export const listSupabaseStorageFiles = async (
  settings: SupabaseStorageSettings,
  prefix: string
): Promise<
  Array<{ key: string; size: number; lastModified: string }>
> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;

  const listUrl = `${storageUrl}/storage/v1/object/list/${bucket}`;

  const requestBody = {
    prefix: prefix || '',
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  };

  console.log('[Supabase Storage] List request:', {
    url: listUrl,
    bucket,
    prefix,
    body: requestBody
  });

  const response = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Supabase Storage] List failed:', {
      status: response.status,
      url: listUrl,
      error: errorText
    });
    throw new Error(
      `Supabase Storage list failed (${response.status}): ${errorText.substring(
        0,
        200
      )}`
    );
  }

  const files = await response.json();

  console.log('[Supabase Storage] Raw list response:', {
    fileCount: files?.length || 0,
    files: files?.map((f: any) => ({ name: f.name, id: f.id })) || []
  });

  // Supabase Storage list API strips the prefix from returned file names.
  // Prepend it to reconstruct the full key.
  const result = (files || []).map((file: any) => ({
    key: prefix ? `${prefix}${file.name}` : file.name,
    size: file.metadata?.size || 0,
    lastModified: file.updated_at || file.created_at || ''
  }));

  console.log('[Supabase Storage] List response:', {
    prefix,
    bucket,
    fileCount: result.length,
    files: result.map((f: any) => f.key)
  });

  return result;
};

/**
 * Upload a file to the self-hosted Supabase Storage using TUS resumable
 * chunked uploads.
 *
 * ## Why we do the TUS creation POST ourselves
 *
 * When we let tus-js-client do the initial POST, the self-hosted Supabase
 * responds with a `Location` header that contains the server's *internal*
 * HTTP URL (e.g. `http://host:54321/storage/v1/upload/resumable/<id>`).
 * tus-js-client then tries to send PATCH requests to that HTTP URL — which
 * the browser immediately blocks with a Mixed Content error because the
 * app is served over HTTPS.
 *
 * Fix: we do the POST ourselves, grab the `Location` header, rewrite it to
 * HTTPS and strip the non-standard port, then hand the clean URL to
 * tus-js-client via the `uploadUrl` option.  With `uploadUrl` set, tus-js-
 * client skips its own POST entirely and goes straight to PATCH requests
 * against the URL we provide — which is the correct public HTTPS URL.
 *
 * Features:
 *  - 6 MB chunk size (smallest valid Supabase TUS chunk; good for slow links)
 *  - Exponential-backoff retry on transient network errors
 *  - Abort on storage-settings change via `shouldAbort`
 *  - Progress and chunk-complete callbacks
 */
export const uploadSupabaseStorageFile = async (
  settings: SupabaseStorageSettings,
  key: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
  _onChunkComplete?: (
    chunkSize: number,
    bytesAccepted: number,
    bytesTotal: number
  ) => void,
  shouldAbort?: () => boolean
): Promise<void> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;
  const tusEndpoint = `${storageUrl}/storage/v1/upload/resumable`;
  const chunkSize = chooseTusChunkSize(file.size);

  console.log(
    `[Supabase Storage TUS] Starting upload "${file.name}" ` +
    `(${(file.size / 1024 / 1024).toFixed(2)} MB, ` +
    `${(chunkSize / 1024 / 1024).toFixed(0)} MB chunks)`
  );

  // ── Step 1: Create the TUS upload slot ─────────────────────────────────────
  // We do this with our own fetch() so that we can intercept and fix the
  // Location header before tus-js-client ever sees it.
  const metadataHeader = [
    `bucketName ${btoa(bucket)}`,
    `objectName ${btoa(key)}`,
    `contentType ${btoa(file.type || 'application/octet-stream')}`,
    `cacheControl ${btoa('3600')}`
  ].join(',');

  const createResp = await fetch(tusEndpoint, {
    method: 'POST',
    headers: {
      'Content-Length': '0',
      'Upload-Length': String(file.size),
      'Tus-Resumable': '1.0.0',
      'Upload-Metadata': metadataHeader,
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`,
      'x-upsert': 'true'
    }
  });

  if (createResp.status !== 201) {
    const body = await createResp.text().catch(() => '');
    throw new Error(
      `TUS upload creation failed (${createResp.status}): ${body.substring(0, 300)}`
    );
  }

  // ── Step 2: Normalise the Location URL to public HTTPS ─────────────────────
  // The self-hosted server returns its internal HTTP URL with port, e.g.:
  //   http://s3api.example.com:54321/storage/v1/upload/resumable/<id>
  // We must rewrite it to HTTPS without the port so it routes through
  // the Cloudflare tunnel — otherwise the browser blocks it (mixed content).
  const rawLocation = createResp.headers.get('Location') ?? '';
  if (!rawLocation) {
    throw new Error(
      'Supabase TUS server did not return a Location header after upload creation.'
    );
  }
  const uploadUrl = toPublicHttpsUrl(rawLocation);

  console.log(
    `[Supabase Storage TUS] Upload slot created.\n` +
    `  Raw Location : ${rawLocation}\n` +
    `  Public HTTPS : ${uploadUrl}`
  );

  // ── Step 3: Stream all chunks via tus-js-client PATCH requests ─────────────
  // Because we supply uploadUrl, tus-js-client skips its own POST and uses
  // our pre-created, HTTPS-normalised URL for every PATCH request.
  await new Promise<void>((resolve, reject) => {
    let aborted = false;

    const upload = new tus.Upload(file, {
      uploadUrl,   // ← pre-created & HTTPS-normalised; no POST from tus
      chunkSize,
      retryDelays: [0, 2000, 4000, 8000, 16000, 32000, 60000, 60000],
      headers: {
        apikey: settings.anonKey,
        Authorization: `Bearer ${settings.anonKey}`
      },
      removeFingerprintOnSuccess: true,

      onProgress: (bytesUploaded, bytesTotal) => {
        if (shouldAbort && shouldAbort() && !aborted) {
          aborted = true;
          upload.abort(true).finally(() =>
            reject(new Error('Storage settings changed during upload. Please retry.'))
          );
          return;
        }
        if (onProgress) onProgress(bytesUploaded, bytesTotal);
      },

      onChunkComplete: (chunkSz, bytesAccepted, bytesTotal) => {
        if (shouldAbort && shouldAbort() && !aborted) {
          aborted = true;
          upload.abort(true).finally(() =>
            reject(new Error('Storage settings changed during upload. Please retry.'))
          );
          return;
        }
        console.log(
          `[Supabase Storage TUS] Chunk done – ` +
          `${(bytesAccepted / 1024 / 1024).toFixed(1)} / ` +
          `${(bytesTotal / 1024 / 1024).toFixed(1)} MB`
        );
        if (_onChunkComplete) _onChunkComplete(chunkSz, bytesAccepted, bytesTotal);
      },

      onSuccess: () => {
        if (shouldAbort && shouldAbort()) {
          reject(new Error('Storage settings changed during upload. Please retry.'));
          return;
        }
        console.log(`[Supabase Storage TUS] Upload complete: "${key}"`);
        resolve();
      },

      onError: (error) => {
        if (aborted) return;
        const msg = error?.message || String(error);
        console.error('[Supabase Storage TUS] Upload error:', msg);

        if (msg.includes('413') || msg.toLowerCase().includes('too large')) {
          reject(new Error('File chunk rejected as too large.'));
        } else if (msg.includes('timeout') || msg.toLowerCase().includes('network')) {
          reject(new Error('Network timeout. Please check your connection and try again.'));
        } else if (msg.includes('403') || msg.toLowerCase().includes('permission')) {
          reject(new Error('Permission denied. Please check your storage bucket policies and keys.'));
        } else {
          reject(new Error(`Upload failed: ${msg}`));
        }
      }
    });

    upload.start();
  });
};

/**
 * Delete file from Supabase Storage
 * Uses Supabase REST API (DELETE /storage/v1/object/{bucket})
 */
export const deleteSupabaseStorageFile = async (
  settings: SupabaseStorageSettings,
  key: string
): Promise<void> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;
  const deleteUrl = `${storageUrl}/storage/v1/object/${bucket}`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`
    },
    body: JSON.stringify({ prefixes: [key] })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Supabase Storage delete failed (${response.status}): ${errorText.substring(
        0,
        200
      )}`
    );
  }
};
