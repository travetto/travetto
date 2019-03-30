import { Env } from '@travetto/boot';

import { Exec } from './exec';
import { DockerContainer } from './docker';
import { CommandConfig } from './types';

export class CommandService {

  private static hasDocker: boolean;

  static async dockerAvailable() {
    if (this.hasDocker === undefined && !Env.isTrue('NO_DOCKER')) { // Check for docker existence
      const { result: prom } = Exec.spawn('docker', ['ps']);
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

  async getContainer(): Promise<DockerContainer | undefined> {
    const { localCheck } = this.config;

    const useLocal = await (Array.isArray(localCheck) ?
      Exec.spawn(...localCheck).result.then(x => x.valid, () => false) :
      localCheck());

    const useContainer = this.config.allowDocker && !useLocal && (await CommandService.dockerAvailable());

    if (useContainer) {
      return new DockerContainer(this.config.containerImage)
        .forceDestroyOnShutdown()
        .setInteractive(true);
    }
  }

  getRunContainer() {
    return this.runContainer = this.runContainer || this.getContainer();
  }

  getExecContainer() {
    return this.execContainer = this.execContainer || this.getContainer().then(async c => {
      if (c) {
        await c.create();
        await c.start();
        c.setEntryPoint(this.config.containerEntry);
      }
      return c;
    });
  }

  async exec(...args: string[]) {
    const container = await this.getExecContainer();
    args = (container ? this.config.containerCommand : this.config.localCommand)(args);

    if (container) {
      return container.exec(args);
    } else {
      return Exec.spawn(args[0], args.slice(1), { shell: true, quiet: false });
    }
  }

  async run(...args: string[]) {
    const container = await this.getRunContainer();
    const [cmd, ...rest] = (container ? this.config.containerCommand : this.config.localCommand)(args);
    console.debug('Running command', cmd, rest, !!container);

    if (container) {
      return container.setEntryPoint(cmd).run(rest);
    } else {
      return await Exec.spawn(cmd, rest, { shell: true, quiet: false }).result;
    }
  }
}