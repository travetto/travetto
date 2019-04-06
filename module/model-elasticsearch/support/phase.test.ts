export const init = {
  key: 'elasticsearch',
  action: async () => {
    const { ConfigSource } = await import('@travetto/config');
    const { DockerContainer, ExecUtil } = await import('@travetto/exec');
    const { EnvUtil } = await import('@travetto/boot');

    const defPort = EnvUtil.getInt('MODEL_ELASTICSEARCH_PORT', 9200);

    try {
      await ExecUtil.waitForPort(defPort, 10);
      process.env.MODEL_ELASTICSEARCH_NAMESPACE = `test_${Math.trunc(Math.random() * 10000)}`; // Randomize schema
    } catch (e) {

      console.debug('Starting up docker for elasticsearch:6.5.4');

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.MODEL_ELASTICSEARCH_PORT = `${port}`;
      const container = new DockerContainer('elasticsearch:6.5.4')
        .forceDestroyOnShutdown()
        .exposePort(port, 9200)
        .addEnvVar('discovery.type', 'single-node');

      container.run();
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      await ExecUtil.waitForHttp(`http://localhost:${port}`, 10000);
    }

    ConfigSource.loadExternal();
  }
};