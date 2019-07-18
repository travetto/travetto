export const init = {
  key: 'sql',
  action: async () => {
    const { ConfigSource } = await import('@travetto/config');
    const { DockerContainer, ExecUtil } = await import('@travetto/exec');
    const { EnvUtil } = await import('@travetto/boot');

    const defPort = EnvUtil.getInt('SQL_MODEL_PORT', 3306);

    try {
      await ExecUtil.waitForPort(defPort, 10);
    } catch (e) {

      console.debug('Starting up docker for mysql:5.7');

      const port = 50000 + Math.trunc(Math.random() * 10000);
      process.env.SQL_MODEL_PORT = `${port}`;
      process.env.SQL_MODEL_DATABASE = 'app';
      process.env.SQL_MODEL_USER = 'mysql';
      process.env.SQL_MODEL_PASSWORD = 'mysql';
      const container = new DockerContainer('mysql:5.7')
        .forceDestroyOnShutdown()
        .exposePort(port, 3306)
        .addEnvVar('MYSQL_DATABASE', 'app')
        .addEnvVar('MYSQL_ROOT_PASSWORD', 'password')
        .addEnvVar('MYSQL_USER', 'mysql')
        .addEnvVar('MYSQL_PASSWORD', 'mysql');

      container.run();

      await ExecUtil.waitForPort(port, 10000);
      await new Promise(r => setTimeout(r, 15000));
    }

    ConfigSource.loadExternal();
  }
};