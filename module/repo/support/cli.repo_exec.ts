import { spawn } from 'node:child_process';

import { CliCommand, type CliCommandShape, CliParseUtil } from '@travetto/cli';
import { Env } from '@travetto/runtime';
import { Max, Min } from '@travetto/schema';
import { WorkPool } from '@travetto/worker';

import { RepoExecUtil } from './bin/exec.ts';

/**
 * Execute a shell command across workspace modules.
 *
 * Supports running for all modules or only changed modules, with optional
 * concurrency and output prefixing controls.
 */
@CliCommand()
export class RepoExecCommand implements CliCommandShape {
  /** Only changed modules */
  changed = false;

  /** Number of concurrent workers */
  @Min(1)
  @Max(WorkPool.MAX_SIZE)
  workers = WorkPool.DEFAULT_SIZE;

  /** Prefix output by folder */
  prefixOutput = true;

  /** Show stdout */
  showStdout = true;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(cmd: string, args: string[] = []): Promise<void> {
    const parsed = CliParseUtil.getState(this);
    const finalArgs = [...args, ...(parsed?.unknown ?? [])];

    await RepoExecUtil.execOnModules(
      this.changed ? 'changed' : 'workspace',
      module =>
        spawn(cmd, finalArgs, {
          cwd: module.sourceFolder,
          env: {
            ...process.env,
            ...Env.TRV_MODULE.export(module.name),
            ...Env.TRV_MANIFEST.export(undefined)
          }
        }),
      {
        progressMessage: module => `Running '${cmd} ${finalArgs.join(' ')}' [%completed/%total] ${module?.sourceFolder ?? ''}`,
        showStdout: this.showStdout,
        prefixOutput: this.prefixOutput,
        workerCount: this.workers
      }
    );
  }
}
