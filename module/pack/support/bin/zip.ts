import * as path from 'path';
import * as fs from 'fs/promises';

import { CliUtil } from '@travetto/cli';
import { ExecUtil } from '@travetto/base';

import { CommonConfig, PackOperation } from './types';
import { PackUtil } from './util';

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
    const ws = path.resolve(workspace).__posix;
    const zipFile = path.resolve(output).__posix;

    yield 'Preparing Target';
    await fs.mkdir(path.dirname(zipFile), { recursive: true });
    if (await fs.stat(zipFile).catch(() => { })) {
      await fs.unlink(zipFile); // Unlink
    }

    yield 'Compressing';
    if (/win/i.test(process.platform)) {
      await ExecUtil.spawn('powershell', ['Compress-Archive', '-Path', '.', '-DestinationPath', zipFile], { cwd: ws }).result;
    } else {
      await ExecUtil.spawn('zip', ['-r', zipFile, '.'], { cwd: ws }).result;
    }

    yield CliUtil.color`${{ success: 'Successfully' }} archived project to ${{ path: zipFile.replace(process.cwd().__posix, '.') }}`;
  }
};