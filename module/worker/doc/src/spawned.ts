import * as timers from 'timers/promises';
import { ChildCommChannel } from '@travetto/worker';

export async function main(): Promise<void> {
  const exec = new ChildCommChannel<{ data: string }>();

  exec.on('request', data =>
    exec.send('response', { data: (data.data + data.data) })); // When data is received, return double

  exec.send('ready'); // Indicate the child is ready to receive requests

  const heartbeat = (): void => { timers.setTimeout(5000).then(heartbeat); }; // Keep-alive
  heartbeat();
}