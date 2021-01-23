import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

export const config: AllConfigPartial = {
  name: 'rest/lambda',
  assemble: {
    active: true,
    keepSource: false,
    add: [
      { 'node_modules/@travetto/rest/support/aws-lambda.js': 'index.js' }
    ],
    exclude: [
      'node_modules/node-forge'
    ],
    env: {
      NO_COLOR: 1
    }
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};