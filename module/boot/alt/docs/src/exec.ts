import { ExecUtil } from '../../../src';

export async function executeListing() {
  const { result } = ExecUtil.spawn('ls');
  const final = await result;
  console.log(final.stdout.split('\n'));
}