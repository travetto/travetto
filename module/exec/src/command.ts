import { DockerContainer } from './docker';
import { AppEnv } from '@travetto/base';
import { spawn } from './util';
import { ChildProcess } from 'child_process';
import { ExecutionResult, CommonProcess } from './types';

export class CommandService {

  container: DockerContainer;

  constructor(private config: {
    image: string;
    imageStartCommand?: string;
    imageCommand?: (args: string[]) => string[];
    processCommand?: (args: string[]) => string[];
    docker?: boolean;
  }) { }

  async init() {
    if (AppEnv.docker && (this.config.docker === undefined || !!this.config.docker)) {
      this.container = new DockerContainer(this.config.image)
        .forceDestroyOnShutdown()
        .setInteractive(true);

      await this.container.create([], [this.config.imageStartCommand || '/bin/sh']);
      await this.container.start();
    }
  }

  exec(...args: string[]) {
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