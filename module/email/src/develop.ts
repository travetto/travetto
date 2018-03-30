import * as chokidar from 'chokidar';
import { create } from 'browser-sync';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

import { TemplateEngine } from './template';
import { MailTemplateConfig } from './config';

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

const DIST = `${__dirname}/../dist`;

declare var tplEngine: any;
declare var browserSync: any;

async function run() {

  for (const dir of [DIST, `${DIST}/asset`]) {
    await mkdir(dir).catch(e => { });
  }

  const srcFile = path.resolve(process.argv[2]);
  const srcDir = path.dirname(srcFile);

  const src = srcFile;

  const reload = async () => {
    const { text, html } = await tplEngine.template(src);

    // Persist temp for serving
    await writeFile(`${DIST}/index.html`, html);
    await writeFile(`${DIST}/index.txt`, text);
  }

  const watcher = chokidar.watch([tplEngine.config.assetRoot, src], {
    ignoreInitial: true,
    awaitWriteFinish: true
  });

  await reload();

  browserSync.init({
    files: [`${DIST}/index.html`],
    serveStatic: [{
      route: '/assets',
      dir: [tplEngine.config.assetRoot, path.dirname(src)],
    }],
    server: {
      baseDir: DIST
    }
  } as any);

  watcher.on('add', reload).on('change', reload);
}