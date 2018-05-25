import { Watcher } from '../src';
import * as fs from 'fs';

const w = new Watcher({ cwd: `${process.cwd()}/src` });
w
  .on('all', ({ event, entry }) => {
    console.log(event, entry);
  });

w.add([{ testFile: x => /.*/.test(x) }, __filename]);
w.watch({
  file: __dirname,
  stats: fs.lstatSync(__dirname)
});