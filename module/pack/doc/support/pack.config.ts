import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

export const config: AllConfigPartial = {
  workspace: 'dist/alt',
  assemble: {
    active: true,
    add: [
      { assets: 'assets' },
      { '/secret/location/key.pem': 'resources/key.pem' }
    ]
  },
  zip: {
    active: true,
    output: 'dist/build.zip'
  }
};