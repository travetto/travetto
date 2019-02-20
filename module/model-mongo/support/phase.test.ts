export const init = {
  key: 'mongod',
  action: async () => {
    const { ConfigLoader } = await import('@travetto/config');
    const { ExecUtil, DockerContainer } = await import('@travetto/exec');

    const defPort = parseInt(`${process.env.MODEL_MONGO_PORT || 27017}`, 10);

    try {
      await ExecUtil.waitForPort(defPort, 10);
      process.env.MODEL_MONGO_NAMESPACE = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {
      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.MODEL_MONGO_PORT = `${port}`;
      const container = new DockerContainer('mongo:latest')
        .forceDestroyOnShutdown()
        .exposePort(port);
      container.run('--storageEngine', 'ephemeralForTest', '--port', `${port}`);
      await ExecUtil.waitForPort(port, 5000);
    }

    ConfigLoader.reloadConfig();
  }
};