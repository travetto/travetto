import { spawn, ChildProcess } from 'node:child_process';
import { Env, ExecUtil } from '@travetto/runtime';

import { DockerContainer } from './docker';
import { CommandConfig } from './types';

/**
 * A command to be executed.  A command can be thought of as a
 * program or operation that can be provided via a pre-installed binary or by using
 * a docker container.
 */
export class CommandOperation {

  static #hasDocker: boolean;

  /**
   * Check to see if docker is available
   */
  static async dockerAvailable(): Promise<boolean> {
    if (this.#hasDocker === undefined && !Env.TRV_DOCKER.isFalse) { // Check for docker existence
      const { valid } = await ExecUtil.getResult(spawn('docker', ['ps']), { catch: true });
      this.#hasDocker = valid;
    }
    return this.#hasDocker;
  }

  runContainer: Promise<DockerContainer | undefined>;
  execContainer: Promise<DockerContainer | undefined>;
  config: CommandConfig;

  constructor(config: Partial<CommandConfig> & { containerImage: string }) {
    this.config = {
      localCommand: (x): string[] => x,
      containerCommand: (x): string[] => x,
      localCheck: async (): Promise<boolean> => false,
      allowDocker: true, containerEntry: '/bin/sh',
      ...config
    };
  }

  /**
   * Get the container for a given command
   */
  async getContainer(): Promise<DockerContainer | undefined> {
    const { localCheck } = this.config;

    const useLocal = await (Array.isArray(localCheck) ?
      ExecUtil.getResult(spawn(...localCheck)).then(x => x.valid, () => false) :
      localCheck());

    const useContainer = this.config.allowDocker && !useLocal && (await CommandOperation.dockerAvailable());

    if (useContainer) {
      return new DockerContainer(this.config.containerImage)
        .forceDestroyOnShutdown()
        .setInteractive(true);
    }
  }

  /**
   * Get the container to support the `docker run` command
   */
  getRunContainer(): Promise<DockerContainer | undefined> {
    return this.runContainer ||= this.getContainer();
  }

  /**
   * Get a version of the container using `docker exec`. This is meant to be used in
   * scenarios where multiple executions are desired.
   */
  getExecContainer(): Promise<DockerContainer | undefined> {
    return this.execContainer ||= this.getContainer().then(async c => {
      if (c) {
        await c.create([this.config.containerEntry].filter(x => !!x));
        await c.start();
        c.setEntryPoint(this.config.containerEntry);
      }
      return c;
    });
  }

  /**
   * Execute a command, either via a docker exec or the locally installed program
   */
  async exec(...args: string[]): Promise<ChildProcess> {
    const container = await this.getExecContainer();
    args = (container ? this.config.containerCommand : this.config.localCommand)(args);

    if (container) {
      return container.exec(args);
    } else {
      return spawn(args[0], args.slice(1), { shell: true });
    }
  }

  /**
   * Run a single command, if using docker, run once and terminate.
   */
  async run(...args: string[]): Promise<ChildProcess> {
    const container = await this.getRunContainer();
    const [cmd, ...rest] = (container ? this.config.containerCommand : this.config.localCommand)(args);
    console.debug('Running command', { cmd, rest, container: !!container });

    if (container) {
      return container.setEntryPoint(cmd).run(rest);
    } else {
      return spawn(cmd, rest, { shell: true });
    }
  }
}