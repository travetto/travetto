import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

export const config: AllConfigPartial = {
  name: 'custom',
  assemble: {
    keepSource: false,
    excludeCompile: [
      'node_modules/node-forge/',
      'node_modules/faker/',
    ]
  }
};