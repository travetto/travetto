export const init = {
  key: 'mongod',
  action: async () => {
    const { ConfigLoader } = await import('@travetto/config');
    const { ExecUtil, DockerContainer } = await import('@travetto/exec');
    const { Env } = await import('@travetto/base');

    const defPort = Env.getInt('ASSET_MONGO_PORT', 27017);

    try {
      await ExecUtil.waitForPort(defPort, 10);
      process.env.ASSET_MONGO_NAMESPACE = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {
      console.debug('Starting up docker for mongo:latest');

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.ASSET_MONGO_PORT = `${port}`;
      const container = new DockerContainer('mongo:latest')
        .forceDestroyOnShutdown()
        .exposePort(port);
      container.run(['--storageEngine', 'ephemeralForTest', '--port', `${port}`]);
      await container.waitForPorts();
    }

    ConfigLoader.reloadConfig();
  }
};