import { NostalgistEmulatorService } from './nostalgistEmulatorService';
import type { EmulatorService } from './emulator';

export type { EmulatorService, LoadRomOptions } from './emulator';

export const emulatorService: EmulatorService = new NostalgistEmulatorService();
