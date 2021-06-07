import * as fs from 'fs';

import { PathUtil } from '@travetto/boot';
import type { AllConfigPartial, AssembleConfig } from '@travetto/pack';

export const config: AllConfigPartial = {
  name: 'rest/aws-lambda',
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
      'Lambda Entrypoint': (cfg: AssembleConfig) =>
        fs.promises.copyFile(
          PathUtil.resolveUnix(__dirname, 'aws-lambda.handler.js'),
          PathUtil.resolveUnix(cfg.workspace, 'index.js')
        )
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};