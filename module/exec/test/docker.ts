import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { DockerContainer } from '../src/docker';

@Suite()
export class DockerTet {

  @Test()
  async test() {
    const port = 10000;
    const container = new DockerContainer('nginx:latest')
      .exposePort(port, 80)
      .forceDestroyOnShutdown();

    container.run();
    await DockerContainer.waitForPort(port);
    assert(true);
    return;
  }
}