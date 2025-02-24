import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { EmailCompileUtil } from '../src/util.ts';

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

    const output = await EmailCompileUtil.inlineImages(text, { loader: this.fixture });

    assert(!output.includes('red.gif'));
    assert(!output.includes('blue.gif'));
    assert(!output.includes('green.gif'));
    assert(/src="[^"]+"/.test(output));
    assert(/background:\s*url[(]'[^')]+'[)]/.test(output));
    assert(/background-image:\s*url[(][^)]+[)]/.test(output));
  }
}
