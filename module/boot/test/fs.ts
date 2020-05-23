import * as assert from 'assert';
import * as os from 'os';

import { Test, Suite } from '@travetto/test';
import { FsUtil, ExecUtil, AppCache } from '../src';

@Suite()
export class FsTest {
  @Test()
  async toUnixSupport() {
    assert(FsUtil.toUnix('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
    assert(FsUtil.toUnix('/a/b/c/d') === '/a/b/c/d');

    assert(FsUtil.resolveUnix('/a/b', 'c/d') === '/a/b/c/d');
    assert(FsUtil.resolveUnix('/a/b', '/c/d') === '/c/d');

    assert(FsUtil.joinUnix('/a/b', 'c/d') === '/a/b/c/d');
    assert(FsUtil.joinUnix('/a/b', '/c/d') === '/a/b/c/d');
  }

  @Test()
  async toNativeSupport() {
    assert(FsUtil.toNative('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
    assert(FsUtil.toNative('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
  }

  @Test()
  async exists() {
    assert(FsUtil.existsSync(__dirname));
    assert(!FsUtil.existsSync(`${__dirname}.gone`));

    assert(await FsUtil.exists(__dirname));
    assert(!(await FsUtil.exists(`${__dirname}.gone`)));
  }

  /**
   * Make directory and all intermediate ones as well
   */
  @Test()
  async dirsAndUnlink() {
    const base = FsUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);

    // Default
    const special = FsUtil.resolveUnix(base, 'a', 'b', 'c');
    assert(!(await FsUtil.exists(special)));
    await FsUtil.mkdirp(special);
    assert(await FsUtil.exists(special));

    await FsUtil.unlinkRecursive(base);
    assert(!(await FsUtil.exists(special)));
  }

  @Test()
  async dirsAndUnlinkSync() {
    const base = FsUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);

    // Default
    const special = FsUtil.resolveUnix(base, 'a', 'b', 'c');
    assert(!FsUtil.existsSync(special));
    FsUtil.mkdirpSync(special);
    assert(FsUtil.existsSync(special));

    FsUtil.unlinkRecursiveSync(base);
    assert(!FsUtil.existsSync(base));
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
   * Remove directory, determine if errors should be ignored, synchronously
   */
  @Test()
  async copyRecursiveSync() {
    const base = FsUtil.resolveUnix(os.tmpdir(), `${Date.now()}`, `${Math.random()}`);
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