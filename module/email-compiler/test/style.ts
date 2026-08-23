import assert from 'node:assert';

import { EmailCompileUtil } from '@travetto/email-compiler';
import { Suite, Test, TestFixtures } from '@travetto/test';

@Suite()
class StyleUtilTest {
  fixture = new TestFixtures();

  @Test('Verify CSS Inlining')
  async verifyCssInlining() {
    const html = '<html><head><title>Test Title</title></head><body><h1>Header</h1><p class="intro">Paragraph</p></body></html>';
    const css = 'h1 { color: red; } .intro { font-size: 16px; }';

    const output = await EmailCompileUtil.inlineCss(html, css);

    assert(output.includes('style="color: red;"') || output.includes('style="color:red;"'));
    assert(output.includes('style="font-size: 16px;"') || output.includes('style="font-size:16px;"'));
    assert(!output.includes('<style>'));
  }

  @Test('Verify Media Queries Preserved in Head')
  async verifyMediaQueryPreservation() {
    const html = '<html><head><title>Test Title</title></head><body><h1>Header</h1></body></html>';
    const css = 'h1 { color: red; } @media (max-width: 600px) { h1 { color: blue; } }';

    const output = await EmailCompileUtil.inlineCss(html, css);

    assert(/<head>.*<style>.*@media \(max-width: 600px\).*<\/style>.*<\/head>/s.test(output));
    assert(output.includes('style="color: red;"') || output.includes('style="color:red;"'));
  }

  @Test('Verify Full Compilation with Styles')
  async verifyFullCompilation() {
    const compiled = await EmailCompileUtil.compile({
      loader: this.fixture,
      globalStyles: 'h1 { color: green; } @media screen { h1 { color: purple; } }',
      subject: async () => 'Subject Line',
      text: async () => 'Plain text content',
      html: async () => '<html><head></head><body><h1>Hello World</h1></body></html>'
    });

    assert.strictEqual(compiled.subject, 'Subject Line');
    assert.strictEqual(compiled.text, 'Plain text content');
    assert(compiled.html.includes('style="color: green;"') || compiled.html.includes('style="color:green;"'));
    assert(compiled.html.includes('@media screen'));
    assert(/<head>.*<style>.*@media screen.*<\/style>.*<\/head>/s.test(compiled.html));
  }
}
