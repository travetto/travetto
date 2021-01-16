import * as path from 'path';

import { ExecUtil, FsUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from '../lib/types';

export interface ZipConfig extends CommonConfig {
  output: string;
}

export const Zip: PackOperation<ZipConfig> = {
  key: 'zip',
  title: 'Zipping',
  flags: [
    ['-w --workspace [workspace]', 'Workspace directory', undefined, 'workspace'],
    ['-o --output [output]', 'Output File', undefined, 'output']
  ],
  extend(a: ZipConfig, b: Partial<ZipConfig>) {
    return {
      active: b.active ?? a.active,
      workspace: b.workspace ?? a.workspace,
      output: b.output ?? a.output
    };
  },
  /**
  * Zip workspace with flags
  */
  async* exec({ workspace, output }: ZipConfig) {
    const ws = FsUtil.resolveUnix(workspace);
    const zipFile = FsUtil.resolveUnix(output);

    yield 'Preparing Target';
    await FsUtil.mkdirp(path.dirname(zipFile));
    await FsUtil.unlinkRecursive(zipFile, true);

    yield 'Compressing';
    if (/win/i.test(process.platform)) {
      await ExecUtil.spawn(`powershell`, ['Compress-Archive', '-Path', '.', '-DestinationPath', zipFile], { cwd: ws }).result;
    } else {
      await ExecUtil.spawn(`zip`, ['-r', zipFile, '.'], { cwd: ws }).result;
    }

    yield color`${{ success: 'Successfully' }} archived project to ${{ path: zipFile.replace(FsUtil.cwd, '.') }}`;
  }
};