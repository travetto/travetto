export const init = {
  priority: 0,
  action: async () => {
    const port = 50000 + Math.trunc(Math.random() * 10000);
    process.env.MODEL_MONGO_PORT = `${port}`;
    const { DockerContainer } = require('@travetto/exec/src/docker');
    const container = new DockerContainer('mongo:latest')
      .forceDestroyOnShutdown()
      .exposePort(port);
    container.run('--storageEngine', 'ephemeralForTest', '--port', `${port}`)
    await container.waitForPort(port, 5000);
  }
}