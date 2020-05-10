import { EnvUtil, ExecUtil } from '@travetto/boot';

import { DockerContainer } from './docker';
import { CommandConfig } from './types';

/**
 * A command to be executed.  A command can be thought of as a
 * program or operation that can be provided via a pre-installed binary or by using
 * a docker container.
 */
export class CommandService {

  private static hasDocker: boolean;

  /**
   * Check to see if docker is available
   */
  static async dockerAvailable() {
    if (this.hasDocker === undefined && !EnvUtil.isTrue('NO_DOCKER')) { // Check for docker existence
      const { result: prom } = ExecUtil.spawn('docker', ['ps']);
      this.hasDocker = (await prom).valid;
    }
    return this.hasDocker;
  }

  runContainer: Promise<DockerContainer | undefined>;
  execContainer: Promise<DockerContainer | undefined>;
  config: CommandConfig;

  constructor(config: Partial<CommandConfig>) {
    this.config = {
      localCommand: x => x,
      containerCommand: x => x,
      localCheck: async () => false,
      allowDocker: true, containerEntry: '/bin/sh',
      ...(config as CommandConfig)
    };
  }

  /**
   * Get the container for a given command
   */
  async getContainer(): Promise<DockerContainer | undefined> {
    const { localCheck } = this.config;

    const useLocal = await (Array.isArray(localCheck) ?
      ExecUtil.spawn(...localCheck).result.then(x => x.valid, () => false) :
      localCheck());

    const useContainer = this.config.allowDocker && !useLocal && (await CommandService.dockerAvailable());

    if (useContainer) {
      return new DockerContainer(this.config.containerImage)
        .forceDestroyOnShutdown()
        .setInteractive(true);
    }
  }

  /**
   * Get the container to support the `docker run` command
   */
  getRunContainer() {
    return this.runContainer = this.runContainer || this.getContainer();
  }

  /**
   * Get a version of the container using `docker exec`. This is meant to be used in
   * scenarios where multiple executions are desired.
   */
  getExecContainer() {
    return this.execContainer = this.execContainer || this.getContainer().then(async c => {
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
  async exec(...args: string[]) {
    const container = await this.getExecContainer();
    args = (container ? this.config.containerCommand : this.config.localCommand)(args);

    if (container) {
      return container.exec(args);
    } else {
      return ExecUtil.spawn(args[0], args.slice(1), { shell: true, quiet: false });
    }
  }

  /**
   * Run a single command, if using docker, run once and terminate.
   */
  async run(...args: string[]) {
    const container = await this.getRunContainer();
    const [cmd, ...rest] = (container ? this.config.containerCommand : this.config.localCommand)(args);
    console.debug('Running command', cmd, rest, !!container);

    if (container) {
      return container.setEntryPoint(cmd).run(rest);
    } else {
      return await ExecUtil.spawn(cmd, rest, { shell: true, quiet: false }).result;
    }
  }
}