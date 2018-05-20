import { DockerContainer } from '../src/docker';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';

async function test() {
  const container = new DockerContainer('rafakato/alpine-graphicsmagick')
    .setInteractive(true)
    .setDeleteOnFinish(true);

  console.log('Hello');

  try {
    const [proc, prom] = await container.run({
      args: ['gm', 'convert', '-resize 100x50 - -']
    });

    createReadStream(path.resolve(`${os.homedir}/Documents/download.jpeg`)).pipe(proc.stdin);

    proc.stdout.pipe(process.stdout);

    await prom;
  } catch (e) {
    console.log('Error', e);
  }
}

test().then(() => {
  console.log('Done');
  process.exit(0);
}, (e: any) => {
  console.log('Err', e);
  //  process.exit(1);
});