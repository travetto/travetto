export const init = {
  priority: 0,
  action: async () => {
    const { request } = require('@travetto/util');

    async function waitForUrl(url: string, timeout: number) {
      const start = Date.now();
      while ((Date.now() - start) < timeout) {
        try {
          await request({ url });
          return;
        } catch (e) {
          await new Promise(res => setTimeout(res, 100));
        }
      }
    }

    const port = 50000 + Math.trunc(Math.random() * 10000);
    process.env.MODEL_ELASTICSEARCH_PORT = `${port}`;
    const { DockerContainer } = require('@travetto/exec/src/docker');
    const container = new DockerContainer('elasticsearch:latest')
      .forceDestroyOnShutdown()
      .exposePort(port, 9200)
      .addEnvVar('discovery.type', 'single-node');

    container.run();
    await waitForUrl(`http://127.0.0.1:${port}`, 10000);
  }
}