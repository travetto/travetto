import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { WorkPool } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';

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
    return '<command> [...args]';
  }

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async action(cmd: string, args: string[]): Promise<void> {
    if (!cmd) {
      return this.showHelp('Command is a required field');
    }

    await CliModuleUtil.execOnModules(
      this.cmd.changed ? 'changed' : 'all',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (mod, opts) => ExecUtil.spawn(cmd, args, opts),
      {
        progressMessage: mod => `Running '${this.args.join(' ')}' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
        showStdout: this.cmd.showStdout,
        prefixOutput: this.cmd.prefixOutput,
        workerCount: this.cmd.workers,
      }
    );
  }
}
