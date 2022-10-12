import { EnvInit } from '@travetto/base/support/bin/init';
import { ModuleExec } from '@travetto/boot/src/internal/module-exec';

import type { ModelStorageSupport } from '../src/service/storage';
import { ModelCandidateUtil } from './bin/candidate';
/**
 * Handles direct invocation
 */
export async function main(op: keyof ModelStorageSupport): Promise<void> {
  try {
    EnvInit.init();
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    ModuleExec.mainResponse({
      models: await ModelCandidateUtil.getModelNames(),
      providers: await ModelCandidateUtil.getProviderNames(op)
    });
  } catch (err) {
    ModuleExec.mainResponse(err);
  }
}