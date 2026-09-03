import type { PapercutApi } from '../../shared/ipc';

declare global {
  interface Window {
    readonly papercut: PapercutApi;
    /**
     * Development only: a test driver can stand in for the native
     * file-picker dialog, which automation cannot click (CL-0020 hook
     * family). Only read behind import.meta.env.DEV — dead code in
     * production builds.
     */
    __papercutDevChooseImages?: () => Promise<readonly string[]>;
  }
}

export {};
