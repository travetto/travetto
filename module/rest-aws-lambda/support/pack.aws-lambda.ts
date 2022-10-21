import * as fs from 'fs/promises';

import { PathUtil } from '@travetto/boot';
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
          PathUtil.resolveUnix(__source.originalFolder, 'aws-lambda.handler.js'),
          PathUtil.resolveUnix(cfg.workspace, 'index.js')
        )
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};