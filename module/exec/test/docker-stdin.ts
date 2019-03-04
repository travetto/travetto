import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { DockerContainer } from '../src/docker';

@Suite()
export class DockerIOTest {
  @Test()
  async test() {
    const container = new DockerContainer('rafakato/alpine-graphicsmagick')
      .forceDestroyOnShutdown()
      .setInteractive(true);

    await container.create(['/bin/sh']);
    await container.start();

    const { process: proc, result: prom } = await container.exec(['gm', 'convert', '-resize', '100x50', '-', '-']);

    (await ResourceManager.readToStream('/download.jpeg')).pipe(proc.stdin);

    assert(true);

    await prom;
  }
}