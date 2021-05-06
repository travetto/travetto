import * as fs from 'fs';

import { PathUtil } from '@travetto/boot';
import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

export const config: AllConfigPartial = {
  name: 'rest/aws-lambda',
  assemble: {
    active: true,
    keepSource: false,
    exclude: [
      'node_modules/node-forge'
    ],
    env: {
      NO_COLOR: 1
    },
    postProcess: [{
      ['Lambda Entrypoint']: async (cfg: { workspace: string }) => {
        await fs.promises.writeFile(
          PathUtil.resolveUnix(cfg.workspace, 'index.js'), `
require('@travetto/boot/bin/register');
module.exports = require('@travetto/rest/support/entry.aws-lambda');`,
          { encoding: 'utf8' });
      }
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};