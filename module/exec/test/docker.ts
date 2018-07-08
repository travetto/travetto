import { DockerContainer } from '../src/docker';

async function test() {
  const port = 10000;
  const container = new DockerContainer('mongo:latest')
    .createTempVolume('/var/workspace')
    .exposePort(port)
    .setWorkingDir('/var/workspace')
    .forceDestroyOnShutdown();

  container.run('--storageEngine', 'ephemeralForTest', '--port', port);
  await DockerContainer.waitForPort(port);

  return;
}

test().then(() => {
  console.log('Done');
  process.exit(0);
}, (e: any) => {
  console.log('Err', e);
  process.exit(1);
});