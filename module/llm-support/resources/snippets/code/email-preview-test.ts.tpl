import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { renderTransactionalEmail } from '../../src/email/render.ts';

@Suite()
class EmailPreviewTest {
  @Test()
  async preview() {
    const html = await renderTransactionalEmail({ title: 'Hello', message: 'World' });
    assert(html.includes('Hello'));
  }
}
