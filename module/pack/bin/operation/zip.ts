import * as path from 'path';

import { ExecUtil, FsUtil, PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from '../lib/types';
import { PackUtil } from '../lib/util';

export interface ZipConfig extends CommonConfig {
  output: string;
}

export const Zip: PackOperation<ZipConfig> = {
  key: 'zip',
  title: 'Zipping',
  context(cfg: ZipConfig) {
    return `[output=${cfg.output}]`;
  },
  extend(a: ZipConfig, b: Partial<ZipConfig>) {
    return {
      ...PackUtil.commonExtend(a, b),
      output: b.output ?? a.output
    };
  },
  /**
  * Zip workspace with flags
  */
  async* exec({ workspace, output }: ZipConfig) {
    const ws = PathUtil.resolveUnix(workspace);
    const zipFile = PathUtil.resolveUnix(output);

    yield 'Preparing Target';
    await FsUtil.mkdirp(path.dirname(zipFile));
    await FsUtil.unlinkRecursive(zipFile, true);

    yield 'Compressing';
    if (/win/i.test(process.platform)) {
      await ExecUtil.spawn('powershell', ['Compress-Archive', '-Path', '.', '-DestinationPath', zipFile], { cwd: ws }).result;
    } else {
      await ExecUtil.spawn('zip', ['-r', zipFile, '.'], { cwd: ws }).result;
    }

    yield color`${{ success: 'Successfully' }} archived project to ${{ path: zipFile.replace(PathUtil.cwd, '.') }}`;
  }
};