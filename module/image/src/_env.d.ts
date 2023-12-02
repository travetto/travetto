import '@travetto/base';

declare global {
  interface TrvEnv {
    /** 
     * Where should optimized images be stored by default
     * @default undefined
     */
    TRV_IMAGE_CACHE: string;
  }
}