import { ChildCommChannel } from '@travetto/worker';

export async function main() {
  const exec = new ChildCommChannel<{ data: string }>();

  exec.listenFor('request', data => {
    exec.send('response', { data: (data.data + data.data) }); // When data is received, return double
  });

  exec.send('ready'); // Indicate the child is ready to receive requests

  const heartbeat = () => setTimeout(heartbeat, 5000); // Keep-alive
  heartbeat();
}