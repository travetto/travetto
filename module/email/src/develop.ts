import * as chokidar from 'chokidar';
import { create } from 'browser-sync';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { template, init, distRoot, assetRoot } from './template';

const writeFile = util.promisify(fs.writeFile);

const browserSync = create();

async function run() {
  const { src } = await init();
  const reload = async () => {
    const { text, html } = await template(src);

    // Persist temp for serving
    await writeFile(`${distRoot}/index.html`, html);
    await writeFile(`${distRoot}/index.txt`, text);
  }

  const watcher = chokidar.watch([assetRoot, src], {
    ignoreInitial: true,
    awaitWriteFinish: true
  });

  await reload();

  browserSync.init({
    files: [`${distRoot}/index.html`],
    serveStatic: [{
      route: '/assets',
      dir: [assetRoot, path.dirname(src)],
    }],
    server: {
      baseDir: distRoot
    }
  } as any);

  watcher.on('add', reload).on('change', reload);
}

run();