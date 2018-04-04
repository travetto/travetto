import { LocalExecution } from '../src';

const exec = new LocalExecution();

exec.listenFor('request', async (data: any, done?: Function) => {
  console.log('RECEIVED', data);
  exec.send('response', { data: (data.data + data.data) });
});

exec.send('ready');

setTimeout(() => { }, 100000000);