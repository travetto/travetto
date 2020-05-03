import { ExecUtil } from '@travetto/boot';

type ExecutionOptions = ReturnType<(typeof ExecUtil)['getOpts']>;

// TODO: Document
export interface ChildOptions extends ExecutionOptions {
  cwd?: string;
  env?: any;
  stdio?: any;
  uid?: number;
  gid?: number;
}

export type Status = 'init' | 'release' | 'destroy';

export type StatusChangeHandler = (status: Status) => any;

// TODO: Document
export interface SpawnConfig {
  command: string;
  args?: string[];
  fork?: boolean;
  opts?: ChildOptions;
}