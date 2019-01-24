import * as assert from 'assert';
import * as os from 'os';

import { Suite, Test } from '@travetto/test';
import { FsUtil } from '@travetto/base';

import { DockerContainer } from '../src/docker';

@Suite()
class DockerIOTest {
  @Test()
  async test() {
    const container = new DockerContainer('rafakato/alpine-graphicsmagick')
      .forceDestroyOnShutdown()
      .setInteractive(true);

    await container.create(['-i'], ['/bin/sh']);
    await container.start();

    const [proc, prom] = await container.exec(['-i'], ['gm', 'convert', '-resize 100x50', '-', '-']);

    FsUtil.createReadStream(FsUtil.resolveURI(os.homedir(), 'Documents/download.jpeg')).pipe(proc.stdin);

    proc.stdout.pipe(process.stdout);

    assert(true);

    await prom;
  }
}