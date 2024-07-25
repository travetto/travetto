import '@travetto/runtime';

declare global {
  interface TravettoEnv {
    /**
     * Docker support, if non-zero, acts as the docker namespace.
     * If 0, disables running if docker should even be considered when running a command service
     * @default undefined
     */
    TRV_DOCKER: boolean | string | undefined;
  }
}