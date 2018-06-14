export const init = {
  priority: 0,
  action: async () => {
    const { DockerContainer } = require('@travetto/exec/src/docker');

    const defPort = process.env.MODEL_MONGO_PORT || 27017;

    try {
      await DockerContainer.waitForPort(defPort, 10);
      process.env.MODEL_MONGO_SCHEMA = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {
      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.MODEL_MONGO_PORT = `${port}`;
      const container = new DockerContainer('mongo:latest')
        .forceDestroyOnShutdown()
        .exposePort(port);
      container.run('--storageEngine', 'ephemeralForTest', '--port', `${port}`);
      await DockerContainer.waitForPort(port, 5000);
    }
  }
};