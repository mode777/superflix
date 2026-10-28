import { adminClient } from './pb';

export type UploadProgress = (percent: number) => void;

/** Values accepted on the wire for a multipart text part. */
export type MultipartValue = string | number | boolean | null | undefined;

export class UploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

export class AuthExpiredError extends UploadError {
  constructor(message = 'Your admin session expired. Sign in again.') {
    super(401, message);
    this.name = 'AuthExpiredError';
  }
}

export class UniqueViolationError extends UploadError {
  constructor(message = 'A record with the same unique values already exists.') {
    super(400, message);
    this.name = 'UniqueViolationError';
  }
}

type JsonRecord = Record<string, unknown>;

function toFormData(
  fields: Record<string, MultipartValue>,
  files: Record<string, Blob | Blob[]>,
): FormData {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    form.append(name, typeof value === 'boolean' ? String(value) : String(value));
  }

  for (const [name, value] of Object.entries(files)) {
    const blobs = Array.isArray(value) ? value : [value];
    for (const blob of blobs) {
      const filename = blob instanceof File ? blob.name : name;
      form.append(name, blob, filename);
    }
  }

  return form;
}

function parseJson(text: string): JsonRecord | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return null;
  }
}

function isUniqueViolation(status: number, payload: JsonRecord | null): boolean {
  if (status !== 400) return false;
  const serialized = JSON.stringify(payload ?? {});
  return serialized.includes('validation_not_unique') || /unique/i.test(serialized);
}

function request<T>(
  method: 'POST' | 'PATCH',
  collection: string,
  id: string | null,
  fields: Record<string, MultipartValue>,
  files: Record<string, Blob | Blob[]>,
  onProgress?: UploadProgress,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const form = toFormData(fields, files);
    const base = adminClient.baseURL.replace(/\/$/, '');
    const path = id ? `${collection}/records/${id}` : `${collection}/records`;
    const xhr = new XMLHttpRequest();

    xhr.open(method, `${base}/api/collections/${path}`);

    const token = adminClient.authStore.token;
    if (token) xhr.setRequestHeader('Authorization', token);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    xhr.onload = () => {
      const payload = parseJson(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve((payload ?? {}) as T);
        return;
      }

      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : `Request failed (HTTP ${xhr.status}).`;

      if (xhr.status === 401 || xhr.status === 403) {
        reject(new AuthExpiredError());
      } else if (isUniqueViolation(xhr.status, payload)) {
        reject(new UniqueViolationError(message));
      } else {
        reject(new UploadError(xhr.status, message));
      }
    };

    xhr.onerror = () => reject(new UploadError(0, 'Network error while uploading.'));

    xhr.send(form);
  });
}

/** Create a record with optional file parts, reporting real upload progress. */
export function uploadRecord<T = JsonRecord>(
  collection: string,
  fields: Record<string, MultipartValue>,
  files: Record<string, Blob | Blob[]> = {},
  onProgress?: UploadProgress,
): Promise<T> {
  return request<T>('POST', collection, null, fields, files, onProgress);
}

/** Update a record (optionally replacing its files), reporting upload progress. */
export function updateRecord<T = JsonRecord>(
  collection: string,
  id: string,
  fields: Record<string, MultipartValue>,
  files: Record<string, Blob | Blob[]> = {},
  onProgress?: UploadProgress,
): Promise<T> {
  return request<T>('PATCH', collection, id, fields, files, onProgress);
}
