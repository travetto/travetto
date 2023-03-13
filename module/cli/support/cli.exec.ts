import os from 'os';

import { CliCommand, CliCommandShape, CliModuleUtil } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { Max, Min } from '@travetto/schema';

/**
 * Repo execution
 */
@CliCommand()
export class RepoExecCommand implements CliCommandShape {

  /** Only changed modules */
  changed = true;

  /** Number of concurrent workers */
  @Min(1) @Max(os.cpus().length - 1)
  workers = WorkPool.DEFAULT_SIZE;

  /** Prefix output by folder */
  prefixOutput = true;

  /** Show stdout */
  showStdout = true;

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async main(cmd: string, args: string[]): Promise<void> {
    await CliModuleUtil.execOnModules(
      this.changed ? 'changed' : 'all',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (mod, opts) => ExecUtil.spawn(cmd, args, opts),
      {
        progressMessage: mod => `Running '${cmd} ${args.join(' ')}' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
        showStdout: this.showStdout,
        prefixOutput: this.prefixOutput,
        workerCount: this.workers,
      }
    );
  }
}
