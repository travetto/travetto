import { CliCommand, CliCommandShape } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { ExecUtil, EnvInit } from '@travetto/base';
import { Max, Min } from '@travetto/schema';
import { RepoExecUtil } from './bin/exec';

/**
 * Repo execution
 */
@CliCommand()
export class RepoExecCommand implements CliCommandShape {

  #unknownArgs?: string[];

  /** Only changed modules */
  changed = false;

  /** Number of concurrent workers */
  @Min(1) @Max(WorkPool.MAX_SIZE)
  workers = WorkPool.DEFAULT_SIZE;

  /** Prefix output by folder */
  prefixOutput = true;

  /** Show stdout */
  showStdout = true;

  envInit(): EnvInit {
    return { debug: false };
  }

  finalize(unknownArgs?: string[] | undefined): void | Promise<void> {
    this.#unknownArgs = unknownArgs;
  }

  async main(cmd: string, args: string[] = []): Promise<void> {
    const finalArgs = [...args, ...this.#unknownArgs ?? []];

    await RepoExecUtil.execOnModules(
      this.changed ? 'changed' : 'all',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (mod, opts) => ExecUtil.spawn(cmd, finalArgs, opts),
      {
        progressMessage: mod => `Running '${cmd} ${finalArgs.join(' ')}' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
        showStdout: this.showStdout,
        prefixOutput: this.prefixOutput,
        workerCount: this.workers,
      }
    );
  }
}
