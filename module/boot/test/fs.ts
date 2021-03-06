import * as assert from 'assert';
import * as os from 'os';

import { Test, Suite } from '@travetto/test';
import { AppCache, ExecUtil, FsUtil, PathUtil } from '../src';

@Suite()
export class FsUtilTest {

  @Test()
  async exists() {
    assert(FsUtil.existsSync(__dirname));
    assert(!FsUtil.existsSync(`${__dirname}.gone`));

    assert(await FsUtil.exists(__dirname));
    assert(!(await FsUtil.exists(`${__dirname}.gone`)));
  }

  /**
   * Command to remove a folder
   */
  @Test()
  async unlink() {
    assert.throws(() => FsUtil.unlinkRecursiveSync('/'));
    assert.throws(() => FsUtil.unlinkRecursiveSync('/', true));
    assert.throws(() => FsUtil.unlinkRecursiveSync('/woahwoah'));
    assert.doesNotThrow(() => FsUtil.unlinkRecursiveSync('/woahwoah', true));
  }

  /**
   * Make directory and all intermediate ones as well
   */
  @Test()
  async dirsAndUnlink() {
    const base = PathUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);

    // Default
    const special = PathUtil.resolveUnix(base, 'a', 'b', 'c');
    assert(!(await FsUtil.exists(special)));
    await FsUtil.mkdirp(special);
    assert(await FsUtil.exists(special));

    await FsUtil.unlinkRecursive(base);
    assert(!(await FsUtil.exists(special)));
  }

  @Test()
  async dirsAndUnlinkSync() {
    const base = PathUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);

    // Default
    const special = PathUtil.resolveUnix(base, 'a', 'b', 'c');
    assert(!FsUtil.existsSync(special));
    FsUtil.mkdirpSync(special);
    assert(FsUtil.existsSync(special));

    FsUtil.unlinkRecursiveSync(base);
    assert(!FsUtil.existsSync(base));
  }


  /**
   * Remove directory, determine if errors should be ignored, synchronously
   */
  @Test()
  async copyRecursiveSync() {
    const base = PathUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);
    const target = AppCache.cacheDir;

    // Default
    assert(!FsUtil.existsSync(base));
    FsUtil.mkdirpSync(base);
    assert(FsUtil.existsSync(base));

    FsUtil.copyRecursiveSync(base, target);

    const results = ExecUtil.execSync(`ls -lsa ${target}`).split(/\n/g);

    assert(results.length > 20);

    FsUtil.unlinkRecursiveSync(base);
    assert(!FsUtil.existsSync(base));
  }
}