import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import type { AllConfigPartial } from '@travetto/pack';

export const config: AllConfigPartial = {
  name: 'rest-aws-lambda/main',
  assemble: {
    active: true,
    keepSource: false,
    exclude: [
      'node_modules/node-forge'
    ],
    env: {
      NO_COLOR: '1'
    },
    postProcess: [{
      ['Lambda Entrypoint']: cfg =>
        fs.copyFile(
          path.resolve(path.dirname(__output), 'aws-lambda.handler.js'),
          path.resolve(cfg.workspace, 'index.js')
        )
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};