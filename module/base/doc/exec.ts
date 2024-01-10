import { Spawn } from '@travetto/base';

export async function executeListing() {
  const { success } = await Spawn.exec('ls');
  const final = await success;
  console.log('Listing', { lines: final.stdout.split('\n') });
}