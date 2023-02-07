import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { ActiveShellCommand } from './shell';
import { DockerPackConfig } from './types';

export class DockerPackOperation {

  static getDockerTags(cfg: DockerPackConfig): string[] {
    return (cfg.dockerTag ?? []).map(x => cfg.dockerRegistry ? `${cfg.dockerRegistry}/${cfg.dockerName}:${x}` : `${cfg.dockerName}:${x}`);
  }

  /**
   * Write Docker File
   */
  static async* writeDockerFile(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const title = 'Generating Docker File';

    const content = `
FROM ${cfg.dockerImage}
WORKDIR /app
COPY . .
${(cfg.dockerPort ?? []).map(x => `EXPOSE ${x}`).join('\n')}
CMD ["node", "${cfg.entryCommand}"]
`;

    const dockerFile = path.resolve(cfg.workspace, 'Dockerfile');

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield* ActiveShellCommand.createFile(dockerFile, content.split(/\n/));
    } else {
      yield [title];
      await fs.writeFile(dockerFile, content, 'utf8');
    }
  }

  /**
   * Pull Docker Base Image
   */
  static async* pullDockerBaseImage(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const title = 'Pulling Docker Base Image';

    const command = ['docker', 'pull', cfg.dockerImage];

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield command;
    } else {
      yield [title];
      await ExecUtil.spawn(command[0], command.slice(1), {}).result;
    }
  }

  /**
   * Building Docker Container
   */
  static async* buildDockerContainer(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const title = 'Building Docker Container';
    const cmd = ['docker', 'build', ...DockerPackOperation.getDockerTags(cfg).flatMap(x => ['-t', x]), '.'];

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield ActiveShellCommand.chdir(cfg.workspace);
      yield cmd;
      yield ActiveShellCommand.chdir(path.cwd());
    } else {
      yield [title];
      await ExecUtil.spawn(cmd[0], cmd.slice(1), { cwd: cfg.workspace, stdio: [0, 'pipe', 2] }).result;
    }
  }

  /**
   * Push Docker Container
   */
  static async* pushDockerContainer(cfg: DockerPackConfig): AsyncIterable<string[]> {
    if (!cfg.dockerPush) {
      return;
    }

    const title = 'Push Docker Container';
    const cmd = ['docker', 'image', 'push', ...DockerPackOperation.getDockerTags(cfg)];

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield cmd;
    } else {
      yield [title];
      await ExecUtil.spawn(cmd[0], cmd.slice(1), { stdio: [0, 'pipe', 2] }).result;
    }
  }
}