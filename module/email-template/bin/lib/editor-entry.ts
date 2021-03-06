import { PhaseManager } from '@travetto/base';

export async function entry() {
  await PhaseManager.run('init');
  (await import('./editor')).EditorUtil.init();
}