import { ExecUtil } from '@travetto/base';

export async function executeListing() {
  const { result } = ExecUtil.spawn('ls');
  const final = await result;
  console.log('Listing', { lines: final.stdout.split('\n') });
}