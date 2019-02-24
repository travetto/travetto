import { ExecutionOptions } from '@travetto/exec';

export interface ChildOptions extends ExecutionOptions {
  cwd?: string;
  env?: any;
  stdio?: any;
  uid?: number;
  gid?: number;
}

export interface CommEvent {
  type?: string;
  [key: string]: any;
}

export type Status = 'init' | 'release' | 'destroy';

export type StatusChangeHandler = (status: Status) => any;

export interface SpawnConfig {
  command: string;
  args?: string[];
  fork?: boolean;
  opts?: ChildOptions;
}