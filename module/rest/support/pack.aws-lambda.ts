import * as fs from 'fs';

import { AppCache, PathUtil } from '@travetto/boot';
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
      ['Install Entrypoint']: async (cfg: { cacheDir: string, workspace: string }) => {
        const Entrypoint = AppCache.toEntryName(require.resolve('@travetto/rest/support/entry.aws-lambda.ts'))
          .replace(AppCache.cacheDir, PathUtil.resolveUnix(cfg.workspace, cfg.cacheDir));
        await fs.promises.copyFile(Entrypoint, PathUtil.resolveUnix(cfg.workspace, 'index.js'));
      }
    }],
  },
  zip: {
    active: true,
    output: 'dist/lambda.zip'
  }
};