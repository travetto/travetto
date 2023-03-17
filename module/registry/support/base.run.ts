import { Closeable, GlobalEnvConfig, ShutdownManager } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';
import { CliCommand, CliCommandRegistry, CliFlag, CliModuleUtil, CliValidationError } from '@travetto/cli';
import { Required } from '@travetto/schema';

import { RootRegistry } from '../src/service/root';

/** A pattern that can be waited on */
export type Waitable = { wait(): Promise<unknown> } | { on(event: 'close', cb: Function): unknown };

type RunResponse = Waitable | Closeable | void | undefined;

/**
 * Base for runnable applications
 */
@CliCommand()
export abstract class BaseRunCommand {

  @CliFlag({ short: 'e', desc: 'Application environment' })
  env?: string;

  @CliFlag({ short: 'p', desc: 'Additional application profiles' })
  profile: string[] = [];

  @CliFlag({ short: 'm', desc: 'Module to run for' })
  @Required(RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath)
  module?: string;

  envSet?(): Record<string, string | boolean | number>;

  envInit(): GlobalEnvConfig {
    return {
      debug: process.env.DEBUG || false,
      envName: this.env,
      profiles: this.profile,
      set: this.envSet?.()
    };
  }

  abstract main(...args: unknown[]): void | Promise<void>;

  async validate(): Promise<CliValidationError | undefined> {
    if (this.module) {
      if (!RootIndex.getModule(this.module)) {
        return {
          kind: 'required',
          path: 'module',
          message: `${this.module} is an unknown module`
        };
      } else {
        const self = RootIndex.getModuleFromSource(RootIndex.getFunctionMetadata(this.constructor)!.source)!.name;
        const mods = await CliModuleUtil.findModules('all');
        const graph = CliModuleUtil.getDependencyGraph(mods);
        if (self !== this.module && !graph[this.module].includes(self)) {
          return {
            kind: 'required',
            path: 'module',
            message: `${this.module} does not have ${self} as a dependency`
          };
        }
      }
    }
  }

  async jsonIpc(...args: unknown[]): Promise<unknown> {
    return {
      name: CliCommandRegistry.getName(this),
      args: process.argv.slice(3)  // Send everything through
    };
  }

  /**
   * Wait for a response to finish
   * @param src
   */
  async run(src: () => (RunResponse | Promise<RunResponse>)): Promise<void> {
    if (this.module && this.module !== RootIndex.mainModule.name) { // Mono-repo support
      RootIndex.reinitForModule(this.module); // Reinit with specified module
    }
    await RootRegistry.init();

    const target = await src();
    if (target) {
      if ('close' in target) {
        ShutdownManager.onShutdown(target, target); // Tie shutdown into app close
      }
      if ('wait' in target) {
        await target.wait(); // Wait for close signal
      } else if ('on' in target) {
        await new Promise<void>(res => target.on('close', res));
      }
    }
  }
}
