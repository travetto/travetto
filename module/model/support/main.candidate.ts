import { RootRegistry } from '@travetto/registry';

import type { ModelStorageSupport } from '../src/service/storage';
import { ModelCandidateUtil } from './bin/candidate';

/**
 * Handles direct invocation
 */
export async function main(op: keyof ModelStorageSupport): Promise<{ models: string[], providers: string[] }> {
  await RootRegistry.init();

  return {
    models: await ModelCandidateUtil.getModelNames(),
    providers: await ModelCandidateUtil.getProviderNames(op)
  };
}