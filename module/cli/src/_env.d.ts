import '@travetto/base';

declare global {
  interface TrvEnv {
    /** 
     * Provides an IPC http url for the CLI to communicate with. 
     * This facilitates cli-based invocation for external usage.
     */
    TRV_CLI_IPC: string;
    /** 
     * Determines (assuming the operation supports it), that restart behavior can trigger  
     */
    TRV_CAN_RESTART: boolean;
  }
}