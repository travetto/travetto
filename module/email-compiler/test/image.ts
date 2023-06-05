import assert from 'assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { EmailCompileUtil } from '../src/util';

@Suite()
class ImageUtilTest {

  fixture = new TestFixtures();

  @Test('Verify Image Extraction')
  async verifyImageExtraction() {
    const text = `
<img src="/green.gif">

<div style="background-image: url(/blue.gif)"></div>

<div style="background: url('/red.gif')"></div>
`;

    const output = await EmailCompileUtil.inlineImages(text, {
      search: this.fixture.paths
    });

    assert(!output.includes('red.gif'));
    assert(!output.includes('blue.gif'));
    assert(!output.includes('green.gif'));
    assert(/src="[^"]+"/.test(output));
    assert(/background:\s*url[(]'[^')]+'[)]/.test(output));
    assert(/background-image:\s*url[(][^)]+[)]/.test(output));
  }
}
