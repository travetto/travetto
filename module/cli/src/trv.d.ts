import '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
    /** 
     * Provides an IPC http url for the CLI to communicate with. 
     * This facilitates cli-based invocation for external usage.
     */
    TRV_CLI_IPC: string;
    /** 
     * Signals to the child they are the restart target
     */
    TRV_RESTART_TARGET: boolean;
    /** 
     * Overrides behavior for triggering debug session via IPC
     */
    TRV_DEBUG_IPC: boolean;
  }
}