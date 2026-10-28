import { useSyncExternalStore } from 'react';
import { emulatorService } from '../services';
import type { RuntimeState } from '../types';

export function useRuntime(): RuntimeState {
  return useSyncExternalStore(
    (listener) => emulatorService.subscribeRuntime(listener),
    () => emulatorService.getRuntime(),
    () => emulatorService.getRuntime(),
  );
}
