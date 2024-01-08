import { Spawn } from '@travetto/base';

export async function executeListing() {
  const { stdout } = await Spawn.exec('ls').result;
  console.log('Listing', { lines: stdout?.split('\n') });
}