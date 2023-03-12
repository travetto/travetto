import { cliTpl, BaseCliCommand, CliCommand, CliHelp } from '@travetto/cli';
import { GlobalEnvConfig, ErrorUtil } from '@travetto/base';

import { AppListLoader } from './bin/list';
import { AppRunUtil } from './bin/run';
import { HelpUtil } from './bin/help';

function hasChildren(e: Error): e is Error & { errors: Error[] } {
  return !!e && ('errors' in e);
}

/**
 * The main entry point for the application cli
 */
@CliCommand()
export class AppRunCommand implements BaseCliCommand {
  #loader: AppListLoader = new AppListLoader();

  /** Application environment */
  env?: string;

  /** Additional application profiles */
  profile: string[] = [];

  /**
   * Add help output
   */
  async help(): Promise<string> {
    return [
      '',
      cliTpl`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await this.#loader.getList()),
      ''
    ].join('\n');
  }

  envInit(): GlobalEnvConfig {
    return {
      debug: process.env.DEBUG || false,
      envName: this.env,
      profiles: this.profile
    };
  }

  /**
   * Main action
   */
  async action(app: string, args: string[]): Promise<void | CliHelp | number> {
    try {
      // Find app
      const selected = await this.#loader.findByName(app);

      // If app not found
      if (!selected) {
        return new CliHelp(app ? `${app} is an unknown application` : '');
      } else {

        // Run otherwise
        try {
          return await AppRunUtil.run(selected, ...args);
        } catch (err) {
          if (!err || !(err instanceof Error)) {
            throw err;
          }
          console.error(cliTpl`${{ failure: 'Failed to run' }} ${{ title: selected.name }}, ${err.message.replace(/via=.*$/, '')}`);
          if (hasChildren(err)) {
            console.error(err.errors.map((x: { message: string }) => cliTpl`● ${{ output: x.message }}`).join('\n'));
          } else {
            const stack = ErrorUtil.cleanStack(err);
            if (!stack.includes(err.message)) {
              console.error(err.message);
            }
            console.error(stack);
          }
          return 1;
        }
      }
    } catch (outerErr) {
      if (!outerErr || !(outerErr instanceof Error)) {
        throw outerErr;
      }
      return new CliHelp(outerErr, `\nUsage: ${HelpUtil.getAppUsage((await this.#loader.findByName(app))!)}`);
    }
  }

  async jsonIpc(app: string, args: string[]): Promise<unknown | undefined> {
    if (!app) {
      return;
    } else {
      return { name: app, args };
    }
  }
}