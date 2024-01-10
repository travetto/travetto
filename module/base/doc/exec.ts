import { Spawn } from '@travetto/base';

export async function executeListing() {
  const { result } = await Spawn.exec('ls');
  const final = await result;
  console.log('Listing', { lines: final.stdout.split('\n') });
}