import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { ExecutionOptions } from '@travetto/base';
import { WorkPool } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';

type Options = {
  changed: OptionConfig<boolean>;
  workers: OptionConfig<number>;
};

/**
 * Repo execution
 */
export class RepoExecCommand extends CliCommand<Options> {
  name = 'exec';

  baseArgs: string[] = [];
  stdio?: ExecutionOptions['stdio'] = 'inherit';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only changed modules', def: true }),
      workers: this.option({ desc: 'Number of concurrent workers', def: WorkPool.DEFAULT_SIZE }),
    };
  }

  getArgs(): string {
    return '[command] [...args]';
  }

  async action(): Promise<void> {
    await CliModuleUtil.runOnModules(
      this.cmd.changed ? 'changed' : 'all',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      [...this.baseArgs, ...this.args] as [string, ...string[]],
      {
        onMessage: (folder, msg) => console.log!(folder, msg),
        workerCount: this.cmd.workers,
        stdio: this.stdio
      }
    );
  }
}
