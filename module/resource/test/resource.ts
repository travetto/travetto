import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '../src/resource';

@Suite()
export class ResourceManagerSuite {
  @Test()
  async readResources() {
    const files = await ResourceManager.findAll(/[.]md$/);
    assert(files.length === 2);

    const altFiles = await ResourceManager.findAll(/alt[.]md$/);
    assert(altFiles.length === 1);
  }
}