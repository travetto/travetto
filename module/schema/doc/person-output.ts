import { PhaseManager } from '@travetto/base';

export async function main() {
  await PhaseManager.run('init');

  const { Test } = await import('./person-binding');

  console.log!(Test());
}