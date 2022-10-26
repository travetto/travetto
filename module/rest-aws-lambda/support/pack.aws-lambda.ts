import * as fs from 'fs/promises';
import * as path from 'path';

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
          path.resolve(__source.folder, 'aws-lambda.handler.js').__posix,
          path.resolve(cfg.workspace, 'index.js').__posix
        )
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};