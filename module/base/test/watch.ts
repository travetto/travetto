import { Watcher, AppEnv } from '../src';
import * as fs from 'fs';
import * as path from 'path';

const w = new Watcher({ cwd: path.join(AppEnv.cwd, 'src') });
w
  .on('all', ({ event, entry }) => {
    console.log(event, entry);
  });

w.add([{ testFile: x => /.*/.test(x) }, __filename]);
w.watch({
  file: __dirname,
  module: __dirname.replace(/[\\]/g, '/'),
  stats: fs.lstatSync(__dirname)
});