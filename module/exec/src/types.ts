import * as child_process from 'child_process';

export interface ExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
  killed?: boolean;
}

export interface ExecutionOptions {
  timeout?: number;
  quiet?: boolean;
  stdin?: string | Buffer | NodeJS.ReadableStream;
  timeoutKill?: (proc: child_process.ChildProcess) => Promise<void>;
}

export interface CommandConfig {
  allowDocker: boolean;
  localCheck: (() => Promise<boolean>) | [string, string[]];
  localCommand: (args: string[]) => string[];

  containerImage: string;
  containerEntry: string;
  containerCommand: (args: string[]) => string[];
}
