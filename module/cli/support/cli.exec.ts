import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';
import { Env } from '@travetto/base';

type Options = {
  changed: OptionConfig<boolean>;
  workers: OptionConfig<number>;
  prefixOutput: OptionConfig<boolean>;
  showStdout: OptionConfig<boolean>;
};

/**
 * Repo execution
 */
export class RepoExecCommand extends CliCommand<Options> {
  name = 'exec';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only changed modules', def: true }),
      workers: this.option({ desc: 'Number of concurrent workers', def: WorkPool.DEFAULT_SIZE }),
      prefixOutput: this.boolOption({ desc: 'Prefix output by folder', def: true }),
      showStdout: this.boolOption({ desc: 'Show stdout', def: true })
    };
  }

  getArgs(): string {
    return '[command] [...args]';
  }

  async envInit(): Promise<void> {
    Env.define({
      debug: '0',
    });
  }

  async action(): Promise<void> {
    await CliModuleUtil.runOnModules(
      this.cmd.changed ? 'changed' : 'all',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.args as [string, ...string[]],
      {
        showStdout: this.cmd.showStdout,
        prefixOutput: this.cmd.prefixOutput,
        workerCount: this.cmd.workers,
      }
    );
  }
}
