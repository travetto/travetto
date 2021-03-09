import { ExecUtil } from '@travetto/boot/src';
import { ModelCandidateUtil } from './lib/candidate';

/**
 * Handles direct invocation
 */
export async function main() {
  try {
    await ModelCandidateUtil.init();
    ExecUtil.mainResponse({
      models: await ModelCandidateUtil.getModelNames(),
      providers: await ModelCandidateUtil.getProviderNames()
    });
  } catch (err) {
    ExecUtil.mainResponse(err);
  }
}