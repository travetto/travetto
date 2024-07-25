import '@travetto/runtime';

declare global {
  interface TravettoEnv {
    /** 
     * Where should optimized images be stored by default
     * @default undefined
     */
    TRV_IMAGE_CACHE: string;
  }
}