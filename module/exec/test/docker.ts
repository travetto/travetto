import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { DockerContainer } from '../src/docker';

@Suite()
export class DockerTet {

  @Test()
  async test() {
    const port = Math.trunc(Math.random() * 40000) + 10000;
    const container = new DockerContainer('nginx:latest')
      .exposePort(port, 80)
      .forceDestroyOnShutdown();

    container.run();
    await container.waitForPorts();
    assert(true);
  }
}