import os from 'os';
import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';

type Options = {
  changed: OptionConfig<boolean>;
  workers: OptionConfig<number>;
};

/**
 * Repo execution
 */
export class RepoExecCommand extends CliCommand<Options> {
  name = 'repo:exec';

  baseArgs: string[] = [];

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only changed modules', def: true }),
      workers: this.option({ desc: 'Number of concurrent workers', def: Math.min(4, os.cpus.length - 1) }),
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
      (folder, msg) => console.log(folder, msg)
    );
  }
}
