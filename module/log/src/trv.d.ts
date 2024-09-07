import '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
    /** 
     * Determines whether or not to augment console log information
     * @default false
     */
    TRV_LOG_PLAIN: boolean;
    /** 
     * Determines if we should log time when logging, 
     * @default ms
     */
    TRV_LOG_TIME: false | 'ms' | 's';
    /** 
     * Determines desired log format 
     * @default text
     */
    TRV_LOG_FORMAT: 'json' | 'text';
    /**
     * Log output location
     * @default console
     */
    TRV_LOG_OUTPUT: 'console' | 'file' | string;
  }
}