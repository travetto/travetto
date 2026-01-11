import { spawn } from 'node:child_process';

import { CliCommand, type CliCommandShape, type ParsedState } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { Env } from '@travetto/runtime';
import { Ignore, Max, Min } from '@travetto/schema';

import { RepoExecUtil } from './bin/exec.ts';

/**
 * Repo execution
 */
@CliCommand()
export class RepoExecCommand implements CliCommandShape {

  @Ignore()
  _parsed: ParsedState;

  /** Only changed modules */
  changed = false;

  /** Number of concurrent workers */
  @Min(1) @Max(WorkPool.MAX_SIZE)
  workers = WorkPool.DEFAULT_SIZE;

  /** Prefix output by folder */
  prefixOutput = true;

  /** Show stdout */
  showStdout = true;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(cmd: string, args: string[] = []): Promise<void> {
    const finalArgs = [...args, ...this._parsed.unknown];

    await RepoExecUtil.execOnModules(
      this.changed ? 'changed' : 'workspace',
      module => spawn(cmd, finalArgs, {
        cwd: module.sourceFolder,
        env: {
          ...process.env,
          ...Env.TRV_MODULE.export(module.name),
          ...Env.TRV_MANIFEST.export(undefined)
        }
      }),
      {
        progressMessage: module => `Running '${cmd} ${finalArgs.join(' ')}' [%idx/%total] ${module?.sourceFolder ?? ''}`,
        showStdout: this.showStdout,
        prefixOutput: this.prefixOutput,
        workerCount: this.workers,
      }
    );
  }
}
