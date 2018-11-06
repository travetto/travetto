export const init = {
  key: 'sql',
  action: async () => {
    const { ConfigLoader } = await import('@travetto/config');
    const { DockerContainer } = await import('@travetto/exec/src/docker');

    const defPort = parseInt(`${process.env.MODEL_SQL_PORT || 9200}`, 10);

    try {
      await DockerContainer.waitForPort(defPort, 10);
      process.env.MODEL_SQL_NAMESPACE = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {

      async function waitForUrl(url: string, timeout: number) {
        const start = Date.now();
        while ((Date.now() - start) < timeout) {
          await new Promise(res => setTimeout(res, 100));
        }
      }

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.MODEL_SQL_PORT = `${port}`;
      const container = new DockerContainer('mysql:latest')
        .forceDestroyOnShutdown()
        .exposePort(port, 3306);

      container.run();
      await waitForUrl(`http://127.0.0.1:${port}`, 10000);
    }

    ConfigLoader.reloadConfig();
  }
};