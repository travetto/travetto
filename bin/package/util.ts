import { ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';

export type PackageType = {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  license?: string;
  repository?: {
    url: string;
    directory?: string;
  };
  author?: {
    email?: string;
    name?: string;
  };
  main: string;
  homepage?: string;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  keywords?: string[];

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
  trvDependencies?: Record<string, ('doc' | 'test' | 'all')[]>;
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

/**
 * Result of an execution
 */
export interface ExecutionResult {
  /**
   * Exit code
   */
  code: number;
  /**
   * Stdout as a string
   */
  stdout: string;
  /**
   * Stderr as a string
   */
  stderr: string;
  /**
   * Execution result message, should be inline with code
   */
  message?: string;
  /**
   * Whether or not the execution completed successfully
   */
  valid: boolean;
  /**
   * Whether or not the execution was killed
   */
  killed?: boolean;
}

/**
 * A result that supports catching as part of the promise resolution
 */
export type CatchableResult = Promise<ExecutionResult> & { catchAsResult?(): Promise<ExecutionResult> };

type ErrorWithMeta = Error & { meta?: ExecutionResult };

/**
 * Standard utilities for managing executions
 */
export class Util {
  static cwd = process.cwd().replaceAll('\\', '/');

  static resolveUnix(...pth: string[]): string {
    return path.resolve(this.cwd, ...pth).replaceAll('\\', '/');
  }

  static readPackage(folder: string): PackageType {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res: PackageType = JSON.parse(readFileSync(this.resolveUnix(folder, 'package.json'), 'utf8'));
    return res;
  }

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param proc The process to enhance
   * @param options The options to use to enhance the process
   * @param cmd The command being run
   */
  static enhanceProcess(proc: ChildProcess, key: string): CatchableResult {
    const res: CatchableResult = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timer: NodeJS.Timeout | number;
      let done = false;
      const finish = function (result: Omit<ExecutionResult, 'stderr' | 'stdout'>): void {
        if (done) {
          return;
        }
        if (timer) {
          clearTimeout(timer);
        }
        done = true;

        const final = {
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
          ...result
        };

        if (!final.valid) {
          const err: ErrorWithMeta = new Error(`Error executing ${key}: ${final.message || final.stderr || final.stdout || 'failed'}`);
          err.meta = final;
          reject(err);
        } else {
          resolve(final);
        }
      };

      proc.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      proc.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

    });

    res.catchAsResult = (): Promise<ExecutionResult> => res.catch((err: ErrorWithMeta) => err.meta!);
    return res;
  }
}