import * as http from 'http';
import * as https from 'https';

function client(url: string) {
  return (url.startsWith('https') ? https : http) as typeof http;
}

function check(url: string) {
  return new Promise((resolve) => {
    try {
      const req = client(url).get(url, (msg: http.IncomingMessage) =>
        msg.on('end', () => resolve((msg.statusCode || 200))));
      req.on('error', () => resolve(500));
    } catch (e) {
      resolve(400);
    }
  });
}

export const init = {
  key: 'elasticsearch',
  action: async () => {
    const { ConfigLoader } = await import('@travetto/config');
    const { DockerContainer } = await import('@travetto/exec/src/docker');

    const defPort = parseInt(`${process.env.MODEL_ELASTICSEARCH_PORT || 9200}`, 10);

    try {
      await DockerContainer.waitForPort(defPort, 10);
      process.env.MODEL_ELASTICSEARCH_NAMESPACE = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {

      async function waitForUrl(url: string, timeout: number) {
        const start = Date.now();
        while ((Date.now() - start) < timeout) {
          const status = await check(url);
          if (status >= 200 && status <= 299) {
            return; // We good
          }
          await new Promise(res => setTimeout(res, 100));
        }
      }

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.MODEL_ELASTICSEARCH_PORT = `${port}`;
      const container = new DockerContainer('elasticsearch:6.5.4')
        .forceDestroyOnShutdown()
        .exposePort(port, 9200)
        .addEnvVar('discovery.type', 'single-node');

      container.run();
      await waitForUrl(`http://127.0.0.1:${port}`, 10000);
    }

    ConfigLoader.reloadConfig();
  }
};