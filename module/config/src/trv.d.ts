import '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
    /** 
     * Configuration profiles, in addition to TRV_ENV
     */
    TRV_PROFILES: string[];
  }
}