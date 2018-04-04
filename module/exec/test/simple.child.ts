import { LocalExecution } from '../src';

const exec = new LocalExecution();

exec.listenFor('request', async (data: any, done?: Function) => {
  exec.send('response', { data: (data.data + data.data) });
});

setTimeout(() =>
  exec.send('ready'), 1000);

setTimeout(() => { }, 100000000);