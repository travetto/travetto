import { LocalExecution } from '../src';

const exec = new LocalExecution();

function go() {
  exec.listenFor('request', async (data: any) => {
    console.log(process.pid, 'RECEIVED', data);
    exec.send('response', { data: (data.data + data.data) });
  });
}

go();

exec.send('ready');

function heartbeat() {
  setTimeout(heartbeat, 5000);
}

heartbeat();