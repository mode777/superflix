const DB_NAME = 'superflix';
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
    });
  }

  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb()
    .then(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, mode);
          const request = action(transaction.objectStore(STORE_NAME));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
        }),
    )
    .catch(() => undefined);
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T>('readonly', (store) => store.get(key));
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  await run('readwrite', (store) => store.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  await run('readwrite', (store) => store.delete(key));
}

export async function idbKeys(): Promise<string[]> {
  return (await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys()))?.map(String) ?? [];
}
