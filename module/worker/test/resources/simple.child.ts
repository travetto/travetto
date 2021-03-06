import { PhaseManager } from '@travetto/base';

export async function entry() {
  await PhaseManager.run('init');
  const { ChildCommChannel } = await import('../../src/comm/child');
  const exec = new ChildCommChannel<{ data: string }>();

  exec.listenFor('request', data => {
    console!.log(process.pid, 'RECEIVED', data);
    exec.send('response', { data: (data.data + data.data) });
  });

  exec.send('ready');
}