import * as path from 'path';
import * as fs from 'fs/promises';

import { color, ExecUtil, FsUtil, PathUtil } from '@travetto/boot';

import { CommonConfig, PackOperation } from '../lib/types';
import { PackUtil } from '../lib/util';

export interface ZipConfig extends CommonConfig {
  output: string;
}

export const Zip: PackOperation<ZipConfig, 'zip'> = {
  key: 'zip',
  title: 'Zipping',
  context(cfg: ZipConfig) {
    return `[output=${cfg.output}]`;
  },
  overrides: {
    output: process.env.PACK_ZIP_OUTPUT || undefined
  },
  extend(src: Partial<ZipConfig>, dest: Partial<ZipConfig>): Partial<ZipConfig> {
    return { output: src.output ?? dest.output };
  },
  buildConfig(configs: Partial<ZipConfig>[]): ZipConfig {
    return PackUtil.buildConfig(this, configs);
  },
  /**
  * Zip workspace with flags
  */
  async * exec({ workspace, output }: ZipConfig) {
    const ws = PathUtil.resolveUnix(workspace);
    const zipFile = PathUtil.resolveUnix(output);

    yield 'Preparing Target';
    await fs.mkdir(path.dirname(zipFile), { recursive: true });
    if (await FsUtil.exists(zipFile)) {
      await fs.unlink(zipFile); // Unlink
    }

    yield 'Compressing';
    if (/win/i.test(process.platform)) {
      await ExecUtil.spawn('powershell', ['Compress-Archive', '-Path', '.', '-DestinationPath', zipFile], { cwd: ws }).result;
    } else {
      await ExecUtil.spawn('zip', ['-r', zipFile, '.'], { cwd: ws }).result;
    }

    yield color`${{ success: 'Successfully' }} archived project to ${{ path: zipFile.replace(PathUtil.cwd, '.') }}`;
  }
};