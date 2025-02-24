/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { renderJSX } from './util.ts';
import { SUMMARY_STYLE } from '../src/render/html.ts';
import { HLine, Wrapper, Summary, Title } from '../__index__.ts';

@Suite('simple')
class SimpleComponentTest {

  @Test('creates a wrapper that you can attach classes to')
  async testWrapper() {
    const input = <Wrapper className="header"></Wrapper>;
    const expected = <table align="center" className="header wrapper">
      <tbody>
        <tr>
          <td className="wrapper-inner">
          </td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates an email summary element')
  async testSummary() {
    const input = <Summary>Welcome Friends</Summary>;
    const expected = <span id="summary" style={SUMMARY_STYLE}>Welcome Friends</span>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates an email title element')
  async testTitle() {
    const input = <Title>Welcome Friends</Title>;
    const expected = <title>Welcome Friends</title>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a horizontal rule that you can attach classes to')
  async testHLine() {
    const input = <HLine className="dotted"></HLine>;
    const expected = <table className="dotted h-line">
      <tbody>
        <tr>
          <th>{'&nbsp;'}</th>
        </tr>
      </tbody>
    </table>;
    assert(await renderJSX(input) === await renderJSX(expected));
  }
}