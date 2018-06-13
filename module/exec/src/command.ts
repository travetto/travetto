import { DockerContainer } from './docker';
import { AppEnv } from '@travetto/base';
import { spawn } from './util';
import { ExecutionResult, CommonProcess } from './types';

export class CommandService {

  private _initPromise: Promise<any>;

  container: DockerContainer;

  constructor(private config: {
    image: string;
    imageStartCommand?: string;
    checkLocal?: () => Promise<boolean>;
    imageCommand?: (args: string[]) => string[];
    processCommand?: (args: string[]) => string[];
    docker?: boolean;
  }) { }

  async _init() {
    const canUseDocker = AppEnv.docker && (this.config.docker === undefined || !!this.config.docker);
    const useDocker = canUseDocker && (!this.config.checkLocal || (await this.config.checkLocal()));

    if (useDocker) {
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

    let exec;
    if (this.container) {
      const cmd = this.config.imageCommand ? this.config.imageCommand(args) : args;
      exec = this.container.exec(['-i'], cmd);
    } else {
      const cmd = this.config.processCommand ? this.config.processCommand(args) : args;
      exec = spawn(cmd.join(' '), { quiet: true });
    }
    return exec as [CommonProcess, Promise<ExecutionResult>];
  }
}