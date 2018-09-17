import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

// Must force import
import { MarkdownUtil } from '../src/markdown';

@Suite('Markdown')
class MarkdownTest {

  @Test('Convert html to markdown')
  async toMarkdownFromTemplate() {
    const text = `<row>
    <columns large="6">
      <button href="http://google.com">
        Awesome Image
      </button>
    </columns>
    <columns large="6">
      <menu>
        <item>One</item>
        <item>Two</item>
        <item>Three</item>
      </menu>
    </columns>
    <columns large="6">
      <menu>
        <item>One</item>
        <item>Two</item>
        <item>Three</item>
      </menu>
    </columns>
  </row>`;

    const output = await MarkdownUtil.htmlToMarkdown(text);

    assert(output === `
  [Awesome Image](http://google.com)

  * One
  * Two
  * Three

  * One
  * Two
  * Three
  `.trim());
  }

  @Test('Convert html to markdown')
  async toMarkdownFromHtml() {
    const text = `
    <div>
      <a href="http://google.com">
        Awesome Image
      </a>
    </div>
    <ul>
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ul>
    <br>
    <ol>
      <li>One</li>
      <li>Two</li>
      <li>Three
        <ol>
          <li>A</li>
          <li>B</li>
          <li>C <a href="google.com">Bob</a></li>
        </ol>
      </li>
    </ol>
    <p>
      Something cool
    </p>`;

    const output = await MarkdownUtil.htmlToMarkdown(text);

    assert(output === `
[Awesome Image](http://google.com)

  * One
  * Two
  * Three

  1. One
  2. Two
  3. Three
    1. A
    2. B
    3. C [Bob](google.com)

Something cool
  `.trim());
  }
}
