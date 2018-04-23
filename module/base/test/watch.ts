import { Watcher } from '../src';

const w = new Watcher({ cwd: `${process.cwd()}/src` });
w
  .on('added', (e) => {
    console.log('Added', e);
  })
  .on('removed', (e) => {
    console.log('Removed', e);
  })
  .on('changed', (e) => {
    console.log('Changed', e);
  });

w.add([/.*/]);