import assert from 'assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { EmailTemplateCompiler } from '../src/compiler';
import { EmailTemplateResource } from '../src/resource';

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

    const resource = new EmailTemplateResource(['@travetto/email-template#test/fixtures']);

    const compiler = new EmailTemplateCompiler(resource);

    const output = await compiler.inlineImageSource(text);

    assert(!output.includes('red.gif'));
    assert(!output.includes('blue.gif'));
    assert(!output.includes('green.gif'));
    assert(/src="[^"]+"/.test(output));
    assert(/background:\s*url[(]'[^')]+'[)]/.test(output));
    assert(/background-image:\s*url[(][^)]+[)]/.test(output));
  }
}
