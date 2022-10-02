import * as assert from 'assert';
import { mkdirSync, writeFileSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';

import { Test, Suite } from '@travetto/test';
import { ExecUtil, FileCache, FsUtil, PathUtil } from '../src';

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
    assert.doesNotThrow(() => FsUtil.unlinkRecursiveSync('/woahwoah'));
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
    await fs.mkdir(special, { recursive: true });
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
    mkdirSync(special, { recursive: true });
    assert(FsUtil.existsSync(special));

    FsUtil.unlinkRecursiveSync(base);
    assert(!FsUtil.existsSync(base));
  }


  /**
   * Remove directory, determine if errors should be ignored, synchronously
   */
  @Test()
  async copyRecursive() {
    const rndFolder = `${Date.now()}_${Math.trunc(Math.random() * 10000)}`;
    const base = PathUtil.resolveUnix(os.tmpdir(), rndFolder);
    const cache = new FileCache(`.trv_${Date.now()}_${Math.trunc(Math.random() * 1000)}`);
    cache.init();

    const target = cache.cacheDir;

    // Default
    assert(!FsUtil.existsSync(base));
    mkdirSync(base, { recursive: true });
    assert(FsUtil.existsSync(base));

    for (const idx in [1, 2, 3, 4]) {
      await fs.writeFile(PathUtil.resolveUnix(base, `copy-recursive-${idx}.txt`), 'blah', 'utf8');
    }

    await FsUtil.copyRecursive(base, target);

    const results = ExecUtil.execSync(`ls -lsa ${target}/${rndFolder}/copy-recursive*`).split(/\n/g);

    assert(results.length === 4);

    FsUtil.unlinkRecursiveSync(base);
    assert(!FsUtil.existsSync(base));

    cache.clear();
  }
}