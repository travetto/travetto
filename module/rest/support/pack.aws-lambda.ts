import * as fs from 'fs';
import { AppCache, FsUtil } from '@travetto/boot';

import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

const Entrypoint = AppCache.toEntryName(require.resolve('@travetto/rest/support/aws-lambda.ts'))
  .replace(AppCache.cacheDir, '.');

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
    postProcess: [
      async (cfg: { cacheDir: string, workspace: string }) => {
        await fs.promises.copyFile(FsUtil.resolveUnix(cfg.workspace, cfg.cacheDir, Entrypoint), FsUtil.resolveUnix(cfg.workspace, 'index.js'));
      }
    ],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};