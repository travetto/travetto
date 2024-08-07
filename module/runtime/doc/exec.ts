import { spawn } from 'node:child_process';
import { ExecUtil } from '@travetto/runtime';

export async function executeListing() {
  const final = await ExecUtil.getResult(spawn('ls'));
  console.log('Listing', { lines: final.stdout.split('\n') });
}