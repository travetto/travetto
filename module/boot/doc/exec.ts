import { ExecUtil } from '@travetto/boot';

export async function executeListing() {
  const { result } = ExecUtil.spawn('ls');
  const final = await result;
  console.log('Listing', { lines: final.stdout.split('\n') });
}