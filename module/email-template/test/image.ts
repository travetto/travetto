import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ImageUtil } from '../bin/lib/image';
import { PathUtil } from '@travetto/boot/src';

@Suite()
class ImageUtilTest {

  @Test('Verify Image Extraction')
  async verifyImageExtraction() {
    const text = `
<img src="/green.gif">

<div style="background-image: url(/blue.gif)"></div>

<div style="background: url('/red.gif')"></div>
`;

    const output = await ImageUtil.inlineImageSource(text, PathUtil.resolveUnix(__dirname, '..'));

    assert(!output.includes('red.gif'));
    assert(!output.includes('blue.gif'));
    assert(!output.includes('green.gif'));
    assert(/src="[^"]+"/.test(output));
    assert(/background:\s*url[(]'[^']+'[)]/.test(output));
    assert(/background-image:\s*url[(]'[^']+'[)]/.test(output));
  }
}
