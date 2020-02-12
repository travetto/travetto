import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '../src/resource';

@Suite()
export class ResourceManagerSuite {
  @Test()
  async readResources() {
    const files = await ResourceManager.findAllByExtension('.md');
    assert(files.length === 2);

    const altFiles = await ResourceManager.findAllByExtension('alt.md');
    assert(altFiles.length === 1);
  }
}