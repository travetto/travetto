import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';

import { ActiveShellCommand } from './shell';
import { DockerPackConfig, DockerPackFactoryModule } from './types';
import { PackOperation } from './operation';
import { PackUtil } from './util';

export class DockerPackOperation {

  static getDockerTags(cfg: DockerPackConfig): string[] {
    return (cfg.dockerTag ?? []).map(x => cfg.dockerRegistry ? `${cfg.dockerRegistry}/${cfg.dockerName}:${x}` : `${cfg.dockerName}:${x}`);
  }

  /**
   * Write Docker File
   */
  static async* writeDockerFile(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const dockerFile = path.resolve(cfg.workspace, 'Dockerfile');

    const factory = RootIndex.getFromImport(cfg.dockerFactory);
    if (!factory) {
      throw new Error(`Unable to resolve docker factory at ${cfg.dockerFactory}`);
    }
    const mod: DockerPackFactoryModule = await import(factory.import);
    const content = (await mod.factory(cfg)).trim();

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Generating Docker File' }} ${{ path: dockerFile }} ${{ param: cfg.dockerFactory }}`);

    if (cfg.ejectFile) {
      yield* ActiveShellCommand.createFile(dockerFile, content.split(/\n/));
    } else {
      await fs.writeFile(dockerFile, content, 'utf8');
    }
  }

  /**
   * Pull Docker Base Image
   */
  static async* pullDockerBaseImage(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const command = ['docker', 'pull', cfg.dockerImage];

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Pulling Docker Base Image' }} ${{ param: cfg.dockerImage }}`);

    if (cfg.ejectFile) {
      yield command;
    } else {
      await PackUtil.runCommand(command);
    }
  }

  /**
   * Building Docker Container
   */
  static async* buildDockerContainer(cfg: DockerPackConfig): AsyncIterable<string[]> {
    const cmd = [
      'docker', 'build',
      ...(cfg.dockerBuildPlatform ? ['--platform', cfg.dockerBuildPlatform] : []),
      ...DockerPackOperation.getDockerTags(cfg).flatMap(x => ['-t', x]), '.'
    ];

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Building Docker Container' }} ${{ param: cfg.dockerTag?.join(',') }}`);

    if (cfg.ejectFile) {
      yield ActiveShellCommand.chdir(cfg.workspace);
      yield cmd;
      yield ActiveShellCommand.chdir(path.cwd());
    } else {
      await PackUtil.runCommand(cmd, { cwd: cfg.workspace, stdio: [0, 'pipe', 2] });
      const [image] = JSON.parse(await PackUtil.runCommand(['docker', 'inspect', cfg.dockerImage]));
      yield [cliTpl`${{ title: 'Built Docker Container  ' }} ${{ identifier: 'sizeMb' }}=${{ param: Math.trunc(image.Size / 2 ** 20) }}`];
    }
  }

  /**
   * Push Docker Container
   */
  static async* pushDockerContainer(cfg: DockerPackConfig): AsyncIterable<string[]> {
    if (!cfg.dockerPush) {
      return;
    }
    const tags = DockerPackOperation.getDockerTags(cfg);
    const cmd = ['docker', 'image', 'push'];

    yield* PackOperation.title(cfg, cliTpl`${{ title: 'Push Container to registry' }} ${{ param: cfg.dockerRegistry }}`);

    if (cfg.ejectFile) {
      for (const tag of tags) {
        yield [...cmd, tag];
      }
    } else {
      for (const tag of tags) {
        await PackUtil.runCommand([...cmd, tag]);
      }
    }
  }
}