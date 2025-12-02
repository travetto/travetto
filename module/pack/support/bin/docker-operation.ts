import fs from 'node:fs/promises';
import path from 'node:path';

import { Runtime } from '@travetto/runtime';
import { cliTpl } from '@travetto/cli';

import { ActiveShellCommand } from './shell.ts';
import { DockerPackConfig, DockerPackFactoryModule } from '../../src/types.ts';
import { PackOperation } from './operation.ts';
import { PackUtil } from './util.ts';

export class DockerPackOperation {

  static getDockerTags(config: DockerPackConfig): string[] {
    return (config.dockerTag ?? []).map(x => config.dockerRegistry ? `${config.dockerRegistry}/${config.dockerName}:${x}` : `${config.dockerName}:${x}`);
  }

  /**
   * Detect image os
   */
  static async* detectDockerImageOs(config: DockerPackConfig): AsyncIterable<string[]> {
    // Read os before writing
    config.dockerRuntime.os = await PackUtil.runCommand(
      ['docker', 'run', '--rm', '--entrypoint', '/bin/sh', config.dockerImage, '-c', 'cat /etc/*release*']
    ).then(out => {
      const found = out.match(/\b(?:debian|alpine|centos)\b/i)?.[0].toLowerCase();
      switch (found) {
        case 'debian': case 'alpine': case 'centos': return found;
        default: return 'unknown';
      }
    });
    yield* PackOperation.title(config, cliTpl`${{ title: 'Detected Image OS' }} ${{ param: config.dockerImage }} as ${{ param: config.dockerRuntime.os }}`);
  }

  /**
   * Write Docker File
   */
  static async* writeDockerFile(config: DockerPackConfig): AsyncIterable<string[]> {
    const dockerFile = path.resolve(config.buildDir, 'Dockerfile');
    const mod = await Runtime.importFrom<DockerPackFactoryModule>(config.dockerFactory);
    const content = (await mod.factory(config)).trim();

    yield* PackOperation.title(config, cliTpl`${{ title: 'Generating Docker File' }} ${{ path: dockerFile }} ${{ param: config.dockerFactory }}`);

    if (config.ejectFile) {
      yield* ActiveShellCommand.createFile(dockerFile, content.split(/\n/));
    } else {
      await fs.writeFile(dockerFile, content, 'utf8');
    }
  }

  /**
   * Pull Docker Base Image
   */
  static async* pullDockerBaseImage(config: DockerPackConfig): AsyncIterable<string[]> {
    const command = ['docker', 'pull', config.dockerImage];

    yield* PackOperation.title(config, cliTpl`${{ title: 'Pulling Docker Base Image' }} ${{ param: config.dockerImage }}`);

    if (config.ejectFile) {
      yield command;
    } else {
      await PackUtil.runCommand(command);
    }
  }

  /**
   * Building Docker Container
   */
  static async* buildDockerContainer(config: DockerPackConfig): AsyncIterable<string[]> {
    const cmd = [
      'docker', 'build',
      ...(config.dockerBuildPlatform ? ['--platform', config.dockerBuildPlatform] : []),
      ...DockerPackOperation.getDockerTags(config).flatMap(x => ['-t', x]), '.'
    ];

    yield* PackOperation.title(config, cliTpl`${{ title: 'Building Docker Container' }} ${{ param: config.dockerTag?.join(',') }}`);

    if (config.ejectFile) {
      yield ActiveShellCommand.chdir(config.buildDir);
      yield cmd;
      yield ActiveShellCommand.chdir(path.resolve());
    } else {
      await PackUtil.runCommand(cmd, { cwd: config.buildDir, stdio: [0, 'pipe', 2] });
      const [image]: [{ Size: number }] = JSON.parse(await PackUtil.runCommand(['docker', 'inspect', config.dockerImage]));
      yield [cliTpl`${{ title: 'Built Docker Container  ' }} ${{ identifier: 'sizeMb' }}=${{ param: Math.trunc(image.Size / 2 ** 20) }}`];
    }
  }

  /**
   * Push Docker Container
   */
  static async* pushDockerContainer(config: DockerPackConfig): AsyncIterable<string[]> {
    if (!config.dockerPush) {
      return;
    }
    const tags = DockerPackOperation.getDockerTags(config);
    const cmd = ['docker', 'image', 'push'];

    yield* PackOperation.title(config, cliTpl`${{ title: 'Push Container to registry' }} ${{ param: config.dockerRegistry }}`);

    if (config.ejectFile) {
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