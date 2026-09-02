import type { PapercutApi } from '../../shared/ipc';

declare global {
  interface Window {
    readonly papercut: PapercutApi;
  }
}

export {};
