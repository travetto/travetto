import { EnvInit } from '@travetto/base/support/bin/init';

import type { ModelStorageSupport } from '../src/service/storage';
import { ModelCandidateUtil } from './bin/candidate';

/**
 * Handles direct invocation
 */
export async function main(op: keyof ModelStorageSupport): Promise<{ models: string[], providers: string[] }> {
  EnvInit.init();
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  return {
    models: await ModelCandidateUtil.getModelNames(),
    providers: await ModelCandidateUtil.getProviderNames(op)
  };
}