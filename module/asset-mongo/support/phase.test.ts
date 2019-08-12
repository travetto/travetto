export const init = {
  key: 'mongod',
  action: async () => {
    const { ConfigSource } = await import('@travetto/config');
    const { ExecUtil, DockerContainer } = await import('@travetto/exec');
    const { EnvUtil } = await import('@travetto/boot');

    const defPort = EnvUtil.getInt('MONGO_ASSET_PORT', 27017);

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

    ConfigSource.loadExternal();
  }
};