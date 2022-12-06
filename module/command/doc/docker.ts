import { DockerContainer, CommandUtil } from '@travetto/command';

export class NginxServer {
  #port: number;
  container: DockerContainer;

  constructor(
    port = Math.trunc(Math.random() * 40000) + 10000
  ) {
    this.#port = port;
    this.container = new DockerContainer('nginx:latest')
      .exposePort(this.#port, 80)
      .forceDestroyOnShutdown();
  }
  start() {
    this.container.run();
    CommandUtil.waitForPort(this.#port);
    console.log('Ready!');
  }

  async stop() {
    await this.container.stop();
    console.log('Stopped');
  }
}