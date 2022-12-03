import { ExecUtil } from '@travetto/base';

export class Git {

  static async publishCommit(tag: string): Promise<string> {
    const { result } = ExecUtil.spawn('git', ['commit', '.', '-m', `Publish ${tag}`]);
    const res = await result;
    if (!res.valid) {
      throw new Error(res.stderr);
    }
    return res.stdout;
  }

  static async checkWorkspaceDirty(errorMessage: string): Promise<void> {
    const res1 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code']).result.catchAsResult();
    const res2 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code', '--cached']).result.catchAsResult();
    if (!res1.valid || !res2.valid) {
      console.error!(errorMessage);
      process.exit(1);
    }
  }
}