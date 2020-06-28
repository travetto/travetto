import { DockerContainer } from '../../../src/docker';
import { CommandUtil } from '../../../src/util';

export class NginxServer {
  container: DockerContainer;

  constructor(
    private port = Math.trunc(Math.random() * 40000) + 10000
  ) {
    this.container = new DockerContainer('nginx:latest')
      .exposePort(this.port, 80)
      .forceDestroyOnShutdown();
  }
  start() {
    this.container.run();
    CommandUtil.waitForPort(this.port);
    console.log('Ready!');
  }

  async stop() {
    await this.container.stop();
    console.log('Stopped');
  }
}