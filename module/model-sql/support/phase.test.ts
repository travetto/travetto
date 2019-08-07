export const init = {
  key: 'sql',
  action: async () => {
    const { ConfigSource } = await import('@travetto/config');
    const { DockerContainer, ExecUtil } = await import('@travetto/exec');
    const { EnvUtil } = await import('@travetto/boot');

    const defPort = EnvUtil.getInt('SQL_MODEL_PORT', 5432);

    try {
      await ExecUtil.waitForPort(defPort, 10);
    } catch (e) {

      console.debug('Starting up docker for postgress:11');

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.SQL_MODEL_PORT = `${port}`;
      process.env.SQL_MODEL_DATABASE = 'app';
      process.env.SQL_MODEL_USER = 'root';
      process.env.SQL_MODEL_PASSWORD = 'password';
      const container = new DockerContainer('postgress:11')
        .forceDestroyOnShutdown()
        .exposePort(port, 5432)
        .addEnvVar('POSTGRES_DB', 'app')
        .addEnvVar('POSTGRES_USER', 'root')
        .addEnvVar('POSTGRES_PASSWORD', 'password');

      container.run();

      await ExecUtil.waitForPort(port, 10000);
      await new Promise(r => setTimeout(r, 15000));
    }

    ConfigSource.loadExternal();
  }
};