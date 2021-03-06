process.env.TRV_DEBUG = '*'; // @doc-exclude
process.env.TRV_LOG_PLAIN = '0';  // @doc-exclude
import { PhaseManager } from '@travetto/base';

export async function main() {
  await PhaseManager.run('init');

  console.log('Hello World');

  console.log('Woah!', { a: { b: { c: { d: 10 } } } });

  console.info('Woah!');

  console.debug('Test');
}