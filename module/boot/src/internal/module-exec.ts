import { parentPort, WorkerOptions } from 'worker_threads';

import { CatchableResult, ExecUtil, ExecutionState, WorkerResult } from '../exec';
import { Host } from '../host';

/**
 * Utilities for launching module-based processes
 */
export class ModuleExec {

  /**
   * Run a file with a main entry point relative to the current node executable.  Mimics how node's
   * fork operation is just spawn with the command set to `process.argv0`
   * @param cmd The file to run
   * @param args The command line arguments to pass
   * @param options The enhancement options
   */
  static forkMain(file: string, args: string[] = [], options: { env?: Record<string, string | undefined> } = {}): ExecutionState<CatchableResult> {
    return ExecUtil.fork(
      require.resolve('@travetto/boot/bin/main'),
      [
        file.replace(Host.EXT.input, Host.EXT.output),
        ...args
      ],
      options
    );
  }

  /**
   * Run a file with a main entry point as a worker thread
   * @param file The file to run, if starts with @, will be resolved as a module
   * @param args The arguments to pass in
   * @param options The worker options
   */
  static workerMain<T = unknown>(file: string, args: string[] = [], options: WorkerOptions & { minimal?: boolean } = {}): WorkerResult<T> {
    return ExecUtil.worker<T>(
      require.resolve('@travetto/boot/bin/main'),
      [
        file.replace(Host.EXT.input, Host.EXT.output),
        ...args
      ],
      options
    );
  }

  /**
   * Return plugin data depending on how it has been called
   */
  static mainResponse<T = unknown>(obj: T): T {
    parentPort ? parentPort.postMessage(obj) : console.log(JSON.stringify(obj));
    return obj;
  }
}