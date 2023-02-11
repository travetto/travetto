import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';
import { cliTpl } from '@travetto/cli';

import { ActiveShellCommand } from './shell';
import { DockerPackConfig, DockerPackFactoryModule } from './types';

export class DockerPackOperation {

  static getDockerTags(cfg: DockerPackConfig): string[] {
    return (cfg.dockerTag ?? []).map(x => cfg.dockerRegistry ? `${cfg.dockerRegistry}/${cfg.dockerName}:${x}` : `${cfg.dockerName}:${x}`);
  }

  /**
   * Write Docker File
   */
  static async* writeDockerFile(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const dockerFile = path.resolve(cfg.workspace, 'Dockerfile');
    const title = cliTpl`${{ title: 'Generating Docker File' }} ${{ path: dockerFile }} ${{ param: cfg.dockerFactory }}`;
    const factory = RootIndex.getFromImport(cfg.dockerFactory);
    if (!factory) {
      throw new Error(`Unable to resolve docker factory at ${cfg.dockerFactory}`);
    }
    const mod: DockerPackFactoryModule = await import(factory.import);
    const content = (await mod.factory(cfg)).trim();

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
    const title = cliTpl`${{ title: 'Pulling Docker Base Image' }} ${{ param: cfg.dockerImage }}`;

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
    const title = cliTpl`${{ title: 'Building Docker Container' }} ${{ param: cfg.dockerTag?.join(',') }}`;
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
    const title = cliTpl`${{ title: 'Push Container to registry' }} ${{ param: cfg.dockerRegistry }}`;
    const cmd = ['docker', 'image', 'push', '-a', cfg.dockerName];

    if (cfg.ejectFile) {
      yield ActiveShellCommand.comment(title);
      yield cmd;
    } else {
      yield [title];
      await ExecUtil.spawn(cmd[0], cmd.slice(1), { stdio: [0, 'pipe', 2] }).result;
    }
  }
}