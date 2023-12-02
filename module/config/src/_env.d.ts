import '@travetto/base';

declare global {
  interface TrvEnv {
    /** 
     * Configuration profiles, in addition to TRV_ENV
     */
    TRV_PROFILES: string[];
  }
}