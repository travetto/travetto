import * as child_process from 'child_process';

export type ExecutionOptions = {
  timeout?: number;
  quiet?: boolean;
  timeoutKill?: (proc: child_process.ChildProcess) => Promise<void>;
};

export interface ExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
  killed?: boolean;
}

export interface CommonProcess {
  pid: number;
  send?(message: any, sendHandle?: any): void;
  removeListener(name: string, f: Function): void;
  on(name: string, f: Function): void;
  removeAllListeners(name: string): void;
  kill(...args: any[]): void;
}

export interface ChildOptions extends ExecutionOptions {
  cwd?: string;
  env?: any;
  stdio?: any;
  uid?: number;
  gid?: number;
}

export interface ExecutionEvent {
  type: string;
  [key: string]: any;
}