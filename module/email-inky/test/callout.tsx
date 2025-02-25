/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { renderJSX } from './util';
import { Callout } from '../src/components';

@Suite('Callout')
class CalloutComponentTest {
  @Test('creates a callout with correct syntax')
  async testCallout() {
    const input = <Callout>Callout</Callout>;
    const expected = <table className="callout">
      <tbody>
        <tr>
          <th className="callout-inner">
            Callout
          </th>
          <th className="expander"></th>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('copies classes to the final HTML')
  async testClasses() {
    const input = <Callout className="primary">Callout</Callout>;
    const expected = <table className="callout">
      <tbody>
        <tr>
          <th className="primary callout-inner ">
            Callout
          </th>
          <th className="expander"></th>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}
