import { ChildCommChannel } from '../../src/comm/child';

export async function main() {
  const exec = new ChildCommChannel<{ data: string }>();

  exec.listenFor('request', data => {
    console!.log(process.pid, 'RECEIVED', data);
    exec.send('response', { data: (data.data + data.data) });
  });

  exec.send('ready');
}