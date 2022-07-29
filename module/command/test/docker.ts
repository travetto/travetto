import * as assert from 'assert';
import * as timers from 'timers/promises';

import { Suite, Test } from '@travetto/test';
import { DockerContainer, CommandUtil } from '@travetto/command';

@Suite()
export class DockerTest {

  @Test({ timeout: 15000 })
  async test() {
    const port = Math.trunc(Math.random() * 40000) + 10000;
    const container = new DockerContainer('nginx:latest')
      .exposePort(port, 80)
      .forceDestroyOnShutdown();
    try {
      container.run();
      await timers.setTimeout(3000);
      await assert.doesNotReject(() => CommandUtil.waitForPort(port));
    } finally {
      await container.stop();
    }
  }
}