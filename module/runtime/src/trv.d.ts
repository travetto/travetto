import { type ManifestModuleRole } from '@travetto/manifest';
import { type TimeSpan } from './time.ts';
type Role = Exclude<ManifestModuleRole, 'compile'>;

declare module "@travetto/runtime" {
  interface EnvData {
    /** 
     * The node environment we are running in
     * @default development
     */
    NODE_ENV: 'development' | 'production';
    /** 
     * Outputs all console.debug messages, defaults to `local` in dev, and `off` in prod. 
     */
    DEBUG: boolean | string;
    /** 
     * The role we are running as, allows access to additional files from the manifest during runtime.
     */
    TRV_ROLE: Role;
    /** 
     * The folders to use for resource lookup
     */
    TRV_RESOURCES: string[];
    /** 
     * Resource path overrides
     * @private
     */
    TRV_RESOURCE_OVERRIDES: Record<string, string>;
    /** 
     * The max time to wait for shutdown to finish after initial SIGINT, 
     * @default 2s
     */
    TRV_SHUTDOWN_WAIT: TimeSpan | number;
    /** 
     * The time to wait for stdout to drain during shutdown
     * @default 0s
     */
    TRV_SHUTDOWN_STDOUT_WAIT: TimeSpan | number;
    /**
     * The desired runtime module 
     */
    TRV_MODULE: string;
    /**
     * The location of the manifest file
     * @default undefined
     */
    TRV_MANIFEST: string;
    /**
     * trvc log level
     */
    TRV_BUILD: 'none' | 'info' | 'debug' | 'error' | 'warn';
    /**
     * Should break on first line of a method when using the @DebugBreak decorator
     * @default false
     */
    TRV_DEBUG_BREAK: boolean;
  }
}