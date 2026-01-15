import '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
    /** 
     * Configuration profiles
     */
    TRV_PROFILES: string[];
  }
}