import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { DockerContainer } from '../src/docker';

@Suite()
export class DockerTet {

  @Test()
  async test() {
    const port = 10000;
    const container = new DockerContainer('mongo:latest')
      .createTempVolume('/var/workspace')
      .exposePort(port)
      .setWorkingDir('/var/workspace')
      .forceDestroyOnShutdown();

    container.run('--storageEngine', 'ephemeralForTest', '--port', port);
    await DockerContainer.waitForPort(port);

    return;
  }
}