import { LocalExecution } from '../src';

const exec = new LocalExecution();

exec.listenFor('request', async (data: any, done?: Function) => {
  console.log(process.pid, 'RECEIVED', data);
  exec.send('response', { data: (data.data + data.data) });
});

exec.send('ready');

function heartbeat() {
  setTimeout(heartbeat, 5000);
}

heartbeat();