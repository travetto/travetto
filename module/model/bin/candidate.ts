import { EnvInit } from '@travetto/base/bin/init';
import { ExecUtil } from '@travetto/boot/src';

import type { ModelStorageSupport } from '../src/service/storage';
import { ModelCandidateUtil } from './lib/candidate';

/**
 * Handles direct invocation
 */
export async function main(op: keyof ModelStorageSupport) {
  try {
    EnvInit.init({ watch: false });
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    ExecUtil.mainResponse({
      models: await ModelCandidateUtil.getModelNames(),
      providers: await ModelCandidateUtil.getProviderNames(op)
    });
  } catch (err) {
    ExecUtil.mainResponse(err);
  }
}