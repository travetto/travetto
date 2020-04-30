import * as child_process from 'child_process';

// TODO: Document
export interface ExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
  killed?: boolean;
}

// TODO: Document
export interface ExecutionOptions {
  timeout?: number;
  quiet?: boolean;
  stdin?: string | Buffer | NodeJS.ReadableStream;
  timeoutKill?: (proc: child_process.ChildProcess) => Promise<void>;
}

// TODO: Document
export interface CommandConfig {
  allowDocker: boolean;
  localCheck: (() => Promise<boolean>) | [string, string[]];
  localCommand: (args: string[]) => string[];

  containerImage: string;
  containerEntry: string;
  containerCommand: (args: string[]) => string[];
}

// TODO: Document
export interface ExecutionState {
  result: Promise<ExecutionResult>;
  process: child_process.ChildProcess;
}