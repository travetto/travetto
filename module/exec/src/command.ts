import { Env } from '@travetto/base';

import { ExecUtil } from './util';
import { DockerContainer } from './docker';

export class CommandService {

  private _initPromise: Promise<any>;

  container: DockerContainer;

  constructor(private config: {
    image: string;
    imageStartCommand?: string;
    checkForLocal?: () => Promise<boolean>;
    localCommandCheck?: [string, string[]];
    imageCommand?: (args: string[]) => string[];
    processCommand?: (args: string[]) => string[];
    docker?: boolean;
  }) { }

  async useDocker(): Promise<boolean> {
    const canUseDocker = Env.docker && (this.config.docker === undefined || !!this.config.docker);

    let useDocker = canUseDocker;

    if (useDocker && this.config.checkForLocal) {
      useDocker = !(await this.config.checkForLocal());
    }

    if (useDocker && this.config.localCommandCheck) {
      try {
        useDocker = !(await ExecUtil.spawn(...this.config.localCommandCheck)[1]).valid;
      } catch { }
    }
    return useDocker;
  }

  async _init() {
    if (await this.useDocker()) {
      this.container = new DockerContainer(this.config.image)
        .forceDestroyOnShutdown()
        .setInteractive(true);

      await this.container.create([], [this.config.imageStartCommand || '/bin/sh']);
      await this.container.start();
    }
  }

  async init() {
    if (!this._initPromise) {
      this._initPromise = this._init();
    }
    return await this._initPromise;
  }

  async exec(...args: string[]) {
    await this.init();

    if (this.container) {
      const cmd = this.config.imageCommand ? this.config.imageCommand(args) : args;
      return this.container.exec(['-i'], cmd);
    } else {
      const cmd = this.config.processCommand ? this.config.processCommand(args) : args;
      return ExecUtil.spawn(cmd[0], cmd.slice(1), { quiet: true });
    }
  }
}