/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { renderJSX } from './util';

import { Callout } from '../src/components';

@Suite('Callout')
class CalloutComponentTest {
  @Test('creates a callout with correct syntax')
  async testCallout() {
    const input = <Callout>Callout</Callout>;
    const expected = <table class="callout">
      <tbody>
        <tr>
          <th class="callout-inner">
            Callout
          </th>
          <th class="expander"></th>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('copies classes to the final HTML')
  async testClasses() {
    const input = <Callout class="primary">Callout</Callout>;
    const expected = <table class="callout">
      <tbody>
        <tr>
          <th class="primary callout-inner ">
            Callout
          </th>
          <th class="expander"></th>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}
