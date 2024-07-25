import '@travetto/runtime';

declare global {
  interface TravettoEnv {
    /** 
     * Configuration profiles, in addition to TRV_ENV
     */
    TRV_PROFILES: string[];
  }
}