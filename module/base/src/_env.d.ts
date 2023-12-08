import { ManifestModuleRole } from '@travetto/manifest';

import type { TimeSpan } from './time';

type Role = Exclude<ManifestModuleRole, 'std' | 'compile'>;

declare global {
  interface TrvEnv {
    /**
     * Flag for node to disable colors
     */
    NODE_DISABLE_COLORS: boolean;
    /** 
     * The node environment we are running in
     * @default development
     */
    NODE_ENV: 'development' | 'production';
    /** 
     * Enables color, even if `tty` is not available 
     * @default false
     */
    FORCE_COLOR: boolean | 0 | 1 | 2 | 3;
    /** 
     * Disables color even if `tty` is available
     * @default false
     */
    NO_COLOR: boolean;
    /**
     * Determines terminal color level
     */
    COLORTERM: string;
    /** 
     * Outputs all console.debug messages, defaults to `local` in dev, and `off` in prod. 
     */
    DEBUG: boolean | string;
    /** 
     * Environment to deploy, defaults to `NODE_ENV` if not `TRV_ENV` is not specified.  
     */
    TRV_ENV: string;
    /** 
     * Special role to run as, used to access additional files from the manifest during runtime.  
     */
    TRV_ROLE: Role;
    /** 
     * Whether or not to run the program in dynamic mode, allowing for real-time updates  
     */
    TRV_DYNAMIC: boolean;
    /** 
     * The folders to use for resource lookup
     */
    TRV_RESOURCES: string[];
    /** 
     * The max time to wait for shutdown to finish after initial SIGINT, 
     * @default 2s
     */
    TRV_SHUTDOWN_WAIT: TimeSpan | number;
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
    TRV_BUILD: 'none' | 'info' | 'debug' | 'error' | 'warn',
    /**
     * Cli operation mode, false means simple output
     */
    TRV_QUIET: boolean;
  }
}