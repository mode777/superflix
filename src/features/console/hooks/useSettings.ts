import { useSyncExternalStore } from 'react';
import { emulatorService } from '../services';
import type { EmulatorSettings } from '../types';

export function useSettings(): EmulatorSettings {
  return useSyncExternalStore(
    (listener) => emulatorService.subscribeSettings(listener),
    () => emulatorService.getSettings(),
    () => emulatorService.getSettings(),
  );
}
