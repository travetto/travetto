import assert from 'assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { EmailCompilerResource } from '../src/resource';
import { EmailCompilerUtil } from '../src/util';

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

    const resource = new EmailCompilerResource(['@travetto/email-compiler#test/fixtures']);
    const output = await EmailCompilerUtil.inlineImages(text, resource);

    assert(!output.includes('red.gif'));
    assert(!output.includes('blue.gif'));
    assert(!output.includes('green.gif'));
    assert(/src="[^"]+"/.test(output));
    assert(/background:\s*url[(]'[^')]+'[)]/.test(output));
    assert(/background-image:\s*url[(][^)]+[)]/.test(output));
  }
}
