import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthExpiredError,
  UniqueViolationError,
  UploadError,
  uploadRecord,
  updateRecord,
} from './upload';

type ProgressEventLike = { lengthComputable: boolean; loaded: number; total: number };

class FakeXMLHttpRequest {
  static last: FakeXMLHttpRequest;

  upload = {
    onprogress: null as ((event: ProgressEventLike) => void) | null,
  };
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: FormData) {
    this.body = body;
    FakeXMLHttpRequest.last = this;
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  respond(status: number, payload: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadRecord', () => {
  it('maps text fields and file parts onto a multipart body', async () => {
    const file = new File(['rom-bytes'], 'gothicvania.sfc', { type: 'application/octet-stream' });
    const pending = uploadRecord('games', {
      title: 'Gothicvania',
      slug: 'gothicvania',
      rom_size: 524288,
      is_primary: true,
      ignored: undefined,
    }, { rom: file });

    const xhr = FakeXMLHttpRequest.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toMatch('/api/collections/games/records');

    const body = xhr.body!;
    expect(body.get('title')).toBe('Gothicvania');
    expect(body.get('rom_size')).toBe('524288');
    expect(body.get('is_primary')).toBe('true');
    expect(body.get('ignored')).toBeNull();
    expect((body.get('rom') as File).name).toBe('gothicvania.sfc');

    xhr.respond(200, { id: 'rec1' });
    await expect(pending).resolves.toEqual({ id: 'rec1' });
  });

  it('reports upload progress and a final 100 percent', async () => {
    const progress: number[] = [];
    const pending = uploadRecord('games', { title: 'X' }, {}, (percent) => progress.push(percent));

    const xhr = FakeXMLHttpRequest.last;
    xhr.progress(25, 100);
    xhr.progress(50, 100);
    xhr.respond(200, { id: 'rec1' });
    await pending;

    expect(progress).toEqual([25, 50, 100]);
  });

  it('sends the admin auth token when present', async () => {
    const { adminClient } = await import('./pb');
    adminClient.authStore.save('token-123', null);

    const pending = uploadRecord('games', { title: 'X' });
    const xhr = FakeXMLHttpRequest.last;
    expect(xhr.headers.Authorization).toBe('token-123');

    xhr.respond(200, {});
    await pending;
    adminClient.authStore.clear();
  });

  it('maps 401 to AuthExpiredError', async () => {
    const pending = uploadRecord('games', { title: 'X' });
    const xhr = FakeXMLHttpRequest.last;
    xhr.respond(401, { message: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it('maps a unique validation 400 to UniqueViolationError', async () => {
    const pending = uploadRecord('games', { title: 'X' });
    const xhr = FakeXMLHttpRequest.last;
    xhr.respond(400, {
      message: 'Failed to create record.',
      data: { rom_crc32: { code: 'validation_not_unique', message: 'Value must be unique' } },
    });

    await expect(pending).rejects.toBeInstanceOf(UniqueViolationError);
  });

  it('maps other failures to a generic UploadError with the server message', async () => {
    const pending = uploadRecord('games', { title: 'X' });
    const xhr = FakeXMLHttpRequest.last;
    xhr.respond(413, { message: 'File is too large.' });

    await expect(pending).rejects.toMatchObject({
      name: 'UploadError',
      status: 413,
      message: 'File is too large.',
    });
    await expect(pending).rejects.not.toBeInstanceOf(UniqueViolationError);
    expect(UploadError).toBeDefined();
  });
});

describe('updateRecord', () => {
  it('PATCHes the record by id', async () => {
    const pending = updateRecord('games', 'abc123', { title: 'New title' });
    const xhr = FakeXMLHttpRequest.last;
    expect(xhr.method).toBe('PATCH');
    expect(xhr.url).toMatch('/api/collections/games/records/abc123');

    xhr.respond(200, { id: 'abc123' });
    await pending;
  });
});
