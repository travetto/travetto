import { DockerContainer } from '../src/docker';

async function test() {
  const container = new DockerContainer('mongo:latest');
  const temp = await container.createTempVolume('/var/workspace');
  container.workingDir = '/var/workspace';
  const prom = container.run('--storageEngine', 'ephemeralForTest', '--port', '10000');

  setTimeout(() => container.destroy(), 2000);

  return prom;
}

test().then(() => console.log('Done', (e: any) => console.log('Err', e)));