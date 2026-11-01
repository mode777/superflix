import { useState, useSyncExternalStore } from 'react';
import { ImportQueue, type ImportQueueSnapshot } from './importQueue';

/**
 * Bind an `ImportQueue` instance into React: the instance lives for the
 * component's lifetime, and the snapshot re-renders on every transition.
 */
export function useImportQueue(): { queue: ImportQueue; snapshot: ImportQueueSnapshot } {
  const [queue] = useState(() => new ImportQueue());
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  return { queue, snapshot };
}
