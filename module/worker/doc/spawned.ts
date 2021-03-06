import { PhaseManager } from '@travetto/base';

export async function entry() {
  await PhaseManager.run('init');

  const { ChildCommChannel } = await import('..');

  const exec = new ChildCommChannel<{ data: string }>();

  exec.listenFor('request', data => {
    exec.send('response', { data: (data.data + data.data) }); // When data is received, return double
  });

  exec.send('ready'); // Indicate the child is ready to receive requests

  const heartbeat = () => setTimeout(heartbeat, 5000); // Keep-alive
  heartbeat();
}