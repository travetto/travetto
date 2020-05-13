import { ExecutionOptions } from '@travetto/boot';

/**
 * Standard support for Spawn/Fork/Exec
 */
export interface ChildOptions extends ExecutionOptions {
  cwd?: string;
  env?: any;
  stdio?: any;
  uid?: number;
  gid?: number;
}

/**
 * Process status
 */
export type Status = 'init' | 'release' | 'destroy';

/**
 * Listen for changes in status
 */
export type StatusChangeHandler = (status: Status) => any;

/**
 * The specific config for spawning
 */
export interface SpawnConfig {
  command: string;
  args?: string[];
  fork?: boolean;
  opts?: ChildOptions;
}