import { type ChildProcess, spawn, type SpawnOptions } from 'node:child_process';

import { castTo } from './types.ts';
import { RuntimeIndex } from './manifest-index.ts';
import { BinaryUtil, type BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';

const ResultSymbol = Symbol();

/**
 * Result of an execution
 */
export interface ExecutionResult<T extends string | BinaryArray = string | BinaryArray> {
  /**
   * Stdout
   */
  stdout: T;
  /**
   * Stderr
   */
  stderr: T;
  /**
   * Exit code
   */
  code: number;
  /**
   * Execution result message, should be inline with code
   */
  message?: string;
  /**
   * Whether or not the execution completed successfully
   */
  valid: boolean;
}

type ExecutionBaseResult = Omit<ExecutionResult, 'stdout' | 'stderr'>;

/**
 * Standard utilities for managing executions
 */
export class ExecUtil {

  /**
   * Take a child process, and some additional options, and produce a promise that
   * represents the entire execution.  On successful completion the promise will resolve, and
   * on failed completion the promise will reject.
   *
   * @param subProcess The process to enhance
   * @param options The options to use to enhance the process
   */
  static getResult(subProcess: ChildProcess): Promise<ExecutionResult<string>>;
  static getResult(subProcess: ChildProcess, options: { catch?: boolean, binary?: false }): Promise<ExecutionResult<string>>;
  static getResult(subProcess: ChildProcess, options: { catch?: boolean, binary: true }): Promise<ExecutionResult<BinaryArray>>;
  static getResult<T extends string | BinaryArray>(subProcess: ChildProcess, options: { catch?: boolean, binary?: boolean } = {}): Promise<ExecutionResult<T>> {
    const typed: ChildProcess & { [ResultSymbol]?: Promise<ExecutionResult> } = subProcess;
    const result = typed[ResultSymbol] ??= new Promise<ExecutionResult>(resolve => {
      const stdout: BinaryArray[] = [];
      const stderr: BinaryArray[] = [];
      let done = false;
      const finish = (finalResult: ExecutionBaseResult): void => {
        if (done) {
          return;
        }
        done = true;

        const buffers = {
          stdout: BinaryUtil.combineBinaryArrays(stdout),
          stderr: BinaryUtil.combineBinaryArrays(stderr),
        };

        const final = {
          stdout: options.binary ? buffers.stdout : buffers.stdout.toString(subProcess.stdout?.readableEncoding ?? 'utf8'),
          stderr: options.binary ? buffers.stderr : buffers.stderr.toString(subProcess.stderr?.readableEncoding ?? 'utf8'),
          ...finalResult
        };

        resolve(!final.valid ?
          { ...final, message: `${final.message || final.stderr || final.stdout || 'failed'}` } :
          final
        );
      };

      subProcess.stdout?.on('data', data => stdout.push(CodecUtil.readChunk(data, subProcess.stdout?.readableEncoding)));
      subProcess.stderr?.on('data', data => stderr.push(CodecUtil.readChunk(data, subProcess.stderr?.readableEncoding)));

      subProcess.on('error', (error: Error) =>
        finish({ code: 1, message: error.message, valid: false }));

      subProcess.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 }));

      if (subProcess.exitCode !== null) { // We are already done
        finish({ code: subProcess.exitCode, valid: subProcess.exitCode === 0 });
      }
    });

    return castTo(options.catch ? result : result.then(executionResult => {
      if (executionResult.valid) {
        return executionResult;
      } else {
        throw new Error(executionResult.message);
      }
    }));
  }

  /** Spawn a package command */
  static spawnPackageCommand(cmd: string, args: string[], config: SpawnOptions = {}): ChildProcess {
    return spawn(process.argv0, [RuntimeIndex.resolvePackageCommand(cmd), ...args], config);
  }
}