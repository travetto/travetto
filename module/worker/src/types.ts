import { ExecutionOptions } from '@travetto/exec';

export interface ChildOptions extends ExecutionOptions {
  cwd?: string;
  env?: any;
  stdio?: any;
  uid?: number;
  gid?: number;
}

export interface WorkerEvent {
  type: string;
  [key: string]: any;
}

export interface CommonProcess {
  pid: number;
  stdin: NodeJS.WritableStream;
  stderr: NodeJS.ReadableStream;
  stdout: NodeJS.ReadableStream;
  send?(message: any, sendHandle?: any): void;
  removeListener(name: string, f: Function): void;
  on(name: string, f: Function): void;
  removeAllListeners(name: string): void;
  kill(...args: any[]): void;
  unref?(): void;
}

export interface WorkerPoolElement {
  active: boolean;
  id: any;
  kill(): any;
  release?(): any;
}

export interface WorkerInputSource<X> {
  hasNext(): boolean;
  next(): X | Promise<X>;
}