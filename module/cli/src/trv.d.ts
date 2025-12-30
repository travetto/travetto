import '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
    /** 
     * Provides an IPC http url for the CLI to communicate with. 
     * This facilitates cli-based invocation for external usage.
     */
    TRV_CLI_IPC: string;
    /** 
     * Overrides behavior for allowing restart on changes 
     */
    TRV_RESTART_ON_CHANGE: boolean;
  }
}